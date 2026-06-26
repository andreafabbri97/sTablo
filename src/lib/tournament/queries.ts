import { eq, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentEntrants,
  matches,
  matchParticipants,
  players,
} from "@/lib/db/schema";
import { cachedQuery } from "@/lib/cache";
import { getPlayerUsernames } from "@/lib/queries";
import {
  computeStandings,
  computeAmericanoStandings,
  type StandingEntrant,
  type StandingMatch,
  type StandingRow,
  type AmericanoStandingRow,
} from "./standings";

export const FORMAT_META: Record<
  string,
  { label: string; emoji: string; blurb: string }
> = {
  league: { label: "Campionato", emoji: "🏆", blurb: "Tutti contro tutti, classifica a punti" },
  round_robin: { label: "Girone all'italiana", emoji: "🔄", blurb: "Round robin a girone unico" },
  single_elim: { label: "Eliminazione diretta", emoji: "⚔️", blurb: "Tabellone a eliminazione" },
  groups_knockout: { label: "Gironi + eliminazione", emoji: "🌍", blurb: "Fase a gironi poi tabellone" },
  swiss: { label: "Svizzero", emoji: "🏔️", blurb: "Accoppiamenti per punteggio" },
  americano: { label: "Americano", emoji: "🟡", blurb: "Coppie a rotazione, classifica individuale" },
};

export const DISCIPLINE_LABEL: Record<string, string> = {
  singles: "Singolo",
  doubles: "Doppio",
  teams: "Team",
};

export const getTournaments = cachedQuery(async () => {
  const rows = await db.query.tournaments.findMany({
    orderBy: [desc(tournaments.createdAt)],
    with: { entrants: true },
  });
  return rows.map((t) => ({
    ...t,
    entrantCount: t.entrants.length,
  }));
}, ["tournaments-list"]);

export type TournamentMatchView = {
  id: string;
  stage: string | null;
  groupName: string | null;
  round: number | null;
  slot: number | null;
  label: string | null;
  status: "scheduled" | "pending" | "completed";
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  aId: string | null;
  bId: string | null;
  aName: string;
  bName: string;
  /** Account handle for a SINGLE-player entrant side; null for pairs/teams. */
  aUsername: string | null;
  bUsername: string | null;
};

export type AmericanoMatchView = {
  id: string;
  round: number;
  slot: number;
  status: "scheduled" | "pending" | "completed";
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  aNames: string[];
  bNames: string[];
};

export type AmericanoView = {
  standings: AmericanoStandingRow[];
  rounds: { round: number; matches: AmericanoMatchView[] }[];
};

export type TournamentDetail = {
  tournament: typeof tournaments.$inferSelect;
  entrants: (typeof tournamentEntrants.$inferSelect)[];
  matchesByStage: Record<string, TournamentMatchView[]>;
  groups: string[];
  standings: StandingRow[];
  groupStandings: Record<string, StandingRow[]>;
  winnerName: string | null;
  /** Present only for the Americano format (individual leaderboard + courts). */
  americano: AmericanoView | null;
};

