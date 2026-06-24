export type StandingMatch = {
  entrantAId: string | null;
  entrantBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  status: "scheduled" | "completed";
  stage: string | null;
  groupName: string | null;
};

export type StandingEntrant = {
  id: string;
  name: string;
  groupName: string | null;
  seed: number;
};

export type StandingRow = {
  entrant: StandingEntrant;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  points: number;
};

const POINTS_WIN = 3;

/** Serie-A style standings from completed matches in a league/group. */
export function computeStandings(
  entrants: StandingEntrant[],
  matches: StandingMatch[],
  opts: { groupName?: string | null; stages?: string[] } = {},
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const e of entrants) {
    if (opts.groupName != null && e.groupName !== opts.groupName) continue;
    rows.set(e.id, {
      entrant: e,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      points: 0,
    });
  }

  for (const m of matches) {
    if (m.status !== "completed" || m.winner == null) continue;
    if (opts.stages && (!m.stage || !opts.stages.includes(m.stage))) continue;
    if (opts.groupName != null && m.groupName !== opts.groupName) continue;
    if (!m.entrantAId || !m.entrantBId) continue;
    const a = rows.get(m.entrantAId);
    const b = rows.get(m.entrantBId);
    if (!a || !b) continue;

    const sa = m.scoreA ?? 0;
    const sb = m.scoreB ?? 0;
    a.played++;
    b.played++;
    a.pointsFor += sa;
    a.pointsAgainst += sb;
    b.pointsFor += sb;
    b.pointsAgainst += sa;
    if (m.winner === "A") {
      a.won++;
      b.lost++;
      a.points += POINTS_WIN;
    } else {
      b.won++;
      a.lost++;
      b.points += POINTS_WIN;
    }
  }

  const out = [...rows.values()];
  for (const r of out) r.diff = r.pointsFor - r.pointsAgainst;
  out.sort(
    (x, y) =>
      y.points - x.points ||
      y.diff - x.diff ||
      y.pointsFor - x.pointsFor ||
      x.entrant.seed - y.entrant.seed,
  );
  return out;
}

/** Top `count` entrant ids from each group, ordered for knockout seeding. */
export function qualifiersFromGroups(
  entrants: StandingEntrant[],
  matches: StandingMatch[],
  groups: string[],
  perGroup: number,
): string[] {
  const winners: string[][] = [];
  for (const g of groups) {
    const table = computeStandings(entrants, matches, {
      groupName: g,
      stages: ["group"],
    });
    winners.push(table.slice(0, perGroup).map((r) => r.entrant.id));
  }
  // Cross-seed: 1st of A, 1st of B, ... then 2nd of A, 2nd of B ...
  const seeded: string[] = [];
  for (let pos = 0; pos < perGroup; pos++) {
    for (const g of winners) {
      if (g[pos]) seeded.push(g[pos]);
    }
  }
  return seeded;
}
