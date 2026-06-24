import { describe, it, expect } from "vitest";
import { DEMO_SINGLES, DEMO_DOUBLES, DEMO_TOTAL } from "./demo-data";
import { validateTavolinoScore } from "./score-rules";

/**
 * Guards against the bug that put 18-9 / 18-17 / 20-18 demo rows on production:
 * every demo fixture must be a legal tavolino result (win at 15, vantaggi with a
 * 2-point gap, killer point 20-19). insertDemoMatches enforces the same at write
 * time, but proving it on the pure data fails fast in CI.
 */
describe("demo fixtures respect the tavolino rule", () => {
  it.each(DEMO_SINGLES.map((s, i) => [i, s] as const))(
    "singles #%i (%o) is a valid score",
    (_i, [, , sa, sb]) => {
      expect(validateTavolinoScore(sa, sb)).toEqual({ ok: true });
    },
  );

  it.each(DEMO_DOUBLES.map((d, i) => [i, d] as const))(
    "doubles #%i (%o) is a valid score",
    (_i, [, , sa, sb]) => {
      expect(validateTavolinoScore(sa, sb)).toEqual({ ok: true });
    },
  );

  it("never ends a demo match in a draw", () => {
    for (const [, , sa, sb] of [...DEMO_SINGLES, ...DEMO_DOUBLES]) {
      expect(sa).not.toBe(sb);
    }
  });

  it("DEMO_TOTAL matches the number of fixtures", () => {
    expect(DEMO_TOTAL).toBe(DEMO_SINGLES.length + DEMO_DOUBLES.length);
  });
});
