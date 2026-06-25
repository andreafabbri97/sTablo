import { matchXp } from "./gamification";

/**
 * Pure stat-folding helpers, split out of stats.ts so they can be unit-tested
 * without pulling in the database / Next cache. stats.ts loads the rows from
 * Postgres and delegates the math here.
 */

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

export const EMPTY_STAT_LINE: StatLine = {
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

export type ResultRow = {
  format: "singles" | "doubles";
  won: boolean;
  pointsFor: number;
  pointsAgainst: number;
  playedAt: Date;
  ranked: boolean;
};

/** Fold an (unordered) list of results into a stat line. */
export function foldResults(rows: ResultRow[]): StatLine {
  if (rows.length === 0) return { ...EMPTY_STAT_LINE };
  const oldestFirst = [...rows].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime(),
  );

  const line: StatLine = { ...EMPTY_STAT_LINE };
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
export function xpFromResults(
  rows: ResultRow[],
  tournamentsWon: number,
): number {
  const matchXpTotal = rows.reduce(
    (sum, r) => sum + matchXp(r.won, r.pointsFor, r.pointsAgainst),
    0,
  );
  return matchXpTotal + tournamentsWon * 250;
}
