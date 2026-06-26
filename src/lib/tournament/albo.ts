import { and, eq, isNotNull, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentEntrants,
  players,
  teams,
} from "@/lib/db/schema";
import { cachedQuery } from "@/lib/cache";
import { getPlayerUsernames } from "@/lib/queries";
import { avatarSrc } from "@/lib/avatar-src";

/**
 * Albo d'oro — the tournament hall of fame. Champions are derived on read from
 * `tournaments.winnerEntrantId` (no dedicated table): a tournament earns a spot
 * once it is `completed` with a decided winner. The winner entrant is resolved
 * to a display name + avatar, linking to a profile only when it's a single
 * registered player (pairs/teams have no single profile page to point at).
 */

export type ChampionWinner = {
  name: string;
  /** account handle — only set for a single registered player (not pairs/teams) */
  username: string | null;
  /** profile slug to link to — only set for a single registered player */
  slug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
};

export type TournamentChampion = {
  tournamentId: string;
  slug: string;
  name: string;
  format: string;
  discipline: string;
  /** when the title was decided (completion date, falling back to creation) */
  decidedAt: Date;
  winner: ChampionWinner;
};

export const getTournamentChampions = cachedQuery(
  async (): Promise<TournamentChampion[]> => {
    const rows = await db
      .select({
        id: tournaments.id,
        slug: tournaments.slug,
        name: tournaments.name,
        format: tournaments.format,
        discipline: tournaments.discipline,
        completedAt: tournaments.completedAt,
        createdAt: tournaments.createdAt,
        winnerEntrantId: tournaments.winnerEntrantId,
      })
      .from(tournaments)
      .where(
        and(
          eq(tournaments.status, "completed"),
          isNotNull(tournaments.winnerEntrantId),
        ),
      )
      .orderBy(
        sql`coalesce(${tournaments.completedAt}, ${tournaments.createdAt}) desc`,
      );

    if (!rows.length) return [];

    const entrantIds = rows
      .map((r) => r.winnerEntrantId)
      .filter((id): id is string => Boolean(id));
    const entrants = entrantIds.length
      ? await db
          .select()
          .from(tournamentEntrants)
          .where(inArray(tournamentEntrants.id, entrantIds))
      : [];
    const entrantById = new Map(entrants.map((e) => [e.id, e]));

    const playerIds = new Set<string>();
    const teamIds = new Set<string>();
    for (const e of entrants) {
      if (e.playerId) playerIds.add(e.playerId);
      if (e.teamId) teamIds.add(e.teamId);
    }

    const playerRows = playerIds.size
      ? await db
          .select({
            id: players.id,
            slug: players.slug,
            avatarColor: players.avatarColor,
            avatarUrl: players.avatarUrl,
          })
          .from(players)
          .where(inArray(players.id, [...playerIds]))
      : [];
    const playerById = new Map(playerRows.map((p) => [p.id, p]));

    // Account handle per player id (all players, cached). Only single-player
    // champions get a meaningful @handle; pairs/teams resolve to null below.
    const usernameById = new Map(
      (await getPlayerUsernames()).map((u) => [u.id, u.username]),
    );

    const teamRows = teamIds.size
      ? await db
          .select({
            id: teams.id,
            avatarColor: teams.avatarColor,
          })
          .from(teams)
          .where(inArray(teams.id, [...teamIds]))
      : [];
    const teamById = new Map(teamRows.map((t) => [t.id, t]));

    const result: TournamentChampion[] = [];
    for (const r of rows) {
      const entrant = r.winnerEntrantId
        ? entrantById.get(r.winnerEntrantId)
        : null;
      if (!entrant) continue;

      const primary = entrant.playerId
        ? playerById.get(entrant.playerId)
        : null;
      const team = entrant.teamId ? teamById.get(entrant.teamId) : null;

      let winner: ChampionWinner;
      if (primary && !entrant.partnerId) {
        // a single registered player → link to the profile + show @handle
        winner = {
          name: entrant.name,
          username: entrant.playerId
            ? usernameById.get(entrant.playerId) ?? null
            : null,
          slug: primary.slug,
          avatarColor: primary.avatarColor,
          avatarUrl: avatarSrc(primary.id, primary.avatarUrl),
        };
      } else if (primary) {
        // an ad-hoc doubles pair ("A & B"): primary player's avatar, no link/handle
        winner = {
          name: entrant.name,
          username: null,
          slug: null,
          avatarColor: primary.avatarColor,
          avatarUrl: avatarSrc(primary.id, primary.avatarUrl),
        };
      } else if (team) {
        winner = {
          name: entrant.name,
          username: null,
          slug: null,
          avatarColor: team.avatarColor,
          avatarUrl: null,
        };
      } else {
        winner = {
          name: entrant.name,
          username: null,
          slug: null,
          avatarColor: 0,
          avatarUrl: null,
        };
      }

      result.push({
        tournamentId: r.id,
        slug: r.slug,
        name: r.name,
        format: r.format,
        discipline: r.discipline,
        decidedAt: r.completedAt ?? r.createdAt,
        winner,
      });
    }
    return result;
  },
  ["tournament-champions"],
);
