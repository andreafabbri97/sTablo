import { eq, desc, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { tournaments, tournamentEntrants, matches } from "@/lib/db/schema";
import { cachedQuery } from "@/lib/cache";
import {
  computeStandings,
  type StandingEntrant,
  type StandingMatch,
  type StandingRow,
} from "./standings";

export const FORMAT_META: Record<
  string,
  { label: string; emoji: string; blurb: string }
> = {
  league: { label: "Campionato", emoji: "🏆", blurb: "Tutti contro tutti, classifica a punti" },
  round_robin: { label: "Girone all'italiana", emoji: "🔄", blurb: "Round robin a girone unico" },
  single_elim: { label: "Eliminazione diretta", emoji: "⚔️", blurb: "Tabellone a eliminazione" },
  groups_knockout: { label: "Gironi + eliminazione", emoji: "🌍", blurb: "Fase a gironi poi tabellone" },
  swiss: { label: "Svizzero", emoji: "🇨🇭", blurb: "Accoppiamenti per punteggio" },
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
  status: "scheduled" | "completed";
  scoreA: number | null;
  scoreB: number | null;
  winner: "A" | "B" | null;
  aId: string | null;
  bId: string | null;
  aName: string;
  bName: string;
};

export type TournamentDetail = {
  tournament: typeof tournaments.$inferSelect;
  entrants: (typeof tournamentEntrants.$inferSelect)[];
  matchesByStage: Record<string, TournamentMatchView[]>;
  groups: string[];
  standings: StandingRow[];
  groupStandings: Record<string, StandingRow[]>;
  winnerName: string | null;
};

export const getTournamentDetail = cachedQuery(
  async (slug: string): Promise<TournamentDetail | null> => {
  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.slug, slug),
  });
  if (!tournament) return null;

  const entrants = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, tournament.id))
    .orderBy(asc(tournamentEntrants.seed));

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournament.id))
    .orderBy(asc(matches.round), asc(matches.slot));

  const nameById = new Map(entrants.map((e) => [e.id, e.name]));
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

  return {
    tournament,
    entrants,
    matchesByStage,
    groups,
    standings,
    groupStandings,
    winnerName,
  };
  },
  ["tournament-detail"],
);
