import { and, eq, or, desc } from "drizzle-orm";
import { db } from "./db";
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
  levelFromXp,
  matchXp,
  overall,
  type Attributes,
  type LevelInfo,
} from "./gamification";

export type StatLine = {
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  singlesPlayed: number;
  singlesWon: number;
  doublesPlayed: number;
  doublesWon: number;
};

const EMPTY: StatLine = {
  played: 0,
  won: 0,
  lost: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  pointDiff: 0,
  winRate: 0,
  bestStreak: 0,
  currentStreak: 0,
  singlesPlayed: 0,
  singlesWon: 0,
  doublesPlayed: 0,
  doublesWon: 0,
};

type ResultRow = {
  format: "singles" | "doubles";
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
  playedAt: Date;
  ranked: boolean;
};

/** Fold an ordered (newest-first) list of results into a stat line. */
export function foldResults(rows: ResultRow[]): StatLine {
  if (rows.length === 0) return { ...EMPTY };
  const oldestFirst = [...rows].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );

  const line: StatLine = { ...EMPTY };
  let streak = 0;
  let best = 0;

  for (const r of oldestFirst) {
    line.played++;
    line.pointsFor += r.pointsFor;
    line.pointsAgainst += r.pointsAgainst;
    if (r.format === "singles") {
      line.singlesPlayed++;
      if (r.won) line.singlesWon++;
    } else {
      line.doublesPlayed++;
      if (r.won) line.doublesWon++;
    }
    if (r.won) {
      line.won++;
      streak = streak >= 0 ? streak + 1 : 1;
      best = Math.max(best, streak);
    } else {
      line.lost++;
      streak = streak <= 0 ? streak - 1 : -1;
    }
  }

  line.pointDiff = line.pointsFor - line.pointsAgainst;
  line.winRate = line.played > 0 ? line.won / line.played : 0;
  line.bestStreak = best;
  line.currentStreak = streak;
  return line;
}

/** Total XP from a stat line plus tournament wins. */
export function xpFromResults(rows: ResultRow[], tournamentsWon: number) {
  const matchXpTotal = rows.reduce(
    (sum, r) => sum + matchXp(r.won, r.pointsFor, r.pointsAgainst),
    0,
  );
  return matchXpTotal + tournamentsWon * 250;
}

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
  stats: StatLine;
  level: LevelInfo;
  attributes: Attributes;
  overall: number;
};

export async function getPlayerWithStats(
  playerId: string,
): Promise<PlayerWithStats | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  });
  if (!player) return null;
  return buildPlayerWithStats(player);
}

export async function getPlayerWithStatsBySlug(
  slug: string,
): Promise<PlayerWithStats | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.slug, slug),
  });
  if (!player) return null;
  return buildPlayerWithStats(player);
}

async function buildPlayerWithStats(
  player: typeof players.$inferSelect,
): Promise<PlayerWithStats> {
  const rows = await loadResultRows(player.id);
  const tournamentsWon = await countTournamentWins(player.id);
  // Competitive record & Elo come from ranked matches; XP from all of them.
  const rankedRows = rows.filter((r) => r.ranked);
  const stats = foldResults(rankedRows);
  const totalXp = xpFromResults(rows, tournamentsWon);
  const level = levelFromXp(totalXp);
  const attributes = computeAttributes(
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
  return { player, stats, level, attributes, overall: overall(attributes) };
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

export async function getRanking(
  discipline: RankingDiscipline = "overall",
): Promise<RankRow[]> {
  const players_ = await db.select().from(players);
  const rows = await db
    .select({
      playerId: matchParticipants.playerId,
      side: matchParticipants.side,
      format: matches.format,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winner: matches.winner,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(and(eq(matches.status, "completed"), eq(matches.ranked, true)));

  const acc = new Map<
    string,
    { played: number; won: number; lost: number; pf: number; pa: number }
  >();

  for (const r of rows) {
    if (discipline !== "overall" && r.format !== discipline) continue;
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
    };
    cur.played++;
    cur.pf += pf;
    cur.pa += pa;
    if (won) cur.won++;
    else cur.lost++;
    acc.set(r.playerId, cur);
  }

  const result: RankRow[] = players_.map((p) => {
    const a = acc.get(p.id) ?? { played: 0, won: 0, lost: 0, pf: 0, pa: 0 };
    const elo =
      discipline === "doubles"
        ? p.eloDoubles
        : discipline === "singles"
          ? p.eloSingles
          : Math.round((p.eloSingles + p.eloDoubles) / 2);
    return {
      player: p,
      played: a.played,
      won: a.won,
      lost: a.lost,
      pointDiff: a.pf - a.pa,
      winRate: a.played > 0 ? a.won / a.played : 0,
      elo,
      level: 1,
      points: a.won * 3,
    };
  });

  result.sort(
    (x, y) => y.elo - x.elo || y.points - x.points || y.pointDiff - x.pointDiff,
  );
  return result;
}

export async function getTeamRanking() {
  return db.select().from(teams).orderBy(desc(teams.eloDoubles));
}
