"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  matches,
  matchParticipants,
  matchReactions,
  matchComments,
  players,
  users,
} from "@/lib/db/schema";
import { isValidReaction } from "@/lib/reactions";
import { commentSchema } from "@/lib/validation";
import { assertAuth } from "@/lib/auth-helpers";
import { notify } from "@/lib/notifications";
import { extractMentions } from "@/lib/mentions";
import { rateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rate-limit";
import type { ActionResult } from "./auth-actions";

/**
 * Social actions for a match — reactions and comments.
 *
 * These deliberately do NOT call bustDataCache: the social reads are uncached
 * (see lib/social.ts), so a targeted revalidatePath of the detail route is all
 * that's needed and the whole feed cache stays warm.
 */

/** Canonical UUID v4-ish shape — guards the comparison against a uuid column,
 * which throws on a malformed literal instead of returning no rows. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshMatch(matchId: string) {
  revalidatePath(`/partite/${matchId}`);
}

/** All user ids tied to a match's participants, excluding one user (the actor). */
async function matchParticipantUserIds(
  matchId: string,
  exceptUserId: string,
): Promise<string[]> {
  const parts = await db
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId));
  const playerIds = parts.map((p) => p.playerId).filter(Boolean) as string[];
  if (!playerIds.length) return [];
  const rows = await db
    .select({ userId: users.id })
    .from(users)
    .where(and(inArray(users.playerId, playerIds), ne(users.id, exceptUserId)));
  return rows.map((r) => r.userId);
}

/** A player that can be @mentioned — has a linked account with a username. */
export type Mentionable = { name: string; username: string; slug: string };

/**
 * Everyone who can be @mentioned in a comment: players whose account has a
 * username. Powers the composer's autocomplete and the linkified rendering.
 * Best-effort → empty list (mentions are a nice-to-have, never block commenting).
 */
export async function getMentionables(): Promise<Mentionable[]> {
  try {
    const rows = await db
      .select({
        name: players.name,
        username: users.username,
        slug: players.slug,
      })
      .from(users)
      .innerJoin(players, eq(users.playerId, players.id))
      .where(isNotNull(users.username));
    return rows
      .filter((r): r is Mentionable => Boolean(r.username))
      .map((r) => ({ name: r.name, username: r.username, slug: r.slug }));
  } catch (err) {
    console.error("[getMentionables] errore:", err);
    return [];
  }
}

/** Resolve @handles in `body` to account user ids, excluding the author. */
async function resolveMentionedUserIds(
  body: string,
  exceptUserId: string,
): Promise<string[]> {
  const handles = extractMentions(body);
  if (!handles.length) return [];
  const rows = await db
    .select({ userId: users.id })
    .from(users)
    .where(and(inArray(users.username, handles), ne(users.id, exceptUserId)));
  return rows.map((r) => r.userId);
}

/**
 * Slack-style toggle: add the emoji if the user hasn't reacted with it, remove
 * it otherwise. Idempotent under races thanks to the unique index + onConflict.
 */
export async function toggleReaction(
  matchId: string,
  emoji: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per reagire" };
  }

  if (!isValidReaction(emoji)) {
    return { ok: false, error: "Reazione non valida" };
  }

  // Guard the FK up front so a stale client can't spam invalid match ids.
  const match = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match.length) return { ok: false, error: "Partita non trovata" };

  try {
    const existing = await db
      .select({ id: matchReactions.id })
      .from(matchReactions)
      .where(
        and(
          eq(matchReactions.matchId, matchId),
          eq(matchReactions.userId, user.id),
          eq(matchReactions.emoji, emoji),
        ),
      )
      .limit(1);

    if (existing.length) {
      await db
        .delete(matchReactions)
        .where(eq(matchReactions.id, existing[0].id));
    } else {
      await db
        .insert(matchReactions)
        .values({ matchId, userId: user.id, emoji })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error("[toggleReaction] errore:", err);
    return { ok: false, error: "Non è stato possibile salvare la reazione" };
  }

  refreshMatch(matchId);
  return { ok: true };
}

