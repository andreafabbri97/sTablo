"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bustDataCache } from "@/lib/cache";
import { matches, teams, users } from "@/lib/db/schema";
import { matchSchema } from "@/lib/validation";
import { assertAuth, assertAdmin } from "@/lib/auth-helpers";
import {
  insertParticipants,
  recomputeAllElo,
  type SideInput,
} from "@/lib/match-engine";
import { sendPushToUsers } from "@/lib/push";
import type { ActionResult } from "./auth-actions";

const CONFIRM_WINDOW_MS = 24 * 60 * 60 * 1000;
/** How long the player who entered a result can still undo it themselves. */
const UNDO_WINDOW_MS = 10 * 60 * 1000;

/** proposeMatch returns the new match id so the form can offer an inline undo. */
export type ProposeResult =
  | { ok: true; matchId: string }
  | { ok: false; error: string; field?: string };

async function resolveDoublesSide(
  teamId: string | undefined,
  p1: string | undefined,
  p2: string | undefined,
): Promise<SideInput | null> {
  if (teamId) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
    if (!team) return null;
    return { playerIds: [team.player1Id, team.player2Id], teamId: team.id };
  }
  if (p1 && p2) return { playerIds: [p1, p2], teamId: null };
  return null;
}

function refresh() {
  bustDataCache();
  revalidatePath("/");
  revalidatePath("/partite");
}

/**
 * Propose (or, as admin, directly record) a match result.
 * - any participant can propose → status 'pending' until the opponent confirms
 * - the admin records directly → status 'completed' (override)
 */
export async function proposeMatch(input: unknown): Promise<ProposeResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per inserire una partita" };
  }

  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const d = parsed.data;

  let sideA: SideInput | null;
  let sideB: SideInput | null;
  if (d.format === "singles") {
    if (!d.playerA || !d.playerB) {
      return { ok: false, error: "Seleziona entrambi i giocatori" };
    }
    sideA = { playerIds: [d.playerA], teamId: null };
    sideB = { playerIds: [d.playerB], teamId: null };
  } else {
    sideA = await resolveDoublesSide(d.teamA, d.playerA, d.playerA2);
    sideB = await resolveDoublesSide(d.teamB, d.playerB, d.playerB2);
    if (!sideA || !sideB) {
      return { ok: false, error: "Completa entrambe le coppie" };
    }
  }

  const allIds = [...sideA.playerIds, ...sideB.playerIds];
  if (new Set(allIds).size !== allIds.length) {
    return { ok: false, error: "Un giocatore non può stare in entrambe le squadre" };
  }

  const isAdmin = user.role === "admin";
  let proposerSide: "A" | "B" | null = null;
  if (user.playerId) {
    if (sideA.playerIds.includes(user.playerId)) proposerSide = "A";
    else if (sideB.playerIds.includes(user.playerId)) proposerSide = "B";
  }
  if (!isAdmin && !proposerSide) {
    return { ok: false, error: "Puoi inserire solo partite in cui giochi tu" };
  }

  const winner: "A" | "B" = d.scoreA > d.scoreB ? "A" : "B";
  const playedAt = d.playedAt ? new Date(d.playedAt) : new Date();
  const finalize = isAdmin; // admin overrides confirmation
  const status = finalize ? "completed" : "pending";

  try {
    const matchId = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          format: d.format,
          status,
          ranked: d.ranked,
          scoreA: d.scoreA,
          scoreB: d.scoreB,
          winner,
          playedAt,
          note: d.note || null,
          createdById: user.id,
          proposedById: user.id,
          proposedSide: proposerSide,
          confirmDeadline: finalize
            ? null
            : new Date(Date.now() + CONFIRM_WINDOW_MS),
        })
        .returning({ id: matches.id });

      await insertParticipants(tx, match.id, sideA!, sideB!);
      return match.id;
    });

    if (finalize) await recomputeAllElo();
    refresh();

    // Alert the opponent(s) that a result is waiting for their confirmation.
    if (!finalize && proposerSide) {
      const opponents = (proposerSide === "A" ? sideB! : sideA!).playerIds;
      await notifyConfirmNeeded(opponents, user.name);
    }
    return { ok: true, matchId };
  } catch (error) {
    console.error("[proposeMatch]", error);
    return { ok: false, error: "Errore nel salvataggio della partita" };
  }
}

