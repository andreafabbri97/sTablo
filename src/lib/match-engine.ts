import { inArray, eq, asc, and } from "drizzle-orm";
import { db } from "./db";
import {
  players as playersTable,
  teams as teamsTable,
  matchParticipants,
  eloHistory,
  matches as matchesTable,
  STARTING_ELO,
} from "./db/schema";
import { computeElo, sideRating } from "./elo";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SideInput = {
  playerIds: string[];
  teamId?: string | null;
};

export type ApplyResultParams = {
  matchId: string;
  format: "singles" | "doubles";
  sideA: SideInput;
  sideB: SideInput;
  scoreA: number;
  scoreB: number;
  /** false = friendly: insert participants but leave Elo untouched */
  ranked?: boolean;
};

/**
 * Apply a completed match result inside a transaction: updates player & team
 * Elo, writes elo history, and inserts match_participants rows. Shared by both
 * casual matches and tournament results so the rating logic lives in one place.
 */
export async function applyMatchResult(
  tx: Tx,
  p: ApplyResultParams,
): Promise<void> {
  const isSingles = p.format === "singles";
  const ratingField = isSingles ? "eloSingles" : "eloDoubles";
  const subject = isSingles ? "player_singles" : "player_doubles";
  const ranked = p.ranked !== false;

  // Friendly matches: record participants for history/XP, but no Elo changes.
  if (!ranked) {
    for (const [side, ids, teamId] of [
      ["A", p.sideA.playerIds, p.sideA.teamId] as const,
      ["B", p.sideB.playerIds, p.sideB.teamId] as const,
    ]) {
      for (const playerId of ids) {
        await tx.insert(matchParticipants).values({
          matchId: p.matchId,
          side,
          playerId,
          teamId: teamId ?? null,
          ratingBefore: null,
          ratingAfter: null,
        });
      }
    }
    return;
  }

  const ids = [...p.sideA.playerIds, ...p.sideB.playerIds];
  const rows = await tx
    .select()
    .from(playersTable)
    .where(inArray(playersTable.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const aPlayers = p.sideA.playerIds.map((id) => byId.get(id)!);
  const bPlayers = p.sideB.playerIds.map((id) => byId.get(id)!);

  const ratingA = sideRating(aPlayers.map((x) => x[ratingField]));
  const ratingB = sideRating(bPlayers.map((x) => x[ratingField]));

  const { deltaA, deltaB } = computeElo({
    ratingA,
    ratingB,
    scoreA: p.scoreA,
    scoreB: p.scoreB,
  });

  // --- players ---
  for (const [side, group, delta, teamId] of [
    ["A", aPlayers, deltaA, p.sideA.teamId] as const,
    ["B", bPlayers, deltaB, p.sideB.teamId] as const,
  ]) {
    for (const pl of group) {
      const before = pl[ratingField];
      const after = before + delta;
      const newPeak = Math.max(pl.peakElo, after);

      await tx
        .update(playersTable)
        .set({ [ratingField]: after, peakElo: newPeak })
        .where(eq(playersTable.id, pl.id));

      await tx.insert(eloHistory).values({
        subject,
        subjectId: pl.id,
        matchId: p.matchId,
        elo: after,
        delta,
      });

      await tx.insert(matchParticipants).values({
        matchId: p.matchId,
        side,
        playerId: pl.id,
        teamId: teamId ?? null,
        ratingBefore: before,
        ratingAfter: after,
      });
    }
  }

  // --- team Elo (doubles only, when a side played as a registered team) ---
  if (!isSingles && (p.sideA.teamId || p.sideB.teamId)) {
    await applyTeamElo(tx, {
      teamAId: p.sideA.teamId,
      teamBId: p.sideB.teamId,
      fallbackRatingA: sideRating(aPlayers.map((x) => x.eloDoubles)),
      fallbackRatingB: sideRating(bPlayers.map((x) => x.eloDoubles)),
      scoreA: p.scoreA,
      scoreB: p.scoreB,
      matchId: p.matchId,
    });
  }
}

async function applyTeamElo(
  tx: Tx,
  args: {
    teamAId?: string | null;
    teamBId?: string | null;
    fallbackRatingA: number;
    fallbackRatingB: number;
    scoreA: number;
    scoreB: number;
    matchId: string;
  },
) {
  const teamIds = [args.teamAId, args.teamBId].filter(Boolean) as string[];
  const teamRows = teamIds.length
    ? await tx.select().from(teamsTable).where(inArray(teamsTable.id, teamIds))
    : [];
  const teamById = new Map(teamRows.map((t) => [t.id, t]));

  const teamA = args.teamAId ? teamById.get(args.teamAId) : undefined;
  const teamB = args.teamBId ? teamById.get(args.teamBId) : undefined;

  const ratingA = teamA?.eloDoubles ?? args.fallbackRatingA;
  const ratingB = teamB?.eloDoubles ?? args.fallbackRatingB;

  const { deltaA, deltaB } = computeElo({
    ratingA,
    ratingB,
    scoreA: args.scoreA,
    scoreB: args.scoreB,
  });

  for (const [team, delta] of [
    [teamA, deltaA] as const,
    [teamB, deltaB] as const,
  ]) {
    if (!team) continue;
    const after = team.eloDoubles + delta;
    await tx
      .update(teamsTable)
      .set({ eloDoubles: after, peakElo: Math.max(team.peakElo, after) })
      .where(eq(teamsTable.id, team.id));
    await tx.insert(eloHistory).values({
      subject: "team",
      subjectId: team.id,
      matchId: args.matchId,
      elo: after,
      delta,
    });
  }
}

/**
 * Rebuild every rating from scratch by replaying all completed matches in
 * chronological order. Idempotent; run after a match is edited or deleted.
 */
export async function recomputeAllElo(): Promise<void> {
  await db.transaction(async (tx) => {
    const playerRatings = new Map<
      string,
      { eloSingles: number; eloDoubles: number; peak: number }
    >();
    const teamRatings = new Map<string, { eloDoubles: number; peak: number }>();

    const allPlayers = await tx.select().from(playersTable);
    for (const p of allPlayers) {
      playerRatings.set(p.id, {
        eloSingles: STARTING_ELO,
        eloDoubles: STARTING_ELO,
        peak: STARTING_ELO,
      });
    }
    const allTeams = await tx.select().from(teamsTable);
    for (const t of allTeams) {
      teamRatings.set(t.id, { eloDoubles: STARTING_ELO, peak: STARTING_ELO });
    }

    await tx.delete(eloHistory);

    const completed = await tx.query.matches.findMany({
      where: and(
        eq(matchesTable.status, "completed"),
        eq(matchesTable.ranked, true),
      ),
      orderBy: [asc(matchesTable.playedAt), asc(matchesTable.createdAt)],
      with: { participants: true },
    });

    for (const match of completed) {
      if (match.scoreA == null || match.scoreB == null) continue;
      const isSingles = match.format === "singles";
      const field = isSingles ? "eloSingles" : "eloDoubles";
      const subject = isSingles ? "player_singles" : "player_doubles";

      const sideA = match.participants.filter((p) => p.side === "A");
      const sideB = match.participants.filter((p) => p.side === "B");
      if (sideA.length === 0 || sideB.length === 0) continue;

      const ratingA = sideRating(
        sideA.map((p) => playerRatings.get(p.playerId)![field]),
      );
      const ratingB = sideRating(
        sideB.map((p) => playerRatings.get(p.playerId)![field]),
      );
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
          const r = playerRatings.get(part.playerId)!;
          const before = r[field];
          const after = before + delta;
          r[field] = after;
          r.peak = Math.max(r.peak, after);
          await tx
            .update(matchParticipants)
            .set({ ratingBefore: before, ratingAfter: after })
            .where(eq(matchParticipants.id, part.id));
          await tx.insert(eloHistory).values({
            subject,
            subjectId: part.playerId,
            matchId: match.id,
            elo: after,
            delta,
          });
        }
      }

      // team elo
      const teamAId = sideA.find((p) => p.teamId)?.teamId ?? null;
      const teamBId = sideB.find((p) => p.teamId)?.teamId ?? null;
      if (!isSingles && (teamAId || teamBId)) {
        const rA = teamAId
          ? teamRatings.get(teamAId)!.eloDoubles
          : ratingA;
        const rB = teamBId
          ? teamRatings.get(teamBId)!.eloDoubles
          : ratingB;
        const td = computeElo({
          ratingA: rA,
          ratingB: rB,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
        });
        if (teamAId) {
          const t = teamRatings.get(teamAId)!;
          t.eloDoubles += td.deltaA;
          t.peak = Math.max(t.peak, t.eloDoubles);
          await tx.insert(eloHistory).values({
            subject: "team",
            subjectId: teamAId,
            matchId: match.id,
            elo: t.eloDoubles,
            delta: td.deltaA,
          });
        }
        if (teamBId) {
          const t = teamRatings.get(teamBId)!;
          t.eloDoubles += td.deltaB;
          t.peak = Math.max(t.peak, t.eloDoubles);
          await tx.insert(eloHistory).values({
            subject: "team",
            subjectId: teamBId,
            matchId: match.id,
            elo: t.eloDoubles,
            delta: td.deltaB,
          });
        }
      }
    }

    // persist final ratings
    for (const [id, r] of playerRatings) {
      await tx
        .update(playersTable)
        .set({
          eloSingles: r.eloSingles,
          eloDoubles: r.eloDoubles,
          peakElo: r.peak,
        })
        .where(eq(playersTable.id, id));
    }
    for (const [id, r] of teamRatings) {
      await tx
        .update(teamsTable)
        .set({ eloDoubles: r.eloDoubles, peakElo: r.peak })
        .where(eq(teamsTable.id, id));
    }
  });
}
