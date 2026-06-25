import { describe, it, expect } from "vitest";
import { foldResults, xpFromResults, type ResultRow } from "./stats-fold";
import { matchXp } from "./gamification";

function row(over: Partial<ResultRow> = {}): ResultRow {
  return {
    format: "singles",
    won: true,
    pointsFor: 10,
    pointsAgainst: 5,
    playedAt: new Date("2024-01-01T00:00:00Z"),
    ranked: true,
    ...over,
  };
}

/** Build a chronological run of results, oldest -> newest, won flags given. */
function run(wins: boolean[]): ResultRow[] {
  return wins.map((won, i) =>
    row({
      won,
      pointsFor: won ? 10 : 4,
      pointsAgainst: won ? 4 : 10,
      playedAt: new Date(Date.UTC(2024, 0, i + 1)),
    }),
  );
}

describe("foldResults", () => {
  it("returns an all-zero line for no results", () => {
    const line = foldResults([]);
    expect(line.played).toBe(0);
    expect(line.won).toBe(0);
    expect(line.lost).toBe(0);
    expect(line.winRate).toBe(0);
    expect(line.bestStreak).toBe(0);
    expect(line.currentStreak).toBe(0);
  });

  it("counts wins, losses, points and win rate", () => {
    const line = foldResults(run([true, true, false, true]));
    expect(line.played).toBe(4);
    expect(line.won).toBe(3);
    expect(line.lost).toBe(1);
    expect(line.winRate).toBeCloseTo(3 / 4);
    expect(line.pointsFor).toBe(10 + 10 + 4 + 10);
    expect(line.pointsAgainst).toBe(4 + 4 + 10 + 4);
    expect(line.pointDiff).toBe(line.pointsFor - line.pointsAgainst);
  });

  it("tracks the best win streak across the whole history", () => {
    // W W W L W W  -> best streak is 3
    const line = foldResults(run([true, true, true, false, true, true]));
    expect(line.bestStreak).toBe(3);
  });

  it("reports a positive current streak after recent wins", () => {
    const line = foldResults(run([false, true, true]));
    expect(line.currentStreak).toBe(2);
  });

  it("reports a negative current streak after recent losses", () => {
    const line = foldResults(run([true, false, false]));
    expect(line.currentStreak).toBe(-2);
  });

  it("is order-independent: it sorts by playedAt before folding", () => {
    const ordered = run([true, true, false]);
    const shuffled = [ordered[2], ordered[0], ordered[1]];
    expect(foldResults(shuffled)).toEqual(foldResults(ordered));
  });

  it("splits singles and doubles tallies", () => {
    const rows = [
      row({ format: "singles", won: true }),
      row({ format: "singles", won: false }),
      row({ format: "doubles", won: true }),
    ];
    const line = foldResults(rows);
    expect(line.singlesPlayed).toBe(2);
    expect(line.singlesWon).toBe(1);
    expect(line.doublesPlayed).toBe(1);
    expect(line.doublesWon).toBe(1);
  });
});

describe("xpFromResults", () => {
  it("is zero with no matches and no tournament wins", () => {
    expect(xpFromResults([], 0)).toBe(0);
  });

  it("adds 250 XP per tournament win", () => {
    expect(xpFromResults([], 3)).toBe(750);
  });

  it("sums matchXp over every row plus tournament bonus", () => {
    const rows = run([true, false, true]);
    const expectedMatchXp = rows.reduce(
      (s, r) => s + matchXp(r.won, r.pointsFor, r.pointsAgainst),
      0,
    );
    expect(xpFromResults(rows, 2)).toBe(expectedMatchXp + 500);
  });
});
