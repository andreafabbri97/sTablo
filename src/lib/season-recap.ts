/**
 * Monthly season recap push. Run by a Vercel Cron on the 1st of each month
 * (see vercel.json): it looks at the season that just ended, finds the MVP, and
 * pushes a recap to everyone with notifications on. Running once at the boundary
 * means each season is recapped exactly once — no per-season bookkeeping.
 */
import { db } from "./db";
import { pushSubscriptions } from "./db/schema";
import { sendPushToUsers } from "./push";
import {
  getSeasonStandings,
  previousSeason,
  seasonForDate,
  type Season,
} from "./seasons";

export type RecapResult = {
  /** false when there was nothing to recap or nobody to notify. */
  sent: boolean;
  season: string;
  mvp: string | null;
  recipients: number;
};

/**
 * Send the recap for the season before `reference` (defaults to now → recaps
 * last month). Best-effort: a push/DB hiccup never throws.
 */
export async function sendSeasonRecap(
  reference: Date = new Date(),
): Promise<RecapResult> {
  const season: Season = previousSeason(seasonForDate(reference));
  const standings = await getSeasonStandings(season.start, season.end);

  if (!standings.length) {
    return { sent: false, season: season.label, mvp: null, recipients: 0 };
  }

  const mvp = standings[0];
  const matchesPlayed = standings.reduce((sum, s) => sum + s.played, 0);
  // Each match contributes to two participants' `played`, so halve for a true count.
  const totalMatches = Math.round(matchesPlayed / 2);

  const subs = await db
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);
  const userIds = [...new Set(subs.map((s) => s.userId))];

  if (!userIds.length) {
    return {
      sent: false,
      season: season.label,
      mvp: mvp.player.name,
      recipients: 0,
    };
  }

  const matchesLabel =
    totalMatches > 0
      ? ` su ${totalMatches} ${totalMatches === 1 ? "partita" : "partite"} di stagione`
      : "";

  await sendPushToUsers(userIds, {
    title: `🏆 Recap di ${season.label}`,
    body: `MVP del mese: ${mvp.player.name} con ${mvp.won} ${
      mvp.won === 1 ? "vittoria" : "vittorie"
    }${matchesLabel}. Apri la classifica di stagione!`,
    url: "/classifica",
    tag: "season-recap",
  });

  return {
    sent: true,
    season: season.label,
    mvp: mvp.player.name,
    recipients: userIds.length,
  };
}
