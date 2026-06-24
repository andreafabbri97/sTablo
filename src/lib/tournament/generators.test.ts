import { describe, it, expect } from "vitest";
import {
  roundRobinRounds,
  generateRoundRobin,
  seedOrder,
  generateSingleElim,
  generateSwissRound1,
  generateAmericano,
  defaultAmericanoRounds,
  splitIntoGroups,
  GROUP_LABELS,
} from "./generators";

/** Order-independent key for an unordered pair of entrant indices. */
const pairKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

describe("roundRobinRounds", () => {
  it("schedules every pair exactly once for even n", () => {
    const rounds = roundRobinRounds(4);
    expect(rounds).toHaveLength(3); // n - 1 rounds

    const seen = new Map<string, number>();
    for (const round of rounds) {
      expect(round).toHaveLength(2); // n / 2 games per round
      for (const [a, b] of round) seen.set(pairKey(a, b), (seen.get(pairKey(a, b)) ?? 0) + 1);
    }
    expect(seen.size).toBe(6); // C(4,2)
    for (const count of seen.values()) expect(count).toBe(1);
  });

  it("lets each player appear once per round (even n)", () => {
    const rounds = roundRobinRounds(6);
    expect(rounds).toHaveLength(5);
    for (const round of rounds) {
      const players = round.flat();
      expect(new Set(players).size).toBe(6); // all six, no repeats
    }
  });

  it("handles odd n with a rotating bye (no -1 leaks, every pair once)", () => {
    const rounds = roundRobinRounds(5);
    expect(rounds).toHaveLength(5); // padded to 6 → m - 1
    const seen = new Set<string>();
    for (const round of rounds) {
      expect(round).toHaveLength(2); // one player rests each round
      for (const [a, b] of round) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(b).toBeGreaterThanOrEqual(0);
        seen.add(pairKey(a, b));
      }
    }
    expect(seen.size).toBe(10); // C(5,2)
  });
});

describe("generateRoundRobin", () => {
  it("emits one league GenMatch per pairing with both entrants set", () => {
    const matches = generateRoundRobin(4, { stage: "league" });
    expect(matches).toHaveLength(6);
    for (const m of matches) {
      expect(m.stage).toBe("league");
      expect(m.aEntrant).not.toBeNull();
      expect(m.bEntrant).not.toBeNull();
    }
  });

  it("doubles the fixtures for a double round-robin", () => {
    const single = generateRoundRobin(4, { stage: "league" });
    const double = generateRoundRobin(4, { stage: "league", doubleRound: true });
    expect(double).toHaveLength(single.length * 2);
  });

  it("tags group matches with the group name and stage", () => {
    const matches = generateRoundRobin(4, { stage: "group", groupName: "A" });
    expect(matches.every((m) => m.groupName === "A" && m.stage === "group")).toBe(true);
  });
});

describe("seedOrder", () => {
  it("orders a 4-bracket as 1v4 / 2v3", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
  });

  it("orders an 8-bracket in standard seeding", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("pairs adjacent slots so each sums to size + 1, every seed once", () => {
    const order = seedOrder(16);
    expect(order).toHaveLength(16);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(17);
    }
    expect(new Set(order).size).toBe(16);
  });
});

describe("generateSingleElim", () => {
  it("builds a full bracket for a power-of-two field (n=4)", () => {
    const m = generateSingleElim(4);
    const r1 = m.filter((x) => x.round === 1);
    const r2 = m.filter((x) => x.round === 2);
    expect(m).toHaveLength(3); // 2 semis + final
    expect(r1).toHaveLength(2);
    expect(r2).toHaveLength(1);

    // top seed (entrant 0) faces bottom seed (entrant 3)
    expect(r1[0].aEntrant).toBe(0);
    expect(r1[0].bEntrant).toBe(3);

    // both semis feed the final, on opposite slots
    expect(r1[0].nextLocalId).toBe(r2[0].localId);
    expect(r1[1].nextLocalId).toBe(r2[0].localId);
    expect(r1[0].nextSlot).toBe("A");
    expect(r1[1].nextSlot).toBe("B");
  });

  it("gives byes to top seeds when n is not a power of two (n=6)", () => {
    const m = generateSingleElim(6);
    const r1 = m.filter((x) => x.round === 1);
    expect(r1).toHaveLength(4); // bracket padded to 8
    const byes = r1.filter((x) => x.aEntrant === null || x.bEntrant === null);
    expect(byes).toHaveLength(2); // 8 - 6 missing entrants
  });

  it("wires the two semifinal losers into a 3rd-place final when asked", () => {
    const m = generateSingleElim(4, { thirdPlace: true });
    const third = m.find((x) => x.label === "Finale 3°/4°");
    expect(third).toBeDefined();
    const semis = m.filter((x) => x.round === 1);
    expect(semis[0].loserNextLocalId).toBe(third!.localId);
    expect(semis[1].loserNextLocalId).toBe(third!.localId);
    expect(semis[0].loserNextSlot).toBe("A");
    expect(semis[1].loserNextSlot).toBe("B");
  });

  it("skips the 3rd-place final when there are fewer than 4 entrants", () => {
    const m = generateSingleElim(3, { thirdPlace: true });
    expect(m.find((x) => x.label === "Finale 3°/4°")).toBeUndefined();
  });
});

