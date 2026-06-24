import { describe, it, expect } from "vitest";
import {
  knockoutFinalWinner,
  shouldGenerateKnockout,
  THIRD_PLACE_NOTE,
  type KnockoutMatch,
} from "./knockout";

/** Minimal knockout match builder; sensible defaults, override what matters. */
function km(partial: Partial<KnockoutMatch>): KnockoutMatch {
  return {
    entrantAId: null,
    entrantBId: null,
    winner: null,
    status: "scheduled",
    stage: "knockout",
    round: 1,
    nextMatchId: null,
    note: null,
    ...partial,
  };
}

// A 4-entrant bracket: two semis (round 1) feeding the final (round 2),
// plus an optional 3rd-place play-off sharing round 2.
function bracket(opts: {
  finalDone?: boolean;
  finalWinner?: "A" | "B";
  withThirdPlace?: boolean;
}): KnockoutMatch[] {
  const semis = [
    km({ round: 1, nextMatchId: "F", status: "completed", winner: "A", entrantAId: "a" }),
    km({ round: 1, nextMatchId: "F", status: "completed", winner: "A", entrantAId: "c" }),
  ];
  const final = km({
    round: 2,
    nextMatchId: null,
    entrantAId: "a",
    entrantBId: "c",
    status: opts.finalDone ? "completed" : "scheduled",
    winner: opts.finalDone ? (opts.finalWinner ?? "A") : null,
  });
  const matches = [...semis, final];
  if (opts.withThirdPlace) {
    matches.push(
      km({
        round: 2,
        nextMatchId: null,
        note: THIRD_PLACE_NOTE,
        status: "completed",
        winner: "A",
        entrantAId: "b",
        entrantBId: "d",
      }),
    );
  }
  return matches;
}

describe("knockoutFinalWinner", () => {
  it("returns undecided when there are no knockout matches", () => {
    expect(knockoutFinalWinner([])).toEqual({ decided: false, winnerEntrantId: null });
  });

  it("ignores non-knockout stages", () => {
    const matches = [
      km({ stage: "group", round: 1, status: "completed", winner: "A", entrantAId: "x" }),
    ];
    expect(knockoutFinalWinner(matches)).toEqual({ decided: false, winnerEntrantId: null });
  });

  it("is undecided while the final is still scheduled", () => {
    expect(knockoutFinalWinner(bracket({ finalDone: false }))).toEqual({
      decided: false,
      winnerEntrantId: null,
    });
  });

  it("crowns side A's entrant when the final is won by A", () => {
    expect(knockoutFinalWinner(bracket({ finalDone: true, finalWinner: "A" }))).toEqual({
      decided: true,
      winnerEntrantId: "a",
    });
  });

  it("crowns side B's entrant when the final is won by B", () => {
    expect(knockoutFinalWinner(bracket({ finalDone: true, finalWinner: "B" }))).toEqual({
      decided: true,
      winnerEntrantId: "c",
    });
  });

  it("never mistakes the 3rd/4th place play-off for the final", () => {
    // Final still pending, but a completed 3rd-place match shares the top round.
    const matches = bracket({ finalDone: false, withThirdPlace: true });
    expect(knockoutFinalWinner(matches)).toEqual({
      decided: false,
      winnerEntrantId: null,
    });
  });

  it("reads the real final even when a 3rd-place match is also completed", () => {
    const matches = bracket({ finalDone: true, finalWinner: "B", withThirdPlace: true });
    expect(knockoutFinalWinner(matches)).toEqual({
      decided: true,
      winnerEntrantId: "c",
    });
  });

  it("treats the highest-round match with no nextMatch as the final", () => {
    // A deeper bracket: round 3 is the final.
    const matches = [
      km({ round: 1, nextMatchId: "Q", status: "completed", winner: "A" }),
      km({ round: 2, nextMatchId: "S", status: "completed", winner: "A" }),
      km({
        round: 3,
        nextMatchId: null,
        status: "completed",
        winner: "B",
        entrantAId: "x",
        entrantBId: "y",
      }),
    ];
    expect(knockoutFinalWinner(matches)).toEqual({
      decided: true,
      winnerEntrantId: "y",
    });
  });

  it("is undecided when only a 3rd-place match exists in the top round", () => {
    const matches = [
      km({ round: 1, nextMatchId: null, note: THIRD_PLACE_NOTE, status: "completed", winner: "A", entrantAId: "z" }),
    ];
    expect(knockoutFinalWinner(matches)).toEqual({
      decided: false,
      winnerEntrantId: null,
    });
  });
});

describe("shouldGenerateKnockout", () => {
  it("triggers once every group match is completed and no bracket exists", () => {
    const matches = [
      km({ stage: "group", status: "completed" }),
      km({ stage: "group", status: "completed" }),
      km({ stage: "group", status: "completed" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(true);
  });

  it("does not trigger while any group match is still pending", () => {
    const matches = [
      km({ stage: "group", status: "completed" }),
      km({ stage: "group", status: "scheduled" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(false);
  });

  it("does not trigger when a knockout bracket already exists", () => {
    const matches = [
      km({ stage: "group", status: "completed" }),
      km({ stage: "knockout", status: "scheduled" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(false);
  });

  it("stays blocked by a pending group match even if a bracket somehow exists", () => {
    const matches = [
      km({ stage: "group", status: "scheduled" }),
      km({ stage: "knockout", status: "scheduled" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(false);
  });

  it("ignores non-group, non-knockout stages when judging completion", () => {
    // A stray match in another stage must not hold the bracket back.
    const matches = [
      km({ stage: "group", status: "completed" }),
      km({ stage: "league", status: "scheduled" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(true);
  });

  it("treats a non-completed status (e.g. confirming) as not yet done", () => {
    const matches = [
      km({ stage: "group", status: "completed" }),
      km({ stage: "group", status: "confirming" }),
    ];
    expect(shouldGenerateKnockout(matches)).toBe(false);
  });
});