/**
 * Post a short comment under a match. When `parentId` is given it's a reply:
 * the parent must be a comment on the same match, and threading is kept one
 * level deep (a reply-to-a-reply is re-parented onto its root). Notifies the
 * match participants for a root comment, or the replied-to author for a reply.
 */
export async function addComment(
  matchId: string,
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

  const match = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match.length) return { ok: false, error: "Partita non trovata" };

  // Resolve the reply target: it must be a comment on THIS match. Flatten a
  // reply-to-a-reply onto its root so the thread never nests deeper than one.
  let rootParentId: string | null = null;
  let replyToAuthorId: string | null = null;
  if (parentId) {
    if (!UUID_RE.test(parentId)) {
      return { ok: false, error: "Commento di riferimento non valido" };
    }
    const parentRows = await db
      .select({
        id: matchComments.id,
        matchId: matchComments.matchId,
        parentId: matchComments.parentId,
        userId: matchComments.userId,
      })
      .from(matchComments)
      .where(eq(matchComments.id, parentId))
      .limit(1);
    const parent = parentRows[0];
    if (!parent || parent.matchId !== matchId) {
      return { ok: false, error: "Commento di riferimento non trovato" };
    }
    rootParentId = parent.parentId ?? parent.id;
    replyToAuthorId = parent.userId;
  }

  try {
    await db.insert(matchComments).values({
      matchId,
      userId: user.id,
      body: parsed.data.body,
      parentId: rootParentId,
    });
  } catch (err) {
    console.error("[addComment] errore:", err);
    return { ok: false, error: "Non è stato possibile salvare il commento" };
  }

  refreshMatch(matchId);

  // Best-effort notifications. Anyone @mentioned gets a dedicated "ti hanno
  // menzionato" ping; then a reply pings the person it answers and a root
  // comment pings the other players on the match — excluding anyone already
  // pinged by a mention so nobody gets two notifications for one comment.
  try {
    const actor = user.name?.trim() || "Qualcuno";
    const mentionedIds = await resolveMentionedUserIds(parsed.data.body, user.id);
    const mentioned = new Set(mentionedIds);

    if (mentionedIds.length) {
      await notify({
        userIds: mentionedIds,
        kind: "comment",
        title: "💬 Ti hanno menzionato",
        body: `${actor} ti ha menzionato in un commento`,
        url: `/partite/${matchId}`,
        tag: "match-mention",
      });
    }

    if (rootParentId) {
      if (
        replyToAuthorId &&
        replyToAuthorId !== user.id &&
        !mentioned.has(replyToAuthorId)
      ) {
        await notify({
          userIds: [replyToAuthorId],
          kind: "comment",
          title: "💬 Nuova risposta",
          body: `${actor} ha risposto al tuo commento`,
          url: `/partite/${matchId}`,
          tag: "match-comment",
        });
      }
    } else {
      const userIds = (await matchParticipantUserIds(matchId, user.id)).filter(
        (id) => !mentioned.has(id),
      );
      if (userIds.length) {
        await notify({
          userIds,
          kind: "comment",
          title: "💬 Nuovo commento",
          body: `${actor} ha commentato la partita`,
          url: `/partite/${matchId}`,
          tag: "match-comment",
        });
      }
    }
  } catch (err) {
    console.error("[addComment] notifica saltata:", err);
  }

  return { ok: true };
}

/** Delete a comment — only the author or an admin may do so. */
export async function deleteComment(commentId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per continuare" };
  }

  const rows = await db
    .select({ id: matchComments.id, userId: matchComments.userId, matchId: matchComments.matchId })
    .from(matchComments)
    .where(eq(matchComments.id, commentId))
    .limit(1);
  const comment = rows[0];
  if (!comment) return { ok: false, error: "Commento non trovato" };

  if (user.role !== "admin" && comment.userId !== user.id) {
    return { ok: false, error: "Non puoi eliminare questo commento" };
  }

  try {
    await db.delete(matchComments).where(eq(matchComments.id, commentId));
  } catch (err) {
    console.error("[deleteComment] errore:", err);
    return { ok: false, error: "Non è stato possibile eliminare il commento" };
  }

  refreshMatch(comment.matchId);
  return { ok: true };
}