export const getTournamentDetail = cachedQuery(
  async (slug: string): Promise<TournamentDetail | null> => {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.slug, slug),
  });
  if (!tournament) return null;

  // Entrants and matches only depend on the tournament id — load them together
  // so the detail page pays one round-trip of latency instead of two.
  const [entrants, matchRows, unameRows] = await Promise.all([
    db
      .select()
      .from(tournamentEntrants)
      .where(eq(tournamentEntrants.tournamentId, tournament.id))
      .orderBy(asc(tournamentEntrants.seed)),
    db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, tournament.id))
      .orderBy(asc(matches.round), asc(matches.slot)),
    getPlayerUsernames(),
  ]);

  const nameById = new Map(entrants.map((e) => [e.id, e.name]));
  // Account handle per entrant, but ONLY for single-player entrants (a lone
  // registered player) — doubles pairs and team aliases have no single handle.
  const usernameByPlayerId = new Map(unameRows.map((u) => [u.id, u.username]));
  const entrantHandle = (e: (typeof entrants)[number]): string | null =>
    e.playerId && !e.partnerId && !e.teamId
      ? (usernameByPlayerId.get(e.playerId) ?? null)
      : null;
  const handleByEntrantId = new Map(
    entrants.map((e) => [e.id, entrantHandle(e)]),
  );
  const view: TournamentMatchView[] = matchRows.map((m) => ({
    id: m.id,
    stage: m.stage,
    groupName: m.groupName,
    round: m.round,
    slot: m.slot,
    label: m.note,
    status: m.status,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner,
    aId: m.entrantAId,
    bId: m.entrantBId,
    aName: m.entrantAId ? (nameById.get(m.entrantAId) ?? "—") : "—",
    bName: m.entrantBId ? (nameById.get(m.entrantBId) ?? "—") : "—",
    aUsername: m.entrantAId ? (handleByEntrantId.get(m.entrantAId) ?? null) : null,
    bUsername: m.entrantBId ? (handleByEntrantId.get(m.entrantBId) ?? null) : null,
  }));

  const matchesByStage: Record<string, TournamentMatchView[]> = {};
  for (const m of view) {
    const key = m.stage ?? "other";
    (matchesByStage[key] ??= []).push(m);
  }

  const stEntrants: StandingEntrant[] = entrants.map((e) => ({
    id: e.id,
    name: e.name,
    groupName: e.groupName,
    seed: e.seed,
    username: entrantHandle(e),
  }));
  const stMatches: StandingMatch[] = matchRows.map((m) => ({
    entrantAId: m.entrantAId,
    entrantBId: m.entrantBId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner,
    status: m.status,
    stage: m.stage,
    groupName: m.groupName,
  }));

  const groups = [
    ...new Set(entrants.map((e) => e.groupName).filter(Boolean)),
  ].sort() as string[];

  const groupStandings: Record<string, StandingRow[]> = {};
  for (const g of groups) {
    groupStandings[g] = computeStandings(stEntrants, stMatches, {
      groupName: g,
      stages: ["group"],
    });
  }

  const standings =
    groups.length > 0
      ? []
      : computeStandings(stEntrants, stMatches, { stages: ["league", "swiss"] });

  const winnerName = tournament.winnerEntrantId
    ? (nameById.get(tournament.winnerEntrantId) ?? null)
    : null;

  // Americano: build the individual leaderboard + per-round courts (each match
  // is a doubles game whose four players live in match_participants).
  let americano: AmericanoView | null = null;
  if (tournament.format === "americano") {
    const partRows = await db
      .select({
        matchId: matchParticipants.matchId,
        side: matchParticipants.side,
        playerId: matchParticipants.playerId,
        name: players.name,
      })
      .from(matchParticipants)
      .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
      .innerJoin(players, eq(matchParticipants.playerId, players.id))
      .where(eq(matches.tournamentId, tournament.id));

    const aNames = new Map<string, string[]>();
    const bNames = new Map<string, string[]>();
    for (const p of partRows) {
      const bucket = p.side === "A" ? aNames : bNames;
      const list = bucket.get(p.matchId);
      if (list) list.push(p.name);
      else bucket.set(p.matchId, [p.name]);
    }

    const amViews: AmericanoMatchView[] = matchRows.map((m) => ({
      id: m.id,
      round: m.round ?? 1,
      slot: m.slot ?? 0,
      status: m.status,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: m.winner,
      aNames: aNames.get(m.id) ?? [],
      bNames: bNames.get(m.id) ?? [],
    }));

    const roundsMap = new Map<number, AmericanoMatchView[]>();
    for (const v of amViews) {
      const list = roundsMap.get(v.round);
      if (list) list.push(v);
      else roundsMap.set(v.round, [v]);
    }
    const rounds = [...roundsMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, ms]) => ({ round, matches: ms }));

    const amPlayers = entrants
      .filter((e) => e.playerId)
      .map((e) => ({ playerId: e.playerId as string, name: e.name }));
    const amStandings = computeAmericanoStandings(
      amPlayers,
      matchRows.map((m) => ({
        id: m.id,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winner: m.winner,
        status: m.status,
      })),
      partRows.map((p) => ({
        matchId: p.matchId,
        side: p.side,
        playerId: p.playerId,
      })),
    );

    americano = { standings: amStandings, rounds };
  }

  return {
    tournament,
    entrants,
    matchesByStage,
    groups,
    standings,
    groupStandings,
    winnerName,
    americano,
  };
  },
  ["tournament-detail"],
);
