import { describe, it, expect } from "vitest";
import {
  ATTRIBUTE_FLOOR,
  ATTRIBUTE_KEYS,
  baselineAttributes,
  clampToBudget,
  fillToBudget,
  hasCustomAttributes,
  levelAttributeCap,
  levelStatBudget,
  overall,
  resolveAttributes,
  type Attributes,
} from "./gamification";

const sum = (a: Attributes) => ATTRIBUTE_KEYS.reduce((s, k) => s + a[k], 0);

const flat = (n: number): Attributes => ({
  potenza: n,
  tecnica: n,
  costanza: n,
  difesa: n,
  clutch: n,
});

describe("levelStatBudget / levelAttributeCap", () => {
  it("grow with level and stay within sane bounds", () => {
    expect(levelStatBudget(1)).toBeLessThan(levelStatBudget(10));
    expect(levelStatBudget(10)).toBeLessThan(levelStatBudget(30));
    // The cap reaches 99 only in the low-30s levels, never before.
    expect(levelAttributeCap(1)).toBeLessThan(99);
    expect(levelAttributeCap(5)).toBeLessThan(60);
    expect(levelAttributeCap(40)).toBe(99);
  });

  it("budget is always fully allocatable given the per-attribute cap", () => {
    for (const lvl of [1, 5, 10, 20, 33, 50]) {
      expect(levelStatBudget(lvl)).toBeLessThanOrEqual(
        levelAttributeCap(lvl) * ATTRIBUTE_KEYS.length,
      );
      // ...and always above the floor sum, so a valid card exists.
      expect(levelStatBudget(lvl)).toBeGreaterThanOrEqual(
        ATTRIBUTE_FLOOR * ATTRIBUTE_KEYS.length,
      );
    }
  });
});

describe("clampToBudget", () => {
  it("never exceeds the budget and respects floor/cap", () => {
    const out = clampToBudget(flat(99), 240, 57);
    expect(sum(out)).toBeLessThanOrEqual(240);
    for (const k of ATTRIBUTE_KEYS) {
      expect(out[k]).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR);
      expect(out[k]).toBeLessThanOrEqual(57);
    }
  });

  it("leaves an already-valid set untouched", () => {
    const valid = { potenza: 50, tecnica: 48, costanza: 46, difesa: 44, clutch: 40 };
    const out = clampToBudget(valid, 240, 57);
    expect(out).toEqual(valid);
  });

  it("shaves from the largest attributes first", () => {
    // budget forces a 1-point trim; the biggest stat should take the hit.
    const out = clampToBudget(
      { potenza: 60, tecnica: 50, costanza: 50, difesa: 50, clutch: 50 },
      259,
      99,
    );
    expect(sum(out)).toBe(259);
    expect(out.potenza).toBe(59);
  });
});

describe("baselineAttributes", () => {
  it("brings a strong derived card within the level budget", () => {
    const derived = flat(90);
    const baseline = baselineAttributes(derived, 5);
    expect(sum(baseline)).toBeLessThanOrEqual(levelStatBudget(5));
    for (const k of ATTRIBUTE_KEYS) {
      expect(baseline[k]).toBeLessThanOrEqual(levelAttributeCap(5));
    }
  });

  it("spends the whole budget on a weak derived card, lifting it evenly", () => {
    const derived = flat(20); // sum 100, well under the level-10 budget
    const baseline = baselineAttributes(derived, 10);
    // Five equal stats stay equal and share the full budget between them.
    expect(sum(baseline)).toBe(levelStatBudget(10));
    expect(baseline).toEqual(flat(levelStatBudget(10) / ATTRIBUTE_KEYS.length));
    for (const k of ATTRIBUTE_KEYS) {
      expect(baseline[k]).toBeLessThanOrEqual(levelAttributeCap(10));
    }
  });
});

