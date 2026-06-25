/**
 * In-app notification center — the single choke point for every user-facing
 * event. `notify()` does two things, both best-effort so a gameplay flow (match
 * confirm, friend accept, tournament invite…) can NEVER break because of a
 * notification: it
 *   1. persists a row per recipient into the `notifications` table (the
 *      durable in-app feed read by the bell + /notifiche page), and
 *   2. fans out a Web Push to the user's devices (already best-effort).
 *
 * Keep this module server-only — it imports the DB and `web-push` (node crypto)
 * transitively. Import it from server actions / server components only.
 */
import { and, desc, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { sendPushToUsers } from "@/lib/push";

/**
 * Category slug for a notification. Drives the icon in the feed and lets us
 * tweak per-kind behaviour later (e.g. which kinds are "actionable"). Keep in
 * sync with the icon map in the /notifiche page.
 */
export type NotifyKind =
  | "confirm_needed"
  | "match_confirmed"
  | "result_disputed"
  | "challenge"
  | "friend_request"
  | "comment"
  | "tournament_invite"
  | "season_recap"
  | "match_reminder"
  | "generic";

export type NotifyInput = {
  /** recipients — de-duplicated and empties dropped before anything runs */
  userIds: string[];
  kind: NotifyKind;
  title: string;
  body: string;
  /** in-app path to open on tap, e.g. "/partite/123" */
  url?: string;
  /** push collapse key so repeat notifications replace each other on the device */
  tag?: string;
};

/** How many feed rows the /notifiche page and bell preview read. */
export const FEED_LIMIT = 40;

/** Read notifications older than this are pruned so the table can't grow forever. */
const PRUNE_AFTER_DAYS = 60;

/**
 * Persist + push a notification to one or more users. Best-effort: persistence
 * failures are logged and swallowed, push is already never-throws, so the
 * caller's transaction/flow is never affected.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const userIds = [...new Set(input.userIds.filter(Boolean))];
  if (userIds.length === 0) return;

  // 1. Durable in-app feed (best-effort — must never break the caller).
  try {
    await db.insert(notifications).values(
      userIds.map((userId) => ({
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
      })),
    );
  } catch (error) {
    console.error("[notify] persist failed", error);
  }

  // 2. Web Push fan-out (already best-effort / never throws).
  await sendPushToUsers(userIds, {
    title: input.title,
    body: input.body,
    url: input.url,
    tag: input.tag,
  });
}

/** Most recent notifications for a user, newest first. Best-effort → []. */
export async function fetchFeed(
  userId: string,
  limit: number = FEED_LIMIT,
): Promise<(typeof notifications.$inferSelect)[]> {
  try {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  } catch (error) {
    console.error("[fetchFeed]", error);
    return [];
  }
}

/** Count of unread notifications for a user. Best-effort → 0. */
export async function countUnread(userId: string): Promise<number> {
  try {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return Number(rows[0]?.n ?? 0);
  } catch (error) {
    console.error("[countUnread]", error);
    return 0;
  }
}

/** Mark every unread notification of a user as read. Best-effort → no-op. */
export async function markAllRead(userId: string): Promise<void> {
  try {
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  } catch (error) {
    console.error("[markAllRead]", error);
  }
}

/**
 * Housekeeping: drop already-read notifications older than PRUNE_AFTER_DAYS so
 * the table stays small. Safe to call opportunistically — best-effort.
 */
export async function pruneOldNotifications(): Promise<void> {
  const cutoff = new Date(Date.now() - PRUNE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  try {
    await db
      .delete(notifications)
      .where(
        and(
          lt(notifications.createdAt, cutoff),
          // keep unread ones around even if old, so nothing important vanishes
          sql`${notifications.readAt} is not null`,
        ),
      );
  } catch (error) {
    console.error("[pruneOldNotifications]", error);
  }
}
