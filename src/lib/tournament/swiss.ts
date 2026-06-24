/**
 * Pure Swiss-pairing core (no IO).
 *
 * `generateNextSwissRound` (tournament-actions.ts) is a thin adapter that loads
 * the standings + match history, calls this to decide the next round's pairings,
 * then persists the resulting matches. Keeping the pairing math here makes it the
 * single source of truth and fully unit-testable.
 *
 * Swiss rules encoded:
 * - Entrants are paired in standings order (best first), greedily.
 * - A pair that has already met is skipped in favour of the next eligible
 *   opponent; only if no fresh opponent remains do we fall back to a rematch.
 * - With an odd field, one entrant gets a bye (a free win). The bye goes to the
 *   lowest-ranked entrant who has not already had one this tournament.
 */

/** Canonical, order-independent key for a pair of entrant ids. */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
}

export type SwissRoundInput = {
  /** Entrant ids ordered by current standings, best first. */
  ranked: string[];
  /** Pairs that have already played each other (either order). */
  playedPairs: readonly (readonly [string, string])[];
  /** Entrants who have already received a bye this tournament. */
  hadBye?: Iterable<string>;
};

export type SwissRoundResult = {
  /** Newly formed pairs for the next round, in pairing order. */
  pairs: [string, string][];
  /** Entrant sitting out with a free win, or null when the field is even. */
  byeId: string | null;
};

export function pairSwissRound(input: SwissRoundInput): SwissRoundResult {
  const queue = [...input.ranked];
  const played = new Set(input.playedPairs.map(([a, b]) => pairKey(a, b)));
  const hadBye = new Set(input.hadBye ?? []);

  // Odd field → one entrant gets a bye. Prefer the lowest-ranked who has not
  // already had one; if everyone has, fall back to the very last in standings.
  let byeId: string | null = null;
  if (queue.length % 2 === 1) {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (!hadBye.has(queue[i])) {
        byeId = queue[i];
        break;
      }
    }
    byeId ??= queue[queue.length - 1];
    queue.splice(queue.indexOf(byeId), 1);
  }

  const pairs: [string, string][] = [];
  const used = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    if (used.has(a)) continue;

    let partner: string | null = null;
    for (let j = i + 1; j < queue.length; j++) {
      const b = queue[j];
      if (used.has(b)) continue;
      if (!played.has(pairKey(a, b))) {
        partner = b;
        break;
      }
    }
    // No fresh opponent left → accept a rematch rather than leave a gap.
    if (!partner) {
      partner = queue.find((b) => b !== a && !used.has(b)) ?? null;
    }
    if (partner) {
      used.add(a);
      used.add(partner);
      pairs.push([a, partner]);
    }
  }

  return { pairs, byeId };
}
