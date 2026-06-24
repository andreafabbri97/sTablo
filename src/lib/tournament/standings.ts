export type StandingMatch = {
  entrantAId: string | null;
  entrantBId: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  status: "scheduled" | "pending" | "completed";
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
    // Bye / "Riposo": a completed match with only side A counts as a free win.
    if (m.entrantAId && !m.entrantBId && m.winner === "A") {
      const solo = rows.get(m.entrantAId);
      if (solo) {
        solo.played++;
        solo.won++;
        solo.points += POINTS_WIN;
      }
      continue;
    }
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

/* ----------------------------------------------------------------------------
   Americano — individual standings (one row per player, not per entrant)
---------------------------------------------------------------------------- */
export type AmericanoParticipant = {
  matchId: string;
  side: "A" | "B";
  playerId: string;
};

export type AmericanoMatchScore = {
  id: string;
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  status: "scheduled" | "pending" | "completed";
};

export type AmericanoPlayer = { playerId: string; name: string };

export type AmericanoStandingRow = {
  playerId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
};

/**
 * Individual leaderboard for an Americano: every player accrues the points they
 * personally scored across every game they played in (with rotating partners).
 * Ranked by total points scored — the classic Americano metric — then by point
 * difference and wins.
 */
export function computeAmericanoStandings(
  players: AmericanoPlayer[],
  matches: AmericanoMatchScore[],
  participants: AmericanoParticipant[],
): AmericanoStandingRow[] {
  const rows = new Map<string, AmericanoStandingRow>();
  for (const p of players) {
    rows.set(p.playerId, {
      playerId: p.playerId,
      name: p.name,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
    });
  }

  const byMatch = new Map<string, AmericanoParticipant[]>();
  for (const part of participants) {
    const list = byMatch.get(part.matchId);
    if (list) list.push(part);
    else byMatch.set(part.matchId, [part]);
  }

  for (const m of matches) {
    if (m.status !== "completed" || m.scoreA == null || m.scoreB == null) continue;
    for (const part of byMatch.get(m.id) ?? []) {
      const row = rows.get(part.playerId);
      if (!row) continue;
      const forPts = part.side === "A" ? m.scoreA : m.scoreB;
      const againstPts = part.side === "A" ? m.scoreB : m.scoreA;
      row.played++;
      row.pointsFor += forPts;
      row.pointsAgainst += againstPts;
      const won =
        (part.side === "A" && m.winner === "A") ||
        (part.side === "B" && m.winner === "B");
      if (won) row.won++;
      else row.lost++;
    }
  }

  const out = [...rows.values()];
  for (const r of out) r.diff = r.pointsFor - r.pointsAgainst;
  out.sort(
    (x, y) =>
      y.pointsFor - x.pointsFor ||
      y.diff - x.diff ||
      y.won - x.won ||
      x.name.localeCompare(y.name),
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
