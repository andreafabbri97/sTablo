import { desc, eq, isNull, and, asc, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import {
  matches,
  players,
  eloHistory,
  matchParticipants,
  teams,
  users,
} from "./db/schema";
import { cachedQuery } from "./cache";

export type ShapedSide = {
  label: string;
  teamName: string | null;
  players: {
    id: string;
    name: string;
    slug: string;
    colorIndex: number;
    imageUrl: string | null;
  }[];
};

export type ShapedMatch = {
  id: string;
  format: "singles" | "doubles";
  ranked: boolean;
  status: "scheduled" | "pending" | "completed";
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  playedAt: Date;
  note: string | null;
  tournamentId: string | null;
  proposedById: string | null;
  proposedSide: "A" | "B" | null;
  confirmDeadline: Date | null;
  sideA: ShapedSide;
  sideB: ShapedSide;
};

type MatchRow = Awaited<ReturnType<typeof loadMatches>>[number];

function shapeSide(parts: MatchRow["participants"], side: "A" | "B"): ShapedSide {
  const rows = parts.filter((p) => p.side === side);
  const team = rows.find((r) => r.team)?.team ?? null;
  const ps = rows
    .filter((r) => r.player)
    .map((r) => ({
      id: r.player!.id,
      name: r.player!.name,
      slug: r.player!.slug,
      colorIndex: r.player!.avatarColor,
      imageUrl: r.player!.avatarUrl,
    }));
  return {
    label: team ? team.name : ps.map((p) => p.name).join(" & "),
    teamName: team ? team.name : null,
    players: ps,
  };
}

export function shapeMatch(row: MatchRow): ShapedMatch {
  return {
    id: row.id,
    format: row.format,
    ranked: row.ranked,
    status: row.status,
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winner: row.winner,
    playedAt: row.playedAt,
    note: row.note,
    tournamentId: row.tournamentId,
    proposedById: row.proposedById,
    proposedSide: row.proposedSide,
    confirmDeadline: row.confirmDeadline,
    sideA: shapeSide(row.participants, "A"),
    sideB: shapeSide(row.participants, "B"),
  };
}

function loadMatches(opts: { limit?: number; casualOnly?: boolean }) {
  return db.query.matches.findMany({
    where: opts.casualOnly
      ? and(eq(matches.status, "completed"), isNull(matches.tournamentId))
      : eq(matches.status, "completed"),
    orderBy: [desc(matches.playedAt)],
    limit: opts.limit,
    with: {
      participants: { with: { player: true, team: true } },
    },
  });
}

export const getRecentMatches = cachedQuery(
  async (limit = 8): Promise<ShapedMatch[]> => {
    const rows = await loadMatches({ limit, casualOnly: false });
    return rows.map(shapeMatch);
  },
  ["recent-matches"],
);

/**
 * Completed matches, newest first. `limit` bounds the payload so the /partite
 * page stays light once the table holds thousands of rows — the client filters
 * within this window. Omit `limit` (e.g. internal callers) to load everything.
 */
export const getAllMatches = cachedQuery(
  async (limit?: number): Promise<ShapedMatch[]> => {
    const rows = await loadMatches({ limit, casualOnly: false });
    return rows.map(shapeMatch);
  },
  ["all-matches"],
);

/** Count of completed matches — pairs with the windowed getAllMatches. */
export const getMatchesCount = cachedQuery(async (): Promise<number> => {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(matches)
    .where(eq(matches.status, "completed"));
  return rows[0]?.c ?? 0;
}, ["matches-count"]);

export const getPlayersList = cachedQuery(
  async () => db.select().from(players).orderBy(desc(players.eloSingles)),
  ["players-list"],
);

/** All results awaiting confirmation. */
export const getPendingMatches = cachedQuery(async (): Promise<ShapedMatch[]> => {
  const rows = await db.query.matches.findMany({
    where: eq(matches.status, "pending"),
    orderBy: [desc(matches.createdAt)],
    with: { participants: { with: { player: true, team: true } } },
  });
  return rows.map(shapeMatch);
}, ["pending-matches"]);

/** Single match (uncached — used on the confirmation page). */
export async function getMatchById(id: string): Promise<ShapedMatch | null> {
  const row = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: { participants: { with: { player: true, team: true } } },
  });
  return row ? shapeMatch(row) : null;
}

export const getMatchesForPlayer = cachedQuery(
  async (playerId: string, limit = 10): Promise<ShapedMatch[]> => {
    const ids = await db
      .select({ matchId: matchParticipants.matchId })
      .from(matchParticipants)
      .where(eq(matchParticipants.playerId, playerId));
    if (ids.length === 0) return [];

    const rows = await db.query.matches.findMany({
      where: and(
        inArray(
          matches.id,
          ids.map((r) => r.matchId),
        ),
        eq(matches.status, "completed"),
      ),
      orderBy: [desc(matches.playedAt)],
      limit,
      with: { participants: { with: { player: true, team: true } } },
    });
    return rows.map(shapeMatch);
  },
  ["player-matches"],
);

export type EloPoint = { i: number; elo: number };

export const getEloSeries = cachedQuery(
  async (
    subjectId: string,
    subject: "player_singles" | "player_doubles" | "team" = "player_singles",
  ): Promise<EloPoint[]> => {
    const rows = await db
      .select({ elo: eloHistory.elo, createdAt: eloHistory.createdAt })
      .from(eloHistory)
      .where(
        and(
          eq(eloHistory.subjectId, subjectId),
          eq(eloHistory.subject, subject),
        ),
      )
      .orderBy(asc(eloHistory.createdAt));

    return [
      { i: 0, elo: 1000 },
      ...rows.map((r, idx) => ({ i: idx + 1, elo: r.elo })),
    ];
  },
  ["elo-series"],
);

export const getPlayerOptions = cachedQuery(
  async () =>
    db
      .select({ id: players.id, name: players.name, slug: players.slug })
      .from(players)
      .where(eq(players.active, true))
      .orderBy(players.name),
  ["player-options"],
);

/**
 * Players plus their current ratings, used by the match form to preview the
 * live Elo swing before a result is saved. Kept separate from
 * getPlayerOptions so the tournament/admin selects keep their lean shape.
 */
export const getPlayerMatchOptions = cachedQuery(
  async () =>
    db
      .select({
        id: players.id,
        name: players.name,
        eloSingles: players.eloSingles,
        eloDoubles: players.eloDoubles,
      })
      .from(players)
      .where(eq(players.active, true))
      .orderBy(players.name),
  ["player-match-options"],
);

/** Slug for a player id — used to build links from a session (which has no slug). */
export const getPlayerSlugById = cachedQuery(
  async (playerId: string): Promise<string | null> => {
    const row = await db
      .select({ slug: players.slug })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);
    return row[0]?.slug ?? null;
  },
  ["player-slug-by-id"],
);

export const getTeamOptions = cachedQuery(
  async () =>
    db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.active, true))
      .orderBy(teams.name),
  ["team-options"],
);

/** All accounts with role + linked profile — for the admin account manager. */
export async function getAllAccounts() {
  return db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
    })
    .from(users)
    .leftJoin(players, eq(users.playerId, players.id))
    .orderBy(asc(users.role), users.name);
}
