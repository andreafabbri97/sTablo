import { describe, it, expect } from "vitest";
import {
  slugify,
  initials,
  colorFromString,
  pct,
  timeAgo,
  timeUntil,
  AVATAR_GRADIENTS,
} from "./utils";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Andrea Rossi")).toBe("andrea-rossi");
  });

  it("strips accents", () => {
    expect(slugify("Niccolò È")).toBe("niccolo-e");
  });

  it("collapses non-alphanumerics and trims edge hyphens", () => {
    expect(slugify("  --Ciao!! Mondo--  ")).toBe("ciao-mondo");
  });

  it("caps the length at 48 characters", () => {
    expect(slugify("a".repeat(100)).length).toBe(48);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Andrea Rossi")).toBe("AR");
  });

  it("handles a single name", () => {
    expect(initials("Madonna")).toBe("M");
  });

  it("ignores extra whitespace and uses at most two letters", () => {
    expect(initials("  mario   rossi   verdi ")).toBe("MR");
  });

  it("returns an empty string for an empty name", () => {
    expect(initials("   ")).toBe("");
  });
});

describe("colorFromString", () => {
  it("is deterministic", () => {
    expect(colorFromString("andrea")).toBe(colorFromString("andrea"));
  });

  it("stays within the gradient palette bounds", () => {
    for (const value of ["a", "andrea", "x9z", "🔥team", ""]) {
      const idx = colorFromString(value);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(AVATAR_GRADIENTS.length);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });
});

describe("pct", () => {
  it("computes a rounded percentage", () => {
    expect(pct(1, 4)).toBe(25);
    expect(pct(2, 3)).toBe(67);
    expect(pct(3, 3)).toBe(100);
  });

  it("guards against a zero or negative total", () => {
    expect(pct(5, 0)).toBe(0);
    expect(pct(5, -2)).toBe(0);
  });
});

describe("timeAgo", () => {
  it('says "adesso" within the last minute', () => {
    expect(timeAgo(new Date(Date.now() - 20_000))).toBe("adesso");
  });

  it("reports minutes, hours and days", () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000))).toMatch(/^\d+ min fa$/);
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000))).toMatch(
      /^\d+ ore fa$/,
    );
    expect(timeAgo(new Date(Date.now() - 1 * 3_600_000))).toBe("1 ora fa");
    expect(timeAgo(new Date(Date.now() - 4 * 86_400_000))).toMatch(
      /^\d+ giorni fa$/,
    );
  });
});

describe("timeUntil", () => {
  it('says "ora" for a past or present date', () => {
    expect(timeUntil(new Date(Date.now() - 1000))).toBe("ora");
  });

  it("counts down in minutes and hours", () => {
    expect(timeUntil(new Date(Date.now() + 5 * 60_000))).toMatch(
      /^fra \d+ min$/,
    );
    expect(timeUntil(new Date(Date.now() + 3 * 3_600_000))).toMatch(
      /^fra \d+ ore$/,
    );
  });
});
