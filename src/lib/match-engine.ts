import { inArray, eq, asc, and, lte, sql } from "drizzle-orm";
import { db } from "./db";
import {
  players as playersTable,
  teams as teamsTable,
  matchParticipants,
  eloHistory,
  matches as matchesTable,
  users as usersTable,
  STARTING_ELO,
} from "./db/schema";
import { computeElo, sideRating } from "./elo";
import { replayElo, type ParticipantRating } from "./elo-replay";
import { notify } from "./notifications";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SideInput = {
  playerIds: string[];
  teamId?: string | null;
};

/**
 * Insert participant rows for a match WITHOUT touching Elo. Used when a result
 * is only proposed (status 'pending'); the Elo is applied later by
 * recomputeAllElo() once the match is confirmed/completed.
 */
export async function insertParticipants(
  tx: Tx,
  matchId: string,
  sideA: SideInput,
  sideB: SideInput,
): Promise<void> {
  for (const [side, s] of [
    ["A", sideA] as const,
    ["B", sideB] as const,
  ]) {
    for (const playerId of s.playerIds) {
      await tx.insert(matchParticipants).values({
        matchId,
        side,
        playerId,
        teamId: s.teamId ?? null,
        ratingBefore: null,
        ratingAfter: null,
      });
    }
  }
}

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
 * Auto-confirm pending results past their 24h deadline. Race-safe: the
 * conditional UPDATE only flips rows still 'pending', so a manual confirm
 * happening at the same instant can't double-apply. Returns how many flipped.
 */
export async function autoConfirmExpired(): Promise<number> {
  const flipped = await db
    .update(matchesTable)
    .set({ status: "completed", autoConfirmed: true })
    .where(
      and(
        eq(matchesTable.status, "pending"),
        lte(matchesTable.confirmDeadline, sql`now()`),
      ),
    )
    .returning({ id: matchesTable.id });
  if (flipped.length > 0) {
    await recomputeAllElo();
    // Tell the players: their result settled on its own and now counts. Each
    // match flips exactly once (it becomes 'completed'), so this never spams.
    await notifyAutoConfirmed(flipped.map((f) => f.id)).catch((error) =>
      console.error("[autoConfirmExpired] notify", error),
    );
  }
  return flipped.length;
}

/** Best-effort push to everyone who played in the just auto-confirmed matches. */
async function notifyAutoConfirmed(matchIds: string[]): Promise<void> {
  if (matchIds.length === 0) return;
  const partRows = await db
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(inArray(matchParticipants.matchId, matchIds));
  const playerIds = [...new Set(partRows.map((r) => r.playerId))];
  if (playerIds.length === 0) return;

  const userRows = await db
    .select({ userId: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.playerId, playerIds));
  const userIds = userRows.map((r) => r.userId);
  if (userIds.length === 0) return;

  await notify({
    userIds,
    kind: "match_confirmed",
    title: "Risultato confermato ✅",
    body: "Un risultato in attesa è stato confermato automaticamente dopo 24h e ora conta in classifica.",
    url: "/partite",
    tag: "match-autoconfirm",
  });
}

/**
 * Rebuild every rating from scratch by replaying all completed matches in
 * chronological order. Idempotent; run after a match is edited or deleted.
 */
export async function recomputeAllElo(): Promise<void> {
  await db.transaction(async (tx) => {
    // Serialize concurrent recomputes (e.g. two results confirmed at once) so
    // ratings can never interleave into an inconsistent state.
    await tx.execute(sql`select pg_advisory_xact_lock(727274)`);

    const allPlayers = await tx.select().from(playersTable);
    const allTeams = await tx.select().from(teamsTable);

    await tx.delete(eloHistory);

    const completed = await tx.query.matches.findMany({
      where: and(
        eq(matchesTable.status, "completed"),
        eq(matchesTable.ranked, true),
      ),
      orderBy: [asc(matchesTable.playedAt), asc(matchesTable.createdAt)],
      with: { participants: true },
    });

    // Pure replay: all the rating math lives in elo-replay.ts.
    const result = replayElo({
      playerIds: allPlayers.map((p) => p.id),
      teamIds: allTeams.map((t) => t.id),
      matches: completed.map((m) => ({
        id: m.id,
        format: m.format,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        participants: m.participants.map((p) => ({
          id: p.id,
          side: p.side,
          playerId: p.playerId,
          teamId: p.teamId,
        })),
      })),
      startingElo: STARTING_ELO,
    });

    // Persist in batches. A single recompute can touch thousands of rows, so
    // per-row round-trips would dominate the cost; group the writes instead.
    await bulkUpdateParticipantRatings(tx, result.participantRatings);
    for (const group of chunk(result.history, HISTORY_INSERT_CHUNK)) {
      if (group.length > 0) await tx.insert(eloHistory).values(group);
    }
    // Player/team counts are bounded by the roster (tens, not thousands), so
    // per-row updates here stay cheap.
    for (const [id, r] of result.players) {
      await tx
        .update(playersTable)
        .set({
          eloSingles: r.eloSingles,
          eloDoubles: r.eloDoubles,
          peakElo: r.peak,
        })
        .where(eq(playersTable.id, id));
    }
    for (const [id, r] of result.teams) {
      await tx
        .update(teamsTable)
        .set({ eloDoubles: r.eloDoubles, peakElo: r.peak })
        .where(eq(teamsTable.id, id));
    }
  });
}

/** Insert N elo_history rows per round-trip (Postgres caps params ~65k). */
const HISTORY_INSERT_CHUNK = 1000;
/** Update N participant ratings per round-trip via a single VALUES join. */
const PARTICIPANT_UPDATE_CHUNK = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Apply all participant rating_before/after in batches. A correlated
 * `UPDATE … FROM (VALUES …)` rewrites up to PARTICIPANT_UPDATE_CHUNK rows in one
 * statement instead of one round-trip per participant.
 */
async function bulkUpdateParticipantRatings(
  tx: Tx,
  ratings: ParticipantRating[],
): Promise<void> {
  for (const group of chunk(ratings, PARTICIPANT_UPDATE_CHUNK)) {
    if (group.length === 0) continue;
    const rows = sql.join(
      group.map(
        (r) =>
          sql`(${r.participantId}::uuid, ${r.ratingBefore}::integer, ${r.ratingAfter}::integer)`,
      ),
      sql`, `,
    );
    await tx.execute(sql`
      UPDATE ${matchParticipants} AS mp
      SET "rating_before" = v.rb, "rating_after" = v.ra
      FROM (VALUES ${rows}) AS v(id, rb, ra)
      WHERE mp."id" = v.id
    `);
  }
}