describe("fillToBudget — the auto card uses every point", () => {
  const shapes: Attributes[] = [
    flat(20),
    flat(50),
    flat(90),
    { potenza: 39, tecnica: 47, costanza: 37, difesa: 60, clutch: 38 },
  ];

  it("always spends the entire level budget, within floor/cap", () => {
    for (const lvl of [1, 5, 10, 20, 33]) {
      for (const s of shapes) {
        const b = baselineAttributes(s, lvl);
        expect(sum(b)).toBe(levelStatBudget(lvl));
        for (const k of ATTRIBUTE_KEYS) {
          expect(b[k]).toBeGreaterThanOrEqual(ATTRIBUTE_FLOOR);
          expect(b[k]).toBeLessThanOrEqual(levelAttributeCap(lvl));
        }
      }
    }
  });

  it("hands the leftover to the lowest stats first, leaving capped ones be", () => {
    // Lv1: budget 215, cap 51. This shape sums to 212 (difesa already capped),
    // so 3 points are free — they must land on the three lowest stats.
    const out = fillToBudget(
      { potenza: 39, tecnica: 47, costanza: 37, difesa: 51, clutch: 38 },
      215,
      51,
    );
    expect(sum(out)).toBe(215);
    expect(out.difesa).toBe(51); // at the cap → untouched
    expect(out).toEqual({
      potenza: 39,
      tecnica: 47,
      costanza: 39,
      difesa: 51,
      clutch: 39,
    });
  });

  it("never pushes a stat past the cap while filling", () => {
    const out = fillToBudget(flat(ATTRIBUTE_FLOOR), 215, 51);
    expect(sum(out)).toBe(215);
    for (const k of ATTRIBUTE_KEYS) expect(out[k]).toBeLessThanOrEqual(51);
  });

  it("makes resolved custom cards spend the whole budget too", () => {
    const out = resolveAttributes(flat(40), { potenza: 45 }, 1);
    expect(sum(out)).toBe(levelStatBudget(1));
  });
});

describe("resolveAttributes", () => {
  const derived = flat(40);

  it("returns the baseline when there are no overrides", () => {
    expect(resolveAttributes(derived, {}, 10)).toEqual(
      baselineAttributes(derived, 10),
    );
    expect(resolveAttributes(derived, null, 10)).toEqual(
      baselineAttributes(derived, 10),
    );
  });

  it("applies a partial override and re-validates against the budget", () => {
    const level = 10;
    const out = resolveAttributes(derived, { potenza: 65 }, level);
    expect(out.potenza).toBeLessThanOrEqual(levelAttributeCap(level));
    expect(sum(out)).toBeLessThanOrEqual(levelStatBudget(level));
  });

  it("can never exceed the per-attribute level cap, even if asked to", () => {
    const out = resolveAttributes(derived, { potenza: 99 }, 1);
    expect(out.potenza).toBeLessThanOrEqual(levelAttributeCap(1));
  });

  it("two players at the same level can never exceed the same total", () => {
    const level = 8;
    const a = resolveAttributes(flat(99), { potenza: 99, tecnica: 99 }, level);
    const b = resolveAttributes(flat(99), { difesa: 99, clutch: 99 }, level);
    expect(sum(a)).toBeLessThanOrEqual(levelStatBudget(level));
    expect(sum(b)).toBeLessThanOrEqual(levelStatBudget(level));
  });
});

describe("hasCustomAttributes", () => {
  it("detects real overrides only", () => {
    expect(hasCustomAttributes(null)).toBe(false);
    expect(hasCustomAttributes(undefined)).toBe(false);
    expect(hasCustomAttributes({})).toBe(false);
    expect(hasCustomAttributes({ potenza: 50 })).toBe(true);
  });
});

describe("overall stays in range", () => {
  it("matches a hand-computed average", () => {
    expect(overall(flat(50))).toBe(50);
    expect(
      overall({ potenza: 60, tecnica: 50, costanza: 50, difesa: 50, clutch: 40 }),
    ).toBe(50);
  });
});
