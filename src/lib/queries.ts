import {
  desc,
  eq,
  isNull,
  isNotNull,
  and,
  asc,
  inArray,
  sql,
  getTableColumns,
} from "drizzle-orm";
import { db } from "./db";
import {
  matches,
  players,
  eloHistory,
  matchParticipants,
  users,
} from "./db/schema";
import { cachedQuery } from "./cache";

/**
 * Relational `with` shared by every match loader so a ShapedMatch always carries
 * each participant's account username and the linked tournament (name + slug).
 * Keeping it in one place means the loaders can't drift apart.
 */
export const matchWith = {
  participants: {
    with: {
      player: { with: { user: { columns: { username: true } } } },
      team: true,
    },
  },
  tournament: { columns: { name: true, slug: true } },
} as const;

export type ShapedSide = {
  label: string;
  teamName: string | null;
  players: {
    id: string;
    name: string;
    slug: string;
    username: string | null;
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
  tournamentName: string | null;
  tournamentSlug: string | null;
  /** Bracket context (tournament matches only): stage type, group, round. */
  stage: "group" | "league" | "swiss" | "knockout" | null;
  groupName: string | null;
  round: number | null;
  proposedById: string | null;
  proposedSide: "A" | "B" | null;
  confirmDeadline: Date | null;
  /** set when the opponent contested the result → "conteso" / admin queue */
  disputedAt: Date | null;
  disputeReason: string | null;
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
      username: r.player!.user?.username ?? null,
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
    tournamentName: row.tournament?.name ?? null,
    tournamentSlug: row.tournament?.slug ?? null,
    stage: row.stage,
    groupName: row.groupName,
    round: row.round,
    proposedById: row.proposedById,
    proposedSide: row.proposedSide,
    confirmDeadline: row.confirmDeadline,
    disputedAt: row.disputedAt,
    disputeReason: row.disputeReason,
    sideA: shapeSide(row.participants, "A"),
    sideB: shapeSide(row.participants, "B"),
  };
}

function loadMatches(opts: {
  limit?: number;
  offset?: number;
  casualOnly?: boolean;
}) {
  return db.query.matches.findMany({
    where: opts.casualOnly
      ? and(eq(matches.status, "completed"), isNull(matches.tournamentId))
      : eq(matches.status, "completed"),
    orderBy: [desc(matches.playedAt)],
    limit: opts.limit,
    offset: opts.offset,
    with: matchWith,
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

/**
 * One page of completed matches, newest first. Powers the "carica altre"
 * button on /partite so older history loads on demand instead of all at once.
 */
export const getMatchesPage = cachedQuery(
  async (offset: number, limit: number): Promise<ShapedMatch[]> => {
    const rows = await loadMatches({ offset, limit, casualOnly: false });
    return rows.map(shapeMatch);
  },
  ["matches-page"],
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
  async () =>
    db
      .select({ ...getTableColumns(players), username: linkedUsername })
      .from(players)
      .orderBy(desc(players.eloSingles)),
  ["players-list"],
);

/** Upcoming scheduled challenges, soonest first. */
export const getScheduledMatches = cachedQuery(async (): Promise<ShapedMatch[]> => {
  const rows = await db.query.matches.findMany({
    where: eq(matches.status, "scheduled"),
    orderBy: [asc(matches.playedAt)],
    with: matchWith,
  });
  return rows.map(shapeMatch);
}, ["scheduled-matches"]);

/** All results awaiting confirmation. */
export const getPendingMatches = cachedQuery(async (): Promise<ShapedMatch[]> => {
  const rows = await db.query.matches.findMany({
    where: eq(matches.status, "pending"),
    orderBy: [desc(matches.createdAt)],
    with: matchWith,
  });
  return rows.map(shapeMatch);
}, ["pending-matches"]);

export type DisputedMatchView = {
  id: string;
  labelA: string;
  labelB: string;
  scoreA: number | null;
  scoreB: number | null;
  ranked: boolean;
  reason: string | null;
  disputedAt: Date | null;
  contestedBy: string | null;
  proposedBy: string | null;
};

/**
 * Contested ("conteso") results awaiting an admin decision, oldest first. Powers
 * the admin dispute queue. Uncached — admins need the live state. Resolves the
 * proposer/contester user names in one extra round-trip.
 */
export async function getDisputedMatches(): Promise<DisputedMatchView[]> {
  const rows = await db.query.matches.findMany({
    where: and(eq(matches.status, "pending"), isNotNull(matches.disputedAt)),
    orderBy: [asc(matches.disputedAt)],
    with: matchWith,
  });
  if (rows.length === 0) return [];

  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.proposedById, r.disputedById])
        .filter((x): x is string => !!x),
    ),
  ];
  const us = userIds.length
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const nameById = new Map(us.map((u) => [u.id, u.name]));

  return rows.map((row) => {
    const shaped = shapeMatch(row);
    return {
      id: row.id,
      labelA: shaped.sideA.label || "Squadra A",
      labelB: shaped.sideB.label || "Squadra B",
      scoreA: row.scoreA,
      scoreB: row.scoreB,
      ranked: row.ranked,
      reason: row.disputeReason,
      disputedAt: row.disputedAt,
      contestedBy: row.disputedById ? nameById.get(row.disputedById) ?? null : null,
      proposedBy: row.proposedById ? nameById.get(row.proposedById) ?? null : null,
    };
  });
}

