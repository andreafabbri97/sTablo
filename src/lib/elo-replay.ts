/**
 * Pure Elo replay core (no IO).
 *
 * Rebuilds every rating from scratch by replaying completed ranked matches in
 * chronological order. `recomputeAllElo` (match-engine.ts) is a thin adapter
 * that loads the rows, calls this, then persists the result — so this is the
 * single source of truth for the rating math and is fully unit-testable.
 *
 * Matches are assumed to be pre-filtered (status completed, ranked) and already
 * sorted chronologically by the caller.
 */
import { computeElo, sideRating } from "./elo";

export type EloSubject = "player_singles" | "player_doubles" | "team";

export type ReplayParticipant = {
  id: string;
  side: "A" | "B";
  playerId: string;
  teamId: string | null;
};

export type ReplayMatch = {
  id: string;
  format: "singles" | "doubles";
  scoreA: number | null;
  scoreB: number | null;
  participants: ReplayParticipant[];
};

export type PlayerRating = {
  eloSingles: number;
  eloDoubles: number;
  peak: number;
};
export type TeamRating = { eloDoubles: number; peak: number };

export type EloHistoryEntry = {
  subject: EloSubject;
  subjectId: string;
  matchId: string;
  elo: number;
  delta: number;
};

export type ParticipantRating = {
  participantId: string;
  ratingBefore: number;
  ratingAfter: number;
};

export type ReplayResult = {
  players: Map<string, PlayerRating>;
  teams: Map<string, TeamRating>;
  history: EloHistoryEntry[];
  participantRatings: ParticipantRating[];
};

export function replayElo(input: {
  playerIds: string[];
  teamIds: string[];
  matches: ReplayMatch[];
  startingElo: number;
}): ReplayResult {
  const { playerIds, teamIds, matches, startingElo } = input;

  const players = new Map<string, PlayerRating>();
  for (const id of playerIds) {
    players.set(id, {
      eloSingles: startingElo,
      eloDoubles: startingElo,
      peak: startingElo,
    });
  }
  const teams = new Map<string, TeamRating>();
  for (const id of teamIds) {
    teams.set(id, { eloDoubles: startingElo, peak: startingElo });
  }

  const history: EloHistoryEntry[] = [];
  const participantRatings: ParticipantRating[] = [];

  for (const match of matches) {
    if (match.scoreA == null || match.scoreB == null) continue;
    const isSingles = match.format === "singles";
    const field = isSingles ? "eloSingles" : "eloDoubles";
    const subject: EloSubject = isSingles ? "player_singles" : "player_doubles";

    const sideA = match.participants.filter((p) => p.side === "A");
    const sideB = match.participants.filter((p) => p.side === "B");
    if (sideA.length === 0 || sideB.length === 0) continue;

    const ratingA = sideRating(sideA.map((p) => players.get(p.playerId)![field]));
    const ratingB = sideRating(sideB.map((p) => players.get(p.playerId)![field]));
    const { deltaA, deltaB } = computeElo({
      ratingA,
      ratingB,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
    });

    for (const [group, delta] of [
      [sideA, deltaA] as const,
      [sideB, deltaB] as const,
    ]) {
      for (const part of group) {
        const r = players.get(part.playerId)!;
        const before = r[field];
        const after = before + delta;
        r[field] = after;
        r.peak = Math.max(r.peak, after);
        participantRatings.push({
          participantId: part.id,
          ratingBefore: before,
          ratingAfter: after,
        });
        history.push({
          subject,
          subjectId: part.playerId,
          matchId: match.id,
          elo: after,
          delta,
        });
      }
    }

    // Team Elo (doubles only, when a side played as a registered team).
    const teamAId = sideA.find((p) => p.teamId)?.teamId ?? null;
    const teamBId = sideB.find((p) => p.teamId)?.teamId ?? null;
    if (!isSingles && (teamAId || teamBId)) {
      const rA = teamAId ? teams.get(teamAId)!.eloDoubles : ratingA;
      const rB = teamBId ? teams.get(teamBId)!.eloDoubles : ratingB;
      const td = computeElo({
        ratingA: rA,
        ratingB: rB,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
      });
      if (teamAId) {
        const t = teams.get(teamAId)!;
        t.eloDoubles += td.deltaA;
        t.peak = Math.max(t.peak, t.eloDoubles);
        history.push({
          subject: "team",
          subjectId: teamAId,
          matchId: match.id,
          elo: t.eloDoubles,
          delta: td.deltaA,
        });
      }
      if (teamBId) {
        const t = teams.get(teamBId)!;
        t.eloDoubles += td.deltaB;
        t.peak = Math.max(t.peak, t.eloDoubles);
        history.push({
          subject: "team",
          subjectId: teamBId,
          matchId: match.id,
          elo: t.eloDoubles,
          delta: td.deltaB,
        });
      }
    }
  }

  return { players, teams, history, participantRatings };
}
