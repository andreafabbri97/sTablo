import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { matchReactions, matchComments, users, players } from "./db/schema";
import { MATCH_REACTIONS } from "./reactions";

/**
 * Social layer for a single match — reactions + comments.
 *
 * Deliberately UNCACHED: these reads change on every emoji tap / comment, and
 * routing them through the coarse `DATA_TAG` cache would force a full feed
 * invalidation on each interaction. The match detail page is force-dynamic, so
 * a plain query per view is cheap and always fresh.
 */

export type ReactionSummary = {
  emoji: string;
  count: number;
  /** true when the current viewer has this emoji on the match. */
  mine: boolean;
};

export type CommentView = {
  id: string;
  body: string;
  createdAt: Date;
  /** author's user id — used to gate the delete control. */
  userId: string;
  authorName: string;
  /** player slug for the profile link, null if the user has no player. */
  authorSlug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
  /** root comment this one replies to, or null for a root comment. */
  parentId: string | null;
};

/** A root comment with its one-level replies — both oldest-first. */
export type CommentThread = CommentView & { replies: CommentView[] };

export type MatchSocial = {
  reactions: ReactionSummary[];
  comments: CommentThread[];
};

/**
 * Group a flat, oldest-first comment list into one-level threads: roots in
 * order, each carrying its replies (also oldest-first). A reply whose parent is
 * missing (e.g. a since-deleted root) is promoted to a root so nothing is ever
 * hidden from the conversation. Pure — unit-tested in social.test.ts.
 */
export function buildCommentThreads(flat: CommentView[]): CommentThread[] {
  const rootIds = new Set(
    flat.filter((c) => c.parentId === null).map((c) => c.id),
  );
  const repliesByParent = new Map<string, CommentView[]>();
  for (const c of flat) {
    if (c.parentId !== null && rootIds.has(c.parentId)) {
      const list = repliesByParent.get(c.parentId) ?? [];
      list.push(c);
      repliesByParent.set(c.parentId, list);
    }
  }
  const threads: CommentThread[] = [];
  for (const c of flat) {
    // A genuine root, or an orphan reply promoted to root.
    if (c.parentId === null || !rootIds.has(c.parentId)) {
      threads.push({ ...c, replies: repliesByParent.get(c.id) ?? [] });
    }
  }
  return threads;
}

/**
 * Load the reaction tallies (one entry per palette emoji, in palette order) and
 * the comment thread (oldest-first) for a match. `viewerUserId` flags which
 * reactions belong to the current user so the bar can highlight them.
 */
export async function getMatchSocial(
  matchId: string,
  viewerUserId?: string,
): Promise<MatchSocial> {
  const [reactionRows, commentRows] = await Promise.all([
    db
      .select({ emoji: matchReactions.emoji, userId: matchReactions.userId })
      .from(matchReactions)
      .where(eq(matchReactions.matchId, matchId)),
    db
      .select({
        id: matchComments.id,
        body: matchComments.body,
        createdAt: matchComments.createdAt,
        userId: matchComments.userId,
        parentId: matchComments.parentId,
        userName: users.name,
        playerName: players.name,
        playerSlug: players.slug,
        avatarColor: players.avatarColor,
        avatarUrl: players.avatarUrl,
      })
      .from(matchComments)
      .innerJoin(users, eq(matchComments.userId, users.id))
      .leftJoin(players, eq(users.playerId, players.id))
      .where(eq(matchComments.matchId, matchId))
      .orderBy(asc(matchComments.createdAt)),
  ]);

  // One entry per palette emoji, in the canonical order, counts aggregated in JS.
  const reactions: ReactionSummary[] = MATCH_REACTIONS.map((emoji) => {
    const rows = reactionRows.filter((r) => r.emoji === emoji);
    return {
      emoji,
      count: rows.length,
      mine: viewerUserId ? rows.some((r) => r.userId === viewerUserId) : false,
    };
  });

  const comments: CommentView[] = commentRows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt,
    userId: r.userId,
    authorName: r.playerName ?? r.userName,
    authorSlug: r.playerSlug ?? null,
    avatarColor: r.avatarColor ?? 0,
    avatarUrl: r.avatarUrl ?? null,
    parentId: r.parentId,
  }));

  return { reactions, comments: buildCommentThreads(comments) };
}