/** Single match (uncached — used on the confirmation page). */
export async function getMatchById(id: string): Promise<ShapedMatch | null> {
  const row = await db.query.matches.findFirst({
    where: eq(matches.id, id),
    with: matchWith,
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
      with: matchWith,
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

/**
 * Username of the account linked to a player, as a scalar subquery so the
 * picker queries stay one-row-per-player (a LEFT JOIN could duplicate a player
 * if two accounts ever pointed at it). Null for players with no account.
 */
const linkedUsername = sql<string | null>`(
  select ${users.username} from ${users}
  where ${users.playerId} = ${players.id}
  limit 1
)`;

export const getPlayerOptions = cachedQuery(
  async () =>
    db
      .select({
        id: players.id,
        name: players.name,
        slug: players.slug,
        avatarColor: players.avatarColor,
        avatarUrl: players.avatarUrl,
        username: linkedUsername,
      })
      .from(players)
      .where(eq(players.active, true))
      .orderBy(players.name),
  ["player-options"],
);

/**
 * Players plus their current ratings, used by the match form to preview the
 * live Elo swing before a result is saved. Same avatar/handle enrichment as
 * getPlayerOptions so the picker modal can show a rich row.
 */
export const getPlayerMatchOptions = cachedQuery(
  async () =>
    db
      .select({
        id: players.id,
        name: players.name,
        eloSingles: players.eloSingles,
        eloDoubles: players.eloDoubles,
        avatarColor: players.avatarColor,
        avatarUrl: players.avatarUrl,
        username: linkedUsername,
      })
      .from(players)
      .where(eq(players.active, true))
      .orderBy(players.name),
  ["player-match-options"],
);

/**
 * id → linked account username for EVERY player (active or not). The /giocatori
 * ranking lists inactive players too, so unlike getPlayerOptions this is NOT
 * filtered by `active`. Two columns only; cached under its own key.
 */
export const getPlayerUsernames = cachedQuery(
  async () =>
    db.select({ id: players.id, username: linkedUsername }).from(players),
  ["player-usernames"],
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

/** All accounts with role + linked profile — for the admin account manager. */
export async function getAllAccounts() {
  return db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      role: users.role,
      blocked: users.blocked,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
    })
    .from(users)
    .leftJoin(players, eq(users.playerId, players.id))
    .orderBy(asc(users.role), users.name);
}
