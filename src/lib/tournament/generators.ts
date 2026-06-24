/**
 * Pure schedule/bracket generators. They emit abstract matches referencing
 * entrants by index (seeded order); the server action persists entrants first,
 * then maps indices -> entrant ids and local ids -> match ids.
 */

export type GenStage = "league" | "group" | "knockout" | "swiss";

export type GenMatch = {
  localId: string;
  stage: GenStage;
  groupName: string | null;
  round: number;
  slot: number;
  /** index into the (seeded) entrants array; null = TBD/bye */
  aEntrant: number | null;
  bEntrant: number | null;
  label: string | null;
  nextLocalId: string | null;
  nextSlot: "A" | "B" | null;
};

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

function emptyMatch(partial: Partial<GenMatch>): GenMatch {
  return {
    localId: id("m"),
    stage: "league",
    groupName: null,
    round: 1,
    slot: 0,
    aEntrant: null,
    bEntrant: null,
    label: null,
    nextLocalId: null,
    nextSlot: null,
    ...partial,
  };
}

/* ----------------------------------------------------------------------------
   Round robin (circle method) — used by league & group stages
---------------------------------------------------------------------------- */
export function roundRobinRounds(n: number): [number, number][][] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (idx.length % 2 !== 0) idx.push(-1); // bye marker
  const m = idx.length;
  const arr = idx.slice();
  const rounds: [number, number][][] = [];

  for (let r = 0; r < m - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i];
      const b = arr[m - 1 - i];
      if (a !== -1 && b !== -1) {
        pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!); // rotate, keep first fixed
  }
  return rounds;
}

export function generateRoundRobin(
  n: number,
  opts: { stage: GenStage; groupName?: string; doubleRound?: boolean } = {
    stage: "league",
  },
): GenMatch[] {
  const base = roundRobinRounds(n);
  const legs = opts.doubleRound
    ? [...base, ...base.map((round) => round.map(([a, b]) => [b, a] as [number, number]))]
    : base;

  const matches: GenMatch[] = [];
  legs.forEach((pairs, r) => {
    pairs.forEach(([a, b], slot) => {
      matches.push(
        emptyMatch({
          stage: opts.stage,
          groupName: opts.groupName ?? null,
          round: r + 1,
          slot,
          aEntrant: a,
          bEntrant: b,
        }),
      );
    });
  });
  return matches;
}

/* ----------------------------------------------------------------------------
   Single elimination bracket with standard seeding & byes
---------------------------------------------------------------------------- */
function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Standard bracket seed order for a bracket of `size` (power of two). */
export function seedOrder(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const rounds = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(rounds - s);
    }
    seeds = next;
  }
  return seeds; // 1-based seeds
}

const roundName = (matchesInRound: number): string => {
  switch (matchesInRound) {
    case 1:
      return "Finale";
    case 2:
      return "Semifinali";
    case 4:
      return "Quarti";
    case 8:
      return "Ottavi";
    case 16:
      return "Sedicesimi";
    default:
      return `Turno`;
  }
};

/**
 * @param n number of entrants (seeded order: index 0 = seed 1)
 */
export function generateSingleElim(
  n: number,
  opts: { thirdPlace?: boolean } = {},
): GenMatch[] {
  const size = nextPow2(Math.max(2, n));
  const order = seedOrder(size); // seeds positioned in bracket order
  const matches: GenMatch[] = [];

  // Round 1
  let round = 1;
  let current: GenMatch[] = [];
  for (let i = 0; i < size / 2; i++) {
    const seedA = order[i * 2];
    const seedB = order[i * 2 + 1];
    const aEntrant = seedA <= n ? seedA - 1 : null;
    const bEntrant = seedB <= n ? seedB - 1 : null;
    current.push(
      emptyMatch({
        stage: "knockout",
        round,
        slot: i,
        aEntrant,
        bEntrant,
        label: roundName(size / 2),
      }),
    );
  }
  matches.push(...current);

  // Subsequent rounds
  while (current.length > 1) {
    round += 1;
    const next: GenMatch[] = [];
    for (let i = 0; i < current.length / 2; i++) {
      const m = emptyMatch({
        stage: "knockout",
        round,
        slot: i,
        label: roundName(current.length / 2),
      });
      next.push(m);
      current[i * 2].nextLocalId = m.localId;
      current[i * 2].nextSlot = "A";
      current[i * 2 + 1].nextLocalId = m.localId;
      current[i * 2 + 1].nextSlot = "B";
    }
    matches.push(...next);
    current = next;
  }

  // Third place (fed by the two semifinal losers — handled at advance time)
  if (opts.thirdPlace && size >= 4) {
    matches.push(
      emptyMatch({
        stage: "knockout",
        round,
        slot: 1,
        label: "Finale 3°/4°",
      }),
    );
  }

  return matches;
}

/* ----------------------------------------------------------------------------
   Swiss — first round pairing (top half vs bottom half by seed)
---------------------------------------------------------------------------- */
export function generateSwissRound1(n: number): GenMatch[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (idx.length % 2 !== 0) idx.push(-1);
  const half = idx.length / 2;
  const matches: GenMatch[] = [];
  for (let i = 0; i < half; i++) {
    const a = idx[i];
    const b = idx[i + half];
    if (a === -1 || b === -1) continue; // bye
    matches.push(
      emptyMatch({ stage: "swiss", round: 1, slot: i, aEntrant: a, bEntrant: b }),
    );
  }
  return matches;
}

/** Group split: distribute entrants across N groups snake-style by seed. */
export function splitIntoGroups(n: number, groups: number): number[][] {
  const buckets: number[][] = Array.from({ length: groups }, () => []);
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / groups);
    const col = i % groups;
    const g = row % 2 === 0 ? col : groups - 1 - col; // snake
    buckets[g].push(i);
  }
  return buckets;
}

export const GROUP_LABELS = "ABCDEFGH".split("");
