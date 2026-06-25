import { describe, it, expect } from "vitest";
import { replayElo, type ReplayMatch } from "./elo-replay";

/**
 * Load / stress test for the Elo replay core.
 *
 * recomputeAllElo() replays the ENTIRE match history from scratch on every
 * confirmation, edit, undo or delete — so as the table grows, this pure core is
 * the hot path. These tests feed it a large, deterministic synthetic history to:
 *   1. catch any accidental O(n²) regression (loose wall-clock ceiling), and
 *   2. assert the rating math stays exactly conserved at volume.
 *
 * The dataset is generated with a seeded PRNG so the run is fully reproducible
 * (no Math.random) — same input every time, in CI and locally.
 */

const START = 1000;
const PLAYERS = 60;
const TEAMS = 12;
const MATCHES = 40_000;
// Intentionally loose: a healthy linear replay does 40k matches in well under a
// second. This only trips on a pathological (e.g. quadratic) regression, so it
// won't flake on a slow CI box.
const TIME_BUDGET_MS = 8_000;

/** Deterministic PRNG (mulberry32) — keeps the load test reproducible. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHistory(seed: number): {
  playerIds: string[];
  teamIds: string[];
  matches: ReplayMatch[];
} {
  const rand = mulberry32(seed);
  const pick = (n: number) => Math.floor(rand() * n);

  const playerIds = Array.from({ length: PLAYERS }, (_, i) => `p${i}`);
  const teamIds = Array.from({ length: TEAMS }, (_, i) => `t${i}`);

  /** distinct random player indices */
  const distinct = (count: number): number[] => {
    const set = new Set<number>();
    while (set.size < count) set.add(pick(PLAYERS));
    return [...set];
  };

  const score = (): [number, number] => {
    const loser = pick(14); // 0..13
    return rand() < 0.5 ? [15, loser] : [loser, 15];
  };

  const matches: ReplayMatch[] = [];
  for (let i = 0; i < MATCHES; i++) {
    const id = `m${i}`;
    const [scoreA, scoreB] = score();
    if (rand() < 0.55) {
      // singles
      const [a, b] = distinct(2);
      matches.push({
        id,
        format: "singles",
        scoreA,
        scoreB,
        participants: [
          { id: `${id}-0`, side: "A", playerId: `p${a}`, teamId: null },
          { id: `${id}-1`, side: "B", playerId: `p${b}`, teamId: null },
        ],
      });
    } else {
      // doubles — sometimes side A is a registered team
      const [a1, a2, b1, b2] = distinct(4);
      const teamA = rand() < 0.4 ? `t${pick(TEAMS)}` : null;
      const teamB = rand() < 0.2 ? `t${pick(TEAMS)}` : null;
      matches.push({
        id,
        format: "doubles",
        scoreA,
        scoreB,
        participants: [
          { id: `${id}-0`, side: "A", playerId: `p${a1}`, teamId: teamA },
          { id: `${id}-1`, side: "A", playerId: `p${a2}`, teamId: teamA },
          { id: `${id}-2`, side: "B", playerId: `p${b1}`, teamId: teamB },
          { id: `${id}-3`, side: "B", playerId: `p${b2}`, teamId: teamB },
        ],
      });
    }
  }
  return { playerIds, teamIds, matches };
}

describe("replayElo — load / stress", () => {
  const input = { ...buildHistory(0xc0ffee), startingElo: START };

  it(
    `replays ${MATCHES.toLocaleString()} matches under ${TIME_BUDGET_MS}ms`,
    { timeout: 30_000 },
    () => {
      const t0 = performance.now();
      const result = replayElo(input);
      const elapsed = performance.now() - t0;

      // every valid match contributes one history row per participant
      const expectedRows = input.matches.reduce(
        (sum, m) => sum + m.participants.length,
        0,
      );
      const playerRows = result.history.filter(
        (h) => h.subject !== "team",
      ).length;
      expect(playerRows).toBe(expectedRows);
      expect(result.participantRatings).toHaveLength(expectedRows);

      expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
    },
  );

  it("conserves total Elo exactly (zero-sum across all players)", () => {
    const result = replayElo(input);
    // Each balanced match applies +d to one side and -d to the other in equal
    // numbers, so the grand total can never drift from the starting pool.
    let total = 0;
    for (const r of result.players.values()) {
      total += r.eloSingles + r.eloDoubles;
    }
    expect(total).toBe(PLAYERS * 2 * START);

    // sum of every applied delta (players) must be exactly zero
    const deltaSum = result.history
      .filter((h) => h.subject !== "team")
      .reduce((s, h) => s + h.delta, 0);
    expect(deltaSum).toBe(0);
  });

  it("keeps ratings finite and peak ≥ current ≥ floor sanity", () => {
    const result = replayElo(input);
    for (const r of result.players.values()) {
      expect(Number.isFinite(r.eloSingles)).toBe(true);
      expect(Number.isFinite(r.eloDoubles)).toBe(true);
      // peak never below the start and never below the current best line
      expect(r.peak).toBeGreaterThanOrEqual(START);
      expect(r.peak).toBeGreaterThanOrEqual(
        Math.max(r.eloSingles, r.eloDoubles),
      );
    }
  });

  it("is deterministic at volume — same input, identical final ratings", () => {
    const a = replayElo(input);
    const b = replayElo(input);
    for (const id of input.playerIds) {
      expect(b.players.get(id)).toEqual(a.players.get(id));
    }
  });
});
