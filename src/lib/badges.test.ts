import { describe, it, expect } from "vitest";
import { BADGES, computeBadges, countEarned, type BadgeSignals } from "./badges";

const ZERO: BadgeSignals = {
  played: 0,
  won: 0,
  winRate: 0,
  bestStreak: 0,
  currentStreak: 0,
  peakElo: 1000,
  tournamentsWon: 0,
  level: 1,
};

describe("computeBadges", () => {
  it("a brand-new player has earned nothing", () => {
    expect(countEarned(ZERO)).toBe(0);
    const all = computeBadges(ZERO);
    expect(all).toHaveLength(BADGES.length);
    expect(all.every((b) => !b.earned)).toBe(true);
  });

  it("a maxed-out player earns every badge", () => {
    const god: BadgeSignals = {
      played: 120,
      won: 90,
      winRate: 0.75,
      bestStreak: 12,
      currentStreak: 4,
      peakElo: 1750,
      tournamentsWon: 3,
      level: 9,
    };
    expect(countEarned(god)).toBe(BADGES.length);
    expect(computeBadges(god).every((b) => b.earned)).toBe(true);
  });

  it("earned badges are listed before locked ones", () => {
    const mid: BadgeSignals = { ...ZERO, played: 12, won: 6, winRate: 0.5 };
    const list = computeBadges(mid);
    const firstLocked = list.findIndex((b) => !b.earned);
    const lastEarned = list.map((b) => b.earned).lastIndexOf(true);
    // every earned index comes before every locked index
    expect(lastEarned).toBeLessThan(firstLocked);
  });

  it("Cecchino needs both a 60% rate AND at least 10 games", () => {
    const fewGames: BadgeSignals = { ...ZERO, played: 5, won: 5, winRate: 1 };
    expect(computeBadges(fewGames).find((b) => b.id === "sharp")?.earned).toBe(
      false,
    );
    const enough: BadgeSignals = { ...ZERO, played: 10, won: 7, winRate: 0.7 };
    expect(computeBadges(enough).find((b) => b.id === "sharp")?.earned).toBe(
      true,
    );
  });

  it("a current losing streak never trips the streak badges", () => {
    const slump: BadgeSignals = { ...ZERO, played: 20, currentStreak: -5 };
    expect(computeBadges(slump).find((b) => b.id === "hot")?.earned).toBe(false);
  });
});
