import { desc, eq, isNull, and, asc, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  matches,
  players,
  eloHistory,
  matchParticipants,
  teams,
} from "./db/schema";

export type ShapedSide = {
  label: string;
  teamName: string | null;
  players: { name: string; slug: string; colorIndex: number }[];
};

export type ShapedMatch = {
  id: string;
  format: "singles" | "doubles";
  ranked: boolean;
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  playedAt: Date;
  note: string | null;
  tournamentId: string | null;
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
      name: r.player!.name,
      slug: r.player!.slug,
      colorIndex: r.player!.avatarColor,
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
    scoreA: row.scoreA,
    scoreB: row.scoreB,
    winner: row.winner,
    playedAt: row.playedAt,
    note: row.note,
    tournamentId: row.tournamentId,
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

export async function getRecentMatches(limit = 8): Promise<ShapedMatch[]> {
  const rows = await loadMatches({ limit, casualOnly: false });
  return rows.map(shapeMatch);
}

export async function getAllMatches(): Promise<ShapedMatch[]> {
  const rows = await loadMatches({ casualOnly: false });
  return rows.map(shapeMatch);
}

export async function getPlayersList() {
  return db.select().from(players).orderBy(desc(players.eloSingles));
}

export async function getMatchesForPlayer(
  playerId: string,
  limit = 10,
): Promise<ShapedMatch[]> {
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
}

export type EloPoint = { i: number; elo: number };

export async function getEloSeries(
  subjectId: string,
  subject: "player_singles" | "player_doubles" | "team" = "player_singles",
): Promise<EloPoint[]> {
  const rows = await db
    .select({ elo: eloHistory.elo, createdAt: eloHistory.createdAt })
    .from(eloHistory)
    .where(
      and(eq(eloHistory.subjectId, subjectId), eq(eloHistory.subject, subject)),
    )
    .orderBy(asc(eloHistory.createdAt));

  return [
    { i: 0, elo: 1000 },
    ...rows.map((r, idx) => ({ i: idx + 1, elo: r.elo })),
  ];
}

export async function getPlayerOptions() {
  const rows = await db
    .select({ id: players.id, name: players.name, slug: players.slug })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(players.name);
  return rows;
}

export async function getTeamOptions() {
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.active, true))
    .orderBy(teams.name);
  return rows;
}
