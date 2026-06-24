import { describe, it, expect } from "vitest";
import {
  usernameSchema,
  registerSchema,
  matchSchema,
  tournamentSchema,
} from "./validation";

describe("usernameSchema", () => {
  it("normalises case and trims surrounding space", () => {
    expect(usernameSchema.parse("  MeSh_99 ")).toBe("mesh_99");
  });

  it("accepts 3-20 chars of [a-z0-9_]", () => {
    expect(usernameSchema.safeParse("abc").success).toBe(true);
    expect(usernameSchema.safeParse("a_1").success).toBe(true);
  });

  it("rejects too-short, too-long, or illegal characters", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    expect(usernameSchema.safeParse("with space").success).toBe(false);
    expect(usernameSchema.safeParse("dash-name").success).toBe(false);
  });
});

describe("registerSchema", () => {
  const base = {
    name: "Andrea",
    username: "andrea",
    password: "supersecret",
    confirm: "supersecret",
  };

  it("accepts a well-formed registration", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched password confirmation", () => {
    const r = registerSchema.safeParse({ ...base, confirm: "different" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].path).toEqual(["confirm"]);
    }
  });

  it("requires a password of at least 8 characters", () => {
    expect(
      registerSchema.safeParse({ ...base, password: "short", confirm: "short" })
        .success,
    ).toBe(false);
  });
});

describe("matchSchema", () => {
  const base = { format: "singles" as const, scoreA: 15, scoreB: 11 };

  it("coerces string scores to integers", () => {
    const r = matchSchema.parse({ ...base, scoreA: "15", scoreB: "9" });
    expect(r.scoreA).toBe(15);
    expect(r.scoreB).toBe(9);
    expect(r.ranked).toBe(true); // default
  });

  it("rejects a draw (equal scores)", () => {
    const r = matchSchema.safeParse({ ...base, scoreA: 12, scoreB: 12 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["scoreB"]);
  });

  it("rejects scores outside 0-99", () => {
    expect(matchSchema.safeParse({ ...base, scoreA: 100 }).success).toBe(false);
    expect(matchSchema.safeParse({ ...base, scoreB: -1 }).success).toBe(false);
  });
});

describe("tournamentSchema", () => {
  const base = {
    name: "Estate",
    discipline: "singles" as const,
    entrantIds: ["a", "b", "c", "d"],
  };

  it("requires at least 4 players for an Americano", () => {
    const ok = tournamentSchema.safeParse({ ...base, format: "americano" });
    expect(ok.success).toBe(true);

    const tooFew = tournamentSchema.safeParse({
      ...base,
      format: "americano",
      entrantIds: ["a", "b", "c"],
    });
    expect(tooFew.success).toBe(false);
    if (!tooFew.success) expect(tooFew.error.issues[0].path).toEqual(["entrantIds"]);
  });

  it("requires at least 2 entrants for a singles league", () => {
    const r = tournamentSchema.safeParse({
      ...base,
      format: "league",
      entrantIds: ["a"],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(["entrantIds"]);
  });

  it("requires at least 2 couples for a doubles tournament", () => {
    const tooFew = tournamentSchema.safeParse({
      name: "Coppie",
      format: "league",
      discipline: "doubles",
      entrantIds: [],
      pairs: [{ playerId: "p1", partnerId: "p2" }],
    });
    expect(tooFew.success).toBe(false);
    if (!tooFew.success) expect(tooFew.error.issues[0].path).toEqual(["pairs"]);

    const ok = tournamentSchema.safeParse({
      name: "Coppie",
      format: "league",
      discipline: "doubles",
      entrantIds: [],
      pairs: [
        { playerId: "p1", partnerId: "p2" },
        { playerId: "p3", partnerId: "p4" },
      ],
    });
    expect(ok.success).toBe(true);
  });
});
