"use server";

import {
  seasonForDate,
  getSeasonStandings,
  type SeasonStanding,
} from "@/lib/seasons";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriends } from "@/lib/friends";
import { getPlayerSlugById } from "@/lib/queries";
import { safe } from "@/lib/safe";

/**
 * Per-request overlay for the leaderboard, loaded client-side so the rankings
 * (Generale/Singolo/Doppio/Team) can be a cached static shell:
 *  - `season` standings for the CURRENT month (date-dependent → can't live in a
 *    build-time shell; the underlying query is still cached per month).
 *  - the viewer's `friendSlugs` + own `selfSlug` for the Tutti/Amici/Altri split
 *    (in the leaderboard «Amici» includes you).
 */
export async function classificaOverlay(): Promise<{
  season: SeasonStanding[];
  seasonLabel: string;
  friendSlugs: string[];
  selfSlug: string | null;
}> {
  const season = seasonForDate(new Date());
  const user = await getCurrentUser();
  const [seasonRows, friends, selfSlug] = await Promise.all([
    safe(() => getSeasonStandings(season.start, season.end), []),
    user ? safe(() => getFriends(user.id), []) : Promise.resolve([]),
    user?.playerId
      ? safe(() => getPlayerSlugById(user.playerId as string), null)
      : Promise.resolve(null),
  ]);
  return {
    season: seasonRows,
    seasonLabel: season.label,
    friendSlugs: friends
      .map((f) => f.slug)
      .filter((s): s is string => Boolean(s)),
    selfSlug,
  };
}
