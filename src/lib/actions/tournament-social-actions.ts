"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournaments, tournamentComments } from "@/lib/db/schema";
import { commentSchema } from "@/lib/validation";
import { assertAuth } from "@/lib/auth-helpers";
import { notify } from "@/lib/notifications";
import { rateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rate-limit";
import type { ActionResult } from "./auth-actions";

/**
 * Comments under a whole tournament — mirrors the match comment actions (same
 * one-level threading, same rate limit). Kept separate so the live match-comment
 * flow is never touched. Reads are uncached, so a targeted revalidatePath of the
 * tournament route is all that's needed.
 */

/** Canonical UUID shape — guards comparisons against a uuid column, which throws
 * on a malformed literal instead of returning no rows. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Post a comment under a tournament. With `parentId` it's a reply: the parent
 * must belong to the same tournament, and threading is kept one level deep (a
 * reply-to-a-reply is re-parented onto its root). Notifies the organizer for a
 * root comment, or the replied-to author for a reply.
 */
export async function addTournamentComment(
  tournamentId: string,
  input: unknown,
  parentId?: string | null,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per commentare" };
  }

  const limit = await rateLimit(`comment:${user.id}`, RATE_LIMITS.comment);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Stai commentando troppo in fretta. Aspetta ${retryAfterSeconds(
        limit.retryAfterMs,
      )} secondi.`,
    };
  }

  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: issue?.message ?? "Commento non valido", field: "body" };
  }

  const rows = await db
    .select({
      id: tournaments.id,
      slug: tournaments.slug,
      createdById: tournaments.createdById,
    })
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  const tournament = rows[0];
  if (!tournament) return { ok: false, error: "Torneo non trovato" };

  // Resolve the reply target: it must be a comment on THIS tournament. Flatten a
  // reply-to-a-reply onto its root so the thread never nests deeper than one.
  let rootParentId: string | null = null;
  let replyToAuthorId: string | null = null;
  if (parentId) {
    if (!UUID_RE.test(parentId)) {
      return { ok: false, error: "Commento di riferimento non valido" };
    }
    const parentRows = await db
      .select({
        id: tournamentComments.id,
        tournamentId: tournamentComments.tournamentId,
        parentId: tournamentComments.parentId,
        userId: tournamentComments.userId,
      })
      .from(tournamentComments)
      .where(eq(tournamentComments.id, parentId))
      .limit(1);
    const parent = parentRows[0];
    if (!parent || parent.tournamentId !== tournamentId) {
      return { ok: false, error: "Commento di riferimento non trovato" };
    }
    rootParentId = parent.parentId ?? parent.id;
    replyToAuthorId = parent.userId;
  }

  try {
    await db.insert(tournamentComments).values({
      tournamentId,
      userId: user.id,
      body: parsed.data.body,
      parentId: rootParentId,
    });
  } catch (err) {
    console.error("[addTournamentComment] errore:", err);
    return { ok: false, error: "Non è stato possibile salvare il commento" };
  }

  revalidatePath(`/tornei/${tournament.slug}`);

  // Best-effort notifications: a reply pings the person it answers; a root
  // comment pings the tournament organizer.
  try {
    const actor = user.name?.trim() || "Qualcuno";
    const target = rootParentId ? replyToAuthorId : tournament.createdById;
    if (target && target !== user.id) {
      await notify({
        userIds: [target],
        kind: "comment",
        title: rootParentId ? "💬 Nuova risposta" : "💬 Nuovo commento",
        body: rootParentId
          ? `${actor} ha risposto al tuo commento`
          : `${actor} ha commentato il tuo torneo`,
        url: `/tornei/${tournament.slug}`,
        tag: "tournament-comment",
      });
    }
  } catch (err) {
    console.error("[addTournamentComment] notifica saltata:", err);
  }

  return { ok: true };
}

/** Delete a tournament comment — only the author or an admin may do so. Its
 * replies cascade away with it (self-FK ON DELETE CASCADE). */
export async function deleteTournamentComment(
  commentId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per continuare" };
  }

  const rows = await db
    .select({
      id: tournamentComments.id,
      userId: tournamentComments.userId,
      slug: tournaments.slug,
    })
    .from(tournamentComments)
    .innerJoin(tournaments, eq(tournamentComments.tournamentId, tournaments.id))
    .where(eq(tournamentComments.id, commentId))
    .limit(1);
  const comment = rows[0];
  if (!comment) return { ok: false, error: "Commento non trovato" };

  if (user.role !== "admin" && comment.userId !== user.id) {
    return { ok: false, error: "Non puoi eliminare questo commento" };
  }

  try {
    await db.delete(tournamentComments).where(eq(tournamentComments.id, commentId));
  } catch (err) {
    console.error("[deleteTournamentComment] errore:", err);
    return { ok: false, error: "Non è stato possibile eliminare il commento" };
  }

  revalidatePath(`/tornei/${comment.slug}`);
  return { ok: true };
}
