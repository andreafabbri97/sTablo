import { describe, it, expect } from "vitest";
import { computeInsights, FORM_LENGTH } from "./player-insights";
import type { ShapedMatch } from "./queries";

function player(id: string) {
  return {
    id,
    name: id.toUpperCase(),
    slug: id,
    username: null,
    colorIndex: 0,
    imageUrl: null,
  };
}

/** Build a completed singles match: `a` (side A) vs `b` (side B) with a score. */
function singles(
  id: string,
  a: string,
  b: string,
  scoreA: number,
  scoreB: number,
  playedAt: Date,
): ShapedMatch {
  return {
    id,
    format: "singles",
    ranked: true,
    status: "completed",
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? "A" : "B",
    playedAt,
    note: null,
    tournamentId: null,
    tournamentName: null,
    tournamentSlug: null,
    stage: null,
    groupName: null,
    round: null,
    proposedById: null,
    proposedSide: null,
    confirmDeadline: null,
    disputedAt: null,
    disputeReason: null,
    sideA: { label: a, teamName: null, players: [player(a)] },
    sideB: { label: b, teamName: null, players: [player(b)] },
  };
}

/** Build a completed doubles match: [a1,a2] vs [b1,b2]. */
function doubles(
  id: string,
  a: [string, string],
  b: [string, string],
  scoreA: number,
  scoreB: number,
  playedAt: Date,
): ShapedMatch {
  return {
    id,
    format: "doubles",
    ranked: true,
    status: "completed",
    scoreA,
    scoreB,
    winner: scoreA > scoreB ? "A" : "B",
    playedAt,
    note: null,
    tournamentId: null,
    tournamentName: null,
    tournamentSlug: null,
    stage: null,
    groupName: null,
    round: null,
    proposedById: null,
    proposedSide: null,
    confirmDeadline: null,
    disputedAt: null,
    disputeReason: null,
    sideA: { label: "A", teamName: null, players: a.map(player) },
    sideB: { label: "B", teamName: null, players: b.map(player) },
  };
}

const d = (n: number) => new Date(2026, 0, n);

describe("computeInsights — form strip", () => {
  it("is empty when the player has no completed matches", () => {
    const out = computeInsights("me", []);
    expect(out.form).toEqual([]);
    expect(out.nemesis).toBeNull();
    expect(out.victim).toBeNull();
    expect(out.bestPartner).toBeNull();
  });

  it("returns the most recent results first, capped at FORM_LENGTH", () => {
    const ms: ShapedMatch[] = [];
    for (let i = 1; i <= FORM_LENGTH + 3; i++) {
      // me wins the even days, loses the odd days
      const meWins = i % 2 === 0;
      ms.push(singles(`m${i}`, "me", "opp", meWins ? 15 : 5, meWins ? 5 : 15, d(i)));
    }
    const out = computeInsights("me", ms);
    expect(out.form).toHaveLength(FORM_LENGTH);
    // newest first → the highest day index leads
    expect(out.form[0].matchId).toBe(`m${FORM_LENGTH + 3}`);
    expect(out.form[0].won).toBe((FORM_LENGTH + 3) % 2 === 0);
  });

  it("ignores matches the player did not take part in", () => {
    const ms = [singles("m1", "x", "y", 15, 3, d(1))];
    expect(computeInsights("me", ms).form).toEqual([]);
  });

  it("ignores non-completed matches", () => {
    const m = singles("m1", "me", "opp", 15, 3, d(1));
    const scheduled: ShapedMatch = { ...m, status: "scheduled", winner: null };
    expect(computeInsights("me", [scheduled]).form).toEqual([]);
  });
});

describe("computeInsights — nemesis & favourite victim", () => {
  it("nemesis is the opponent who beats the player most; victim the one beaten most", () => {
    const ms = [
      // vs strong: me loses 3, wins 0
      singles("a1", "me", "strong", 5, 15, d(1)),
      singles("a2", "me", "strong", 9, 15, d(2)),
      singles("a3", "me", "strong", 12, 15, d(3)),
      // vs weak: me wins 3, loses 0
      singles("b1", "me", "weak", 15, 4, d(4)),
      singles("b2", "me", "weak", 15, 8, d(5)),
      singles("b3", "me", "weak", 15, 10, d(6)),
    ];
    const out = computeInsights("me", ms);
    expect(out.nemesis?.player.id).toBe("strong");
    expect(out.nemesis?.lost).toBe(3);
    expect(out.victim?.player.id).toBe("weak");
    expect(out.victim?.won).toBe(3);
  });

  it("ignores rivalries below the minimum encounter count", () => {
    const ms = [singles("a1", "me", "rare", 5, 15, d(1))]; // only 1 encounter
    const out = computeInsights("me", ms);
    expect(out.nemesis).toBeNull();
    expect(out.victim).toBeNull();
  });
});

describe("computeInsights — best partner", () => {
  it("picks the doubles partner with the best win-rate together", () => {
    const ms = [
      // with good: win twice
      doubles("d1", ["me", "good"], ["x", "y"], 15, 7, d(1)),
      doubles("d2", ["me", "good"], ["x", "y"], 15, 9, d(2)),
      // with bad: lose twice
      doubles("d3", ["me", "bad"], ["x", "y"], 6, 15, d(3)),
      doubles("d4", ["me", "bad"], ["x", "y"], 8, 15, d(4)),
    ];
    const out = computeInsights("me", ms);
    expect(out.bestPartner?.player.id).toBe("good");
    expect(out.bestPartner?.won).toBe(2);
    expect(out.bestPartner?.played).toBe(2);
  });

  it("does not treat singles opponents as partners", () => {
    const ms = [
      singles("s1", "me", "opp", 15, 3, d(1)),
      singles("s2", "me", "opp", 15, 6, d(2)),
    ];
    expect(computeInsights("me", ms).bestPartner).toBeNull();
  });
});
