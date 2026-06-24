import { describe, it, expect } from "vitest";
import {
  expectedScore,
  movMultiplier,
  computeElo,
  sideRating,
  DEFAULT_K,
} from "./elo";

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it("is complementary: P(A beats B) + P(B beats A) === 1", () => {
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(1, 12);
  });

  it("gives the stronger rating the higher probability", () => {
    expect(expectedScore(1600, 1400)).toBeGreaterThan(0.5);
    expect(expectedScore(1400, 1600)).toBeLessThan(0.5);
  });

  it("treats a 400-point edge as ~10:1 odds", () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 6);
  });
});

describe("movMultiplier", () => {
  it("grows with a bigger winning margin", () => {
    expect(movMultiplier(10, 1500, 1500)).toBeGreaterThan(
      movMultiplier(2, 1500, 1500),
    );
  });

  it("depends only on the absolute margin (sign-independent)", () => {
    expect(movMultiplier(-8, 1500, 1500)).toBe(movMultiplier(8, 1500, 1500));
  });

  it("damps the gain when a strong favorite wins", () => {
    const favoriteWins = movMultiplier(8, 1800, 1200);
    const evenMatch = movMultiplier(8, 1500, 1500);
    expect(favoriteWins).toBeLessThan(evenMatch);
  });

  it("matches the closed-form formula", () => {
    const margin = 4;
    const winner = 1600;
    const loser = 1400;
    const expected =
      Math.log(margin + 1) * (2.2 / ((winner - loser) * 0.001 + 2.2));
    expect(movMultiplier(margin, winner, loser)).toBeCloseTo(expected, 12);
  });
});

describe("computeElo", () => {
  it("is zero-sum: deltaB === -deltaA and ratings move by their deltas", () => {
    const r = computeElo({ ratingA: 1500, ratingB: 1500, scoreA: 15, scoreB: 10 });
    expect(r.deltaB).toBe(-r.deltaA);
    expect(r.newA).toBe(1500 + r.deltaA);
    expect(r.newB).toBe(1500 + r.deltaB);
  });

  it("rewards the winner and penalises the loser", () => {
    const r = computeElo({ ratingA: 1500, ratingB: 1500, scoreA: 15, scoreB: 8 });
    expect(r.deltaA).toBeGreaterThan(0);
    expect(r.deltaB).toBeLessThan(0);
  });

  it("moves ratings more for an upset than for an expected win", () => {
    const upset = computeElo({ ratingA: 1300, ratingB: 1700, scoreA: 15, scoreB: 13 });
    const expectedResult = computeElo({
      ratingA: 1700,
      ratingB: 1300,
      scoreA: 15,
      scoreB: 13,
    });
    expect(upset.deltaA).toBeGreaterThan(expectedResult.deltaA);
  });

  it("produces a deterministic result for a known even matchup", () => {
    // expected 0.5, margin 5 → mult = ln(6); delta = round(32 * ln6 * 0.5) = 29
    const r = computeElo({ ratingA: 1500, ratingB: 1500, scoreA: 15, scoreB: 10 });
    expect(r).toEqual({ newA: 1529, newB: 1471, deltaA: 29, deltaB: -29 });
  });

  it("honours a custom K factor (smaller K → smaller swing)", () => {
    const base = computeElo({ ratingA: 1500, ratingB: 1500, scoreA: 15, scoreB: 10 });
    const damped = computeElo({
      ratingA: 1500,
      ratingB: 1500,
      scoreA: 15,
      scoreB: 10,
      k: 16,
    });
    expect(Math.abs(damped.deltaA)).toBeLessThan(Math.abs(base.deltaA));
  });

  it("defaults K to 32", () => {
    expect(DEFAULT_K).toBe(32);
  });
});

describe("sideRating", () => {
  it("returns the lone rating for a singles side", () => {
    expect(sideRating([1480])).toBe(1480);
  });

  it("averages a doubles side and rounds half up", () => {
    expect(sideRating([1500, 1400])).toBe(1450);
    expect(sideRating([1500, 1401])).toBe(1451); // 1450.5 → 1451
  });

  it("defaults an empty side to 1000", () => {
    expect(sideRating([])).toBe(1000);
  });
});
