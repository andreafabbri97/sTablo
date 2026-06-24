import { describe, it, expect } from "vitest";
import { validateTavolinoScore, TAVOLINO_TARGET } from "./score-rules";

describe("validateTavolinoScore — clean wins at 15", () => {
  it("accepts a win at 15 with the loser at most 13, in either order", () => {
    for (const l of [0, 5, 11, 13]) {
      expect(validateTavolinoScore(15, l).ok).toBe(true);
      expect(validateTavolinoScore(l, 15).ok).toBe(true); // sign/order independent
    }
  });

  it("rejects 15-14 — from 14-14 you must win by two", () => {
    const r = validateTavolinoScore(15, 14);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("vantaggi");
  });
});

describe("validateTavolinoScore — vantaggi (deuce)", () => {
  it("accepts a 2-point gap up to 19-17", () => {
    for (const [w, l] of [
      [16, 14],
      [17, 15],
      [18, 16],
      [19, 17],
    ]) {
      expect(validateTavolinoScore(w, l).ok).toBe(true);
    }
  });

  it("rejects deuce scores without an exact 2-point gap", () => {
    expect(validateTavolinoScore(18, 15).ok).toBe(false); // gap 3
    expect(validateTavolinoScore(17, 16).ok).toBe(false); // gap 1, not finished
  });

  it("rejects going past 15 against a loser who never reached 14", () => {
    const r = validateTavolinoScore(18, 3);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("15");
  });
});

describe("validateTavolinoScore — killer point", () => {
  it("accepts 20-19, in either order", () => {
    expect(validateTavolinoScore(20, 19).ok).toBe(true);
    expect(validateTavolinoScore(19, 20).ok).toBe(true);
  });

  it("rejects 20-18 and anything beyond the 20-point cap", () => {
    expect(validateTavolinoScore(20, 18).ok).toBe(false);
    expect(validateTavolinoScore(21, 19).ok).toBe(false);
    expect(validateTavolinoScore(25, 3).ok).toBe(false);
  });
});

describe("validateTavolinoScore — invalid basics", () => {
  it("rejects ties", () => {
    const r = validateTavolinoScore(10, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/parità/);
  });

  it("rejects when nobody reached the target", () => {
    expect(validateTavolinoScore(14, 10).ok).toBe(false);
    expect(validateTavolinoScore(13, 12).ok).toBe(false);
  });

  it("rejects negatives and non-integers", () => {
    expect(validateTavolinoScore(-1, 5).ok).toBe(false);
    expect(validateTavolinoScore(15.5, 10).ok).toBe(false);
  });
});

describe("validateTavolinoScore — custom target", () => {
  it("scales the whole rule to a target of 21", () => {
    expect(validateTavolinoScore(21, 18, 21).ok).toBe(true); // clean
    expect(validateTavolinoScore(22, 20, 21).ok).toBe(true); // deuce, +2
    expect(validateTavolinoScore(26, 25, 21).ok).toBe(true); // killer (21+5)-(21+4)
    expect(validateTavolinoScore(21, 20, 21).ok).toBe(false); // 15-14 analogue
    expect(validateTavolinoScore(27, 25, 21).ok).toBe(false); // beyond the cap
  });

  it("defaults the target to 15", () => {
    expect(TAVOLINO_TARGET).toBe(15);
    expect(validateTavolinoScore(15, 9)).toEqual(
      validateTavolinoScore(15, 9, TAVOLINO_TARGET),
    );
  });
});