/** Best-effort push to the opponents who need to confirm a proposed result. */
async function notifyConfirmNeeded(
  opponentPlayerIds: string[],
  fromName?: string | null,
) {
  if (!opponentPlayerIds.length) return;
  const rows = await db
    .select({ userId: users.id })
    .from(users)
    .where(inArray(users.playerId, opponentPlayerIds));
  const userIds = rows.map((r) => r.userId);
  if (!userIds.length) return;
  await sendPushToUsers(userIds, {
    title: "Risultato da confermare ✅",
    body: `${fromName?.trim() || "Un avversario"} ha inserito un risultato: confermalo o rifiutalo`,
    url: "/partite",
    tag: "match-confirm",
  });
}

/** Confirm a pending result. Opponent (1 of 2 in doubles) or admin. Race-safe. */
export async function confirmMatch(matchId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { participants: true },
  });
  if (!match) return { ok: false, error: "Partita non trovata" };
  if (match.status !== "pending") return { ok: true }; // already confirmed/handled

  const isAdmin = user.role === "admin";
  if (!isAdmin) {
    const opposite = match.proposedSide === "A" ? "B" : "A";
    const canConfirm =
      !!user.playerId &&
      match.participants.some(
        (p) => p.side === opposite && p.playerId === user.playerId,
      );
    if (!canConfirm) {
      return { ok: false, error: "Solo l'avversario può confermare il risultato" };
    }
  }

  try {
    // Conditional update: only ONE confirmation (or auto-confirm) can win.
    const updated = await db
      .update(matches)
      .set({ status: "completed", confirmedById: user.id, autoConfirmed: false })
      .where(and(eq(matches.id, matchId), eq(matches.status, "pending")))
      .returning({ id: matches.id });

    if (updated.length === 0) return { ok: true }; // someone confirmed first

    await recomputeAllElo();
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[confirmMatch]", error);
    return { ok: false, error: "Errore nella conferma" };
  }
}

/** Reject/cancel a pending proposal. Opponent, the proposer, or admin. */
export async function rejectMatch(matchId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
    with: { participants: true },
  });
  if (!match) return { ok: true };
  if (match.status !== "pending") {
    return { ok: false, error: "Partita già confermata, non annullabile" };
  }

  const isAdmin = user.role === "admin";
  const opposite = match.proposedSide === "A" ? "B" : "A";
  const isOpponent =
    !!user.playerId &&
    match.participants.some(
      (p) => p.side === opposite && p.playerId === user.playerId,
    );
  const isProposer = match.proposedById === user.id;
  if (!isAdmin && !isOpponent && !isProposer) {
    return { ok: false, error: "Non puoi rifiutare questa partita" };
  }

  try {
    await db
      .delete(matches)
      .where(and(eq(matches.id, matchId), eq(matches.status, "pending")));
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[rejectMatch]", error);
    return { ok: false, error: "Errore nel rifiuto" };
  }
}

/**
 * Self-service undo for the player who entered a result. Within a short window
 * after creation they can delete it — to fix a wrong score or opponent right
 * after saving, without bothering an admin. Works whether the match is still
 * pending or already completed (auto/confirmed); admins keep deleteMatch.
 */
export async function undoMatch(matchId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match) return { ok: true }; // already gone — nothing to undo

  if (match.createdById !== user.id) {
    return {
      ok: false,
      error: "Puoi annullare solo le partite che hai inserito tu",
    };
  }
  const age = Date.now() - new Date(match.createdAt).getTime();
  if (age > UNDO_WINDOW_MS) {
    return {
      ok: false,
      error: "Tempo scaduto per annullare: chiedi a un amministratore",
    };
  }

  try {
    const wasCompleted = match.status === "completed";
    await db.delete(matches).where(eq(matches.id, matchId));
    if (wasCompleted) await recomputeAllElo();
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[undoMatch]", error);
    return { ok: false, error: "Errore nell'annullamento della partita" };
  }
}

export async function deleteMatch(matchId: string): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  try {
    await db.delete(matches).where(eq(matches.id, matchId));
    await recomputeAllElo();
    refresh();
    return { ok: true };
  } catch (error) {
    console.error("[deleteMatch]", error);
    return { ok: false, error: "Errore nell'eliminazione della partita" };
  }
}