describe("generateSwissRound1", () => {
  it("pairs the top half against the bottom half by seed (even n)", () => {
    const m = generateSwissRound1(4);
    expect(m).toHaveLength(2);
    expect([m[0].aEntrant, m[0].bEntrant]).toEqual([0, 2]);
    expect([m[1].aEntrant, m[1].bEntrant]).toEqual([1, 3]);
    expect(m.every((x) => x.stage === "swiss" && x.round === 1)).toBe(true);
    expect(m.some((x) => x.isBye)).toBe(false);
  });

  it("hands the unpaired entrant a bye for odd n", () => {
    const m = generateSwissRound1(5);
    const bye = m.find((x) => x.isBye);
    expect(bye).toBeDefined();
    expect(bye!.bEntrant).toBeNull();
    expect(bye!.label).toBe("Riposo");
  });
});

describe("generateAmericano", () => {
  it("returns nothing for fewer than 4 players", () => {
    expect(generateAmericano(3, 5)).toEqual([]);
    expect(generateAmericano(0, 5)).toEqual([]);
  });

  it("creates one court of 4 distinct players per round (n=4)", () => {
    const sched = generateAmericano(4, 3);
    expect(sched).toHaveLength(3); // 1 court × 3 rounds
    for (const game of sched) {
      const four = [...game.a, ...game.b];
      expect(new Set(four).size).toBe(4);
      expect(four.every((p) => p >= 0 && p < 4)).toBe(true);
    }
    expect(sched.map((g) => g.round)).toEqual([1, 2, 3]);
  });

  it("rotates partnerships so a player isn't always paired with the same partner", () => {
    const sched = generateAmericano(4, 3);
    const partnersOfZero = sched.map((g) => {
      const side = g.a.includes(0) ? g.a : g.b;
      return side.find((p) => p !== 0);
    });
    expect(new Set(partnersOfZero).size).toBeGreaterThan(1);
  });

  it("runs multiple courts when n is a multiple of 4 (n=8)", () => {
    const sched = generateAmericano(8, 2);
    expect(sched.filter((g) => g.round === 1)).toHaveLength(2); // 8 / 4 courts
  });
});

describe("defaultAmericanoRounds", () => {
  it("is 0 below the 4-player minimum", () => {
    expect(defaultAmericanoRounds(3)).toBe(0);
  });

  it("never drops below 3 rounds", () => {
    expect(defaultAmericanoRounds(4)).toBe(3);
  });

  it("tracks roughly one rotation (n-1) in the mid range", () => {
    expect(defaultAmericanoRounds(8)).toBe(7);
  });

  it("caps at 12 rounds for large fields", () => {
    expect(defaultAmericanoRounds(20)).toBe(12);
  });
});

describe("splitIntoGroups", () => {
  it("distributes entrants snake-style (n=8, 2 groups)", () => {
    const groups = splitIntoGroups(8, 2);
    expect(groups).toEqual([
      [0, 3, 4, 7],
      [1, 2, 5, 6],
    ]);
  });

  it("places every entrant exactly once", () => {
    const all = splitIntoGroups(10, 3).flat().sort((a, b) => a - b);
    expect(all).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("snakes the top seeds across groups (n=8, 4 groups)", () => {
    const groups = splitIntoGroups(8, 4);
    expect(groups[0]).toEqual([0, 7]);
    expect(groups[3]).toEqual([3, 4]); // seed 3 then seed 4 — snake reverses
  });
});

describe("GROUP_LABELS", () => {
  it("exposes single-letter labels A..H", () => {
    expect(GROUP_LABELS).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
  });
});
