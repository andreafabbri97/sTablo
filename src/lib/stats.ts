import { and, eq, or, desc } from "drizzle-orm";
import { db } from "./db";
import { cachedQuery } from "./cache";
import {
  matchParticipants,
  matches,
  players,
  teams,
  tournaments,
  tournamentEntrants,
} from "./db/schema";
import {
  computeAttributes,
  resolveAttributes,
  levelFromXp,
  matchXp,
  overall,
  type Attributes,
  type LevelInfo,
} from "./gamification";
import {
  foldResults,
  xpFromResults,
  type ResultRow,
  type StatLine,
} from "./stats-fold";

export type { StatLine, ResultRow };
export { foldResults, xpFromResults };

async function loadResultRows(playerId: string): Promise<ResultRow[]> {
  const rows = await db
    .select({
      format: matches.format,
      side: matchParticipants.side,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winner: matches.winner,
      playedAt: matches.playedAt,
      ranked: matches.ranked,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(
      and(
        eq(matchParticipants.playerId, playerId),
        eq(matches.status, "completed"),
      ),
    );

  return rows.map((r) => {
    const isA = r.side === "A";
    return {
      format: r.format,
      won: r.winner === r.side,
      pointsFor: (isA ? r.scoreA : r.scoreB) ?? 0,
      pointsAgainst: (isA ? r.scoreB : r.scoreA) ?? 0,
      playedAt: r.playedAt,
      ranked: r.ranked,
    };
  });
}

export type PlayerWithStats = {
  player: typeof players.$inferSelect;
  /** Username of the linked account (the player's @handle), null if unlinked. */
  username: string | null;
  stats: StatLine;
  level: LevelInfo;
  /** Attributes actually shown: derived performance + the player's overrides. */
  attributes: Attributes;
  /** Pure performance-derived attributes (the "auto" baseline), pre-overrides. */
  derived: Attributes;
  overall: number;
  tournamentsWon: number;
};

export const getPlayerWithStats = cachedQuery(
  async (playerId: string): Promise<PlayerWithStats | null> => {
    const row = await db.query.players.findFirst({
      where: eq(players.id, playerId),
      with: { user: { columns: { username: true } } },
    });
    if (!row) return null;
    const { user, ...player } = row;
    return buildPlayerWithStats(player, user?.username ?? null);
  },
  ["player-by-id"],
);

export const getPlayerWithStatsBySlug = cachedQuery(
  async (slug: string): Promise<PlayerWithStats | null> => {
    const row = await db.query.players.findFirst({
      where: eq(players.slug, slug),
      with: { user: { columns: { username: true } } },
    });
    if (!row) return null;
    const { user, ...player } = row;
    return buildPlayerWithStats(player, user?.username ?? null);
  },
  ["player-by-slug"],
);

async function buildPlayerWithStats(
  player: typeof players.$inferSelect,
  username: string | null,
): Promise<PlayerWithStats> {
  const rows = await loadResultRows(player.id);
  const tournamentsWon = await countTournamentWins(player.id);
  // Competitive record & Elo come from ranked matches; XP from all of them.
  const rankedRows = rows.filter((r) => r.ranked);
  const stats = foldResults(rankedRows);
  const totalXp = xpFromResults(rows, tournamentsWon);
  const level = levelFromXp(totalXp);
  const derived = computeAttributes(
    {
      played: stats.played,
      won: stats.won,
      lost: stats.lost,
      pointsFor: stats.pointsFor,
      pointsAgainst: stats.pointsAgainst,
      bestStreak: stats.bestStreak,
      currentStreak: stats.currentStreak,
      tournamentsWon,
      totalXp,
    },
    player.playStyle,
  );
  // Resolve the card: derived baseline reshaped by the player's overrides,
  // re-validated against the level's floor / cap / total-points budget.
  const attributes = resolveAttributes(
    derived,
    player.customAttributes,
    level.level,
  );
  return {
    player,
    username,
    stats,
    level,
    attributes,
    derived,
    overall: overall(attributes),
    tournamentsWon,
  };
}

async function countTournamentWins(playerId: string): Promise<number> {
  const rows = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .innerJoin(
      tournamentEntrants,
      eq(tournaments.winnerEntrantId, tournamentEntrants.id),
    )
    .where(
      and(
        eq(tournaments.status, "completed"),
        or(
          eq(tournamentEntrants.playerId, playerId),
          eq(tournamentEntrants.partnerId, playerId),
        ),
      ),
    );
  return rows.length;
}

/* ----------------------------------------------------------------------------
   Ranking — aggregate across all players in one pass
---------------------------------------------------------------------------- */
export type RankingDiscipline = "overall" | "singles" | "doubles";

export type RankRow = {
  player: typeof players.$inferSelect;
  played: number;
  won: number;
  lost: number;
  pointDiff: number;
  winRate: number;
  elo: number;
  level: number;
  points: number; // 3 per win
};

async function getRankingImpl(
  discipline: RankingDiscipline = "overall",
): Promise<RankRow[]> {
  // These three reads are independent: fire them together so a cold ranking
  // computation pays one DB round-trip, not three in series. (Needs a pool of
  // more than one connection to truly parallelize — see lib/db.)
  const [players_, rows, tWinRows] = await Promise.all([
    db.select().from(players),
    // All completed matches: ranked ones feed the competitive record/Elo, every
    // match (ranked or friendly) feeds XP/level.
    db
      .select({
        playerId: matchParticipants.playerId,
        side: matchParticipants.side,
        format: matches.format,
        ranked: matches.ranked,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        winner: matches.winner,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
      .where(eq(matches.status, "completed")),
    // Tournament wins (XP bonus + consistency with profile level)
    db
      .select({
        playerId: tournamentEntrants.playerId,
        partnerId: tournamentEntrants.partnerId,
      })
      .from(tournaments)
      .innerJoin(
        tournamentEntrants,
        eq(tournaments.winnerEntrantId, tournamentEntrants.id),
      )
      .where(eq(tournaments.status, "completed")),
  ]);

  const acc = new Map<
    string,
    { played: number; won: number; lost: number; pf: number; pa: number; xp: number }
  >();

  for (const r of rows) {
    const isA = r.side === "A";
    const pf = (isA ? r.scoreA : r.scoreB) ?? 0;
    const pa = (isA ? r.scoreB : r.scoreA) ?? 0;
    const won = r.winner === r.side;
    const cur = acc.get(r.playerId) ?? {
      played: 0,
      won: 0,
      lost: 0,
      pf: 0,
      pa: 0,
      xp: 0,
    };
    cur.xp += matchXp(won, pf, pa); // every match grants XP
    if (r.ranked && (discipline === "overall" || r.format === discipline)) {
      cur.played++;
      cur.pf += pf;
      cur.pa += pa;
      if (won) cur.won++;
      else cur.lost++;
    }
    acc.set(r.playerId, cur);
  }

  // Tally the tournament wins fetched above (XP bonus + profile-level parity).
  const tWins = new Map<string, number>();
  for (const w of tWinRows) {
    if (w.playerId) tWins.set(w.playerId, (tWins.get(w.playerId) ?? 0) + 1);
    if (w.partnerId) tWins.set(w.partnerId, (tWins.get(w.partnerId) ?? 0) + 1);
  }

  const result: RankRow[] = players_.map((p) => {
    const a = acc.get(p.id) ?? { played: 0, won: 0, lost: 0, pf: 0, pa: 0, xp: 0 };
    const elo =
      discipline === "doubles"
        ? p.eloDoubles
        : discipline === "singles"
          ? p.eloSingles
          : Math.round((p.eloSingles + p.eloDoubles) / 2);
    const totalXp = a.xp + (tWins.get(p.id) ?? 0) * 250;
    return {
      player: p,
      played: a.played,
      won: a.won,
      lost: a.lost,
      pointDiff: a.pf - a.pa,
      winRate: a.played > 0 ? a.won / a.played : 0,
      elo,
      level: levelFromXp(totalXp).level,
      points: a.won * 3,
    };
  });

  result.sort(
    (x, y) => y.elo - x.elo || y.points - x.points || y.pointDiff - x.pointDiff,
  );
  return result;
}

export const getRanking = cachedQuery(getRankingImpl, ["ranking"]);

export const getTeamRanking = cachedQuery(
  async () => db.select().from(teams).orderBy(desc(teams.eloDoubles)),
  ["team-ranking"],
);
