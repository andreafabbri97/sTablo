"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { matches, teams } from "@/lib/db/schema";
import { matchSchema } from "@/lib/validation";
import { assertAdmin } from "@/lib/auth-helpers";
import { applyMatchResult, recomputeAllElo, type SideInput } from "@/lib/match-engine";
import type { ActionResult } from "./auth-actions";

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

export async function recordMatch(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
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

  const winner: "A" | "B" = d.scoreA > d.scoreB ? "A" : "B";
  const playedAt = d.playedAt ? new Date(d.playedAt) : new Date();

  try {
    const matchId = await db.transaction(async (tx) => {
      const [match] = await tx
        .insert(matches)
        .values({
          format: d.format,
          status: "completed",
          ranked: d.ranked,
          scoreA: d.scoreA,
          scoreB: d.scoreB,
          winner,
          playedAt,
          note: d.note || null,
          createdById: user.id,
        })
        .returning({ id: matches.id });

      await applyMatchResult(tx, {
        matchId: match.id,
        format: d.format,
        sideA: sideA!,
        sideB: sideB!,
        scoreA: d.scoreA,
        scoreB: d.scoreB,
        ranked: d.ranked,
      });
      return match.id;
    });

    revalidatePath("/");
    revalidatePath("/classifica");
    revalidatePath("/partite");
    revalidatePath("/giocatori");
    void matchId;
    return { ok: true };
  } catch (error) {
    console.error("[recordMatch]", error);
    return { ok: false, error: "Errore nel salvataggio della partita" };
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
    // Ratings are stateful: rebuild from the remaining history.
    await recomputeAllElo();
    revalidatePath("/");
    revalidatePath("/classifica");
    revalidatePath("/partite");
    revalidatePath("/giocatori");
    return { ok: true };
  } catch (error) {
    console.error("[deleteMatch]", error);
    return { ok: false, error: "Errore nell'eliminazione della partita" };
  }
}
