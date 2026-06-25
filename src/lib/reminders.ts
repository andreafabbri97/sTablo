/**
 * Push reminders for scheduled challenges. Run once a day by a Vercel Cron
 * (see vercel.json): it notifies the players of every match scheduled within
 * the next 24 hours. Because it runs daily and only looks one day ahead, each
 * match gets at most one reminder — no per-match "reminded" bookkeeping needed.
 */
import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { db } from "./db";
import { matches, users } from "./db/schema";
import { notify } from "./notifications";
import { formatDateTime } from "./utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Notify participants of matches scheduled in the next 24h. Returns count sent. */
export async function sendScheduledReminders(): Promise<number> {
  const now = new Date();
  const horizon = new Date(now.getTime() + DAY_MS);

  const rows = await db.query.matches.findMany({
    where: and(
      eq(matches.status, "scheduled"),
      gte(matches.playedAt, now),
      lt(matches.playedAt, horizon),
    ),
    with: { participants: true },
  });

  let sent = 0;
  for (const m of rows) {
    const playerIds = [...new Set(m.participants.map((p) => p.playerId))];
    if (!playerIds.length) continue;

    const accounts = await db
      .select({ userId: users.id })
      .from(users)
      .where(inArray(users.playerId, playerIds));
    const userIds = accounts.map((a) => a.userId);
    if (!userIds.length) continue;

    await notify({
      userIds,
      kind: "match_reminder",
      title: "📅 Sfida in arrivo",
      body: `Hai una sfida programmata per ${formatDateTime(m.playedAt)}`,
      url: `/partite/${m.id}`,
      tag: `match-reminder-${m.id}`,
    });
    sent++;
  }
  return sent;
}
