/**
 * Elo rating engine with margin-of-victory scaling.
 *
 * Used for singles (player.eloSingles), doubles (player.eloDoubles, averaged
 * per side) and registered teams (team.eloDoubles).
 */

export const DEFAULT_K = 32;

/** Probability that A beats B given their ratings. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Margin-of-victory multiplier (FiveThirtyEight-style). A bigger point gap
 * moves ratings more, while the rating-diff damping prevents favorites from
 * farming rating against much weaker opponents.
 */
export function movMultiplier(
  scoreDiff: number,
  winnerRating: number,
  loserRating: number,
): number {
  const margin = Math.abs(scoreDiff);
  const ratingDiff = winnerRating - loserRating;
  return Math.log(margin + 1) * (2.2 / (ratingDiff * 0.001 + 2.2));
}

export type EloResult = {
  newA: number;
  newB: number;
  deltaA: number;
  deltaB: number;
};

/**
 * Compute new ratings for a completed match. `scoreA`/`scoreB` are the exact
 * points (e.g. 15-11). Higher score wins.
 */
export function computeElo(params: {
  ratingA: number;
  ratingB: number;
  scoreA: number;
  scoreB: number;
  k?: number;
}): EloResult {
  const { ratingA, ratingB, scoreA, scoreB, k = DEFAULT_K } = params;
  const aWon = scoreA > scoreB;

  const expectedA = expectedScore(ratingA, ratingB);
  const actualA = aWon ? 1 : 0;

  const winnerRating = aWon ? ratingA : ratingB;
  const loserRating = aWon ? ratingB : ratingA;
  const mult = movMultiplier(scoreA - scoreB, winnerRating, loserRating);

  const deltaA = Math.round(k * mult * (actualA - expectedA));
  const deltaB = -deltaA;

  return {
    newA: ratingA + deltaA,
    newB: ratingB + deltaB,
    deltaA,
    deltaB,
  };
}

/** Average rating of a side (1 player for singles, 2 for doubles). */
export function sideRating(ratings: number[]): number {
  if (ratings.length === 0) return 1000;
  return Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length);
}
