"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, inArray, and } from "drizzle-orm";
import { DATA_TAG } from "@/lib/cache";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentEntrants,
  tournamentInvites,
  matches,
  matchParticipants,
  teams,
  players,
  type TournamentConfig,
} from "@/lib/db/schema";
import { tournamentSchema, type TournamentInput } from "@/lib/validation";
import { assertAdmin, assertAuth } from "@/lib/auth-helpers";
import { slugify } from "@/lib/utils";
import {
  applyMatchResult,
  insertParticipants,
  recomputeAllElo,
  type SideInput,
} from "@/lib/match-engine";
import { sendPushToUsers } from "@/lib/push";
import { getFriends } from "@/lib/friends";
import {
  generateRoundRobin,
  generateSingleElim,
  generateSwissRound1,
  generateAmericano,
  defaultAmericanoRounds,
  splitIntoGroups,
  GROUP_LABELS,
  type GenMatch,
} from "@/lib/tournament/generators";
import {
  computeStandings,
  computeAmericanoStandings,
  qualifiersFromGroups,
  type StandingEntrant,
  type StandingMatch,
  type AmericanoParticipant,
} from "@/lib/tournament/standings";
import { pairSwissRound } from "@/lib/tournament/swiss";
import { knockoutFinalWinner } from "@/lib/tournament/knockout";
import { validateTavolinoScore } from "@/lib/score-rules";
import type { ActionResult } from "./auth-actions";

type CreateResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

async function uniqueTournamentSlug(base: string): Promise<string> {
  let slug = slugify(base) || "torneo";
  const root = slug;
  let i = 1;
  while (
    await db.query.tournaments.findFirst({ where: eq(tournaments.slug, slug) })
  ) {
    i += 1;
    slug = `${root}-${i}`;
  }
  return slug;
}

export async function createTournament(input: unknown): Promise<CreateResult> {
  let user;
  try {
    user = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }

  const parsed = tournamentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const isSingles = d.discipline === "singles";
  const matchFormat = isSingles ? "singles" : "doubles";

  // Resolve the entrants into concrete specs (players, ad-hoc pairs, or teams).
  const specs = await buildEntrantSpecs(d);
  if (!specs) {
    return { ok: false, error: "Partecipanti non validi" };
  }
  if (specs.length < 2) {
    return { ok: false, error: "Servono almeno 2 partecipanti distinti" };
  }
  const n = specs.length;

  const config: TournamentConfig = {
    ranked: d.ranked,
    doubleRound: d.doubleRound,
    groups: d.groups,
    advancePerGroup: d.advancePerGroup,
    swissRounds: d.swissRounds,
    thirdPlace: d.thirdPlace,
    targetScore: d.targetScore,
    americanoRounds: d.americanoRounds,
  };

  if (d.format === "americano" && n < 4) {
    return { ok: false, error: "L'Americano richiede almeno 4 giocatori" };
  }

  const slug = await uniqueTournamentSlug(d.name);

  try {
    await db.transaction(async (tx) => {
      const [t] = await tx
        .insert(tournaments)
        .values({
          name: d.name,
          slug,
          format: d.format,
          discipline: d.discipline,
          status: "active",
          description: d.description || null,
          config,
          currentRound: 1,
          createdById: user.id,
          startedAt: new Date(),
        })
        .returning();

      // Group assignment for groups_knockout
      const groupOf = new Map<number, string>();
      if (d.format === "groups_knockout") {
        const groups = Math.max(2, Math.min(d.groups ?? 2, GROUP_LABELS.length));
        const buckets = splitIntoGroups(n, groups);
        buckets.forEach((indices, g) => {
          for (const idx of indices) groupOf.set(idx, GROUP_LABELS[g]);
        });
      }

      // Insert entrants in seeded order
      const entrantRows = await tx
        .insert(tournamentEntrants)
        .values(
          specs.map((s, i) => ({
            tournamentId: t.id,
            name: s.name,
            seed: i + 1,
            groupName: groupOf.get(i) ?? null,
            playerId: s.playerId,
            teamId: s.teamId,
            partnerId: s.partnerId,
          })),
        )
        .returning();

      // Generate the initial schedule
      if (d.format === "americano") {
        await persistAmericano(tx, {
          tournamentId: t.id,
          ranked: d.ranked,
          entrants: entrantRows,
          rounds: config.americanoRounds ?? defaultAmericanoRounds(n),
        });
      } else {
        const gen = generateInitialSchedule(d.format, n, config, groupOf);
        await persistGenMatches(tx, {
          tournamentId: t.id,
          matchFormat,
          ranked: d.ranked,
          gen,
          entrants: entrantRows,
        });
      }
    });

    updateTag(DATA_TAG);
    revalidatePath("/tornei");
    return { ok: true, slug };
  } catch (error) {
    console.error("[createTournament]", error);
    return { ok: false, error: "Errore nella creazione del torneo" };
  }
}

function generateInitialSchedule(
  format: string,
  n: number,
  config: TournamentConfig,
  groupOf: Map<number, string>,
): GenMatch[] {
  switch (format) {
    case "league":
      return generateRoundRobin(n, {
        stage: "league",
        doubleRound: config.doubleRound,
      });
    case "round_robin":
      return generateRoundRobin(n, { stage: "league" });
    case "single_elim":
      return generateSingleElim(n, { thirdPlace: config.thirdPlace });
    case "swiss":
      return generateSwissRound1(n);
    case "groups_knockout": {
      // round robin within each group; knockout generated after groups end
      const groups = new Map<string, number[]>();
      for (const [idx, g] of groupOf) {
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g)!.push(idx);
      }
      const out: GenMatch[] = [];
      for (const [g, indices] of groups) {
        const local = generateRoundRobin(indices.length, {
          stage: "group",
          groupName: g,
        });
        // remap local entrant indices (0..k) to global indices
        for (const m of local) {
          out.push({
            ...m,
            aEntrant: m.aEntrant == null ? null : indices[m.aEntrant],
            bEntrant: m.bEntrant == null ? null : indices[m.bEntrant],
          });
        }
      }
      return out;
    }
    default:
      return [];
  }
}

type EntrantRow = typeof tournamentEntrants.$inferSelect;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function persistGenMatches(
  tx: Tx,
  args: {
    tournamentId: string;
    matchFormat: "singles" | "doubles";
    ranked: boolean;
    gen: GenMatch[];
    entrants: EntrantRow[];
  },
) {
  const localToDb = new Map<string, string>();

  for (const g of args.gen) {
    const [row] = await tx
      .insert(matches)
      .values({
        format: args.matchFormat,
        // A bye is already resolved as a free win and never affects Elo.
        status: g.isBye ? "completed" : "scheduled",
        ranked: g.isBye ? false : args.ranked,
        tournamentId: args.tournamentId,
        stage: g.stage,
        groupName: g.groupName,
        round: g.round,
        slot: g.slot,
        note: g.label,
        entrantAId: g.aEntrant == null ? null : args.entrants[g.aEntrant].id,
        entrantBId: g.bEntrant == null ? null : args.entrants[g.bEntrant].id,
        ...(g.isBye ? { winner: "A" as const, scoreA: 0, scoreB: 0 } : {}),
      })
      .returning({ id: matches.id });
    localToDb.set(g.localId, row.id);
  }

  // wire next-match links (winner advances; loser drops to the 3°/4° final)
  for (const g of args.gen) {
    if (!g.nextLocalId && !g.loserNextLocalId) continue;
    await tx
      .update(matches)
      .set({
        ...(g.nextLocalId
          ? { nextMatchId: localToDb.get(g.nextLocalId), nextSlot: g.nextSlot }
          : {}),
        ...(g.loserNextLocalId
          ? {
              loserNextMatchId: localToDb.get(g.loserNextLocalId),
              loserNextSlot: g.loserNextSlot,
            }
          : {}),
      })
      .where(eq(matches.id, localToDb.get(g.localId)!));
  }

  // auto-advance byes (knockout round 1 with a single entrant)
  for (const g of args.gen) {
    if (g.stage !== "knockout" || g.round !== 1) continue;
    const present =
      g.aEntrant != null && g.bEntrant == null
        ? args.entrants[g.aEntrant].id
        : g.bEntrant != null && g.aEntrant == null
          ? args.entrants[g.bEntrant].id
          : null;
    if (present && g.nextLocalId) {
      await advanceEntrant(
        tx,
        localToDb.get(g.nextLocalId)!,
        g.nextSlot!,
        present,
      );
      await tx
        .update(matches)
        .set({ status: "completed" })
        .where(eq(matches.id, localToDb.get(g.localId)!));
    }
  }
}

/**
 * Persist an Americano schedule: one match per court per round, stored as a
 * doubles match with all four players written to match_participants up-front
 * (two per side). entrantA/Bid stay null — there are no entrant-vs-entrant
 * pairings here; scoring is per individual. Ratings stay empty until a result
 * is recorded, when recomputeAllElo() fills them in.
 */
async function persistAmericano(
  tx: Tx,
  args: {
    tournamentId: string;
    ranked: boolean;
    entrants: EntrantRow[];
    rounds: number;
  },
) {
  const schedule = generateAmericano(args.entrants.length, args.rounds);
  const playerOf = (idx: number) => args.entrants[idx]?.playerId ?? null;

  for (const am of schedule) {
    const aIds = am.a.map(playerOf).filter(Boolean) as string[];
    const bIds = am.b.map(playerOf).filter(Boolean) as string[];
    // Skip a malformed court (a missing player profile) rather than persist a
    // lopsided match that would corrupt the individual standings.
    if (aIds.length !== 2 || bIds.length !== 2) continue;

    const [row] = await tx
      .insert(matches)
      .values({
        format: "doubles",
        status: "scheduled",
        ranked: args.ranked,
        tournamentId: args.tournamentId,
        stage: "league",
        round: am.round,
        slot: am.slot,
      })
      .returning({ id: matches.id });

    await insertParticipants(
      tx,
      row.id,
      { playerIds: aIds, teamId: null },
      { playerIds: bIds, teamId: null },
    );
  }
}

async function advanceEntrant(
  tx: Tx,
  nextMatchId: string,
  slot: "A" | "B",
  entrantId: string,
) {
  await tx
    .update(matches)
    .set(slot === "A" ? { entrantAId: entrantId } : { entrantBId: entrantId })
    .where(eq(matches.id, nextMatchId));
}

/** One row to insert into tournament_entrants, resolved + named. */
type EntrantSpec = {
  name: string;
  playerId: string | null;
  teamId: string | null;
  partnerId: string | null;
};

/**
 * Turn the validated form input into entrant rows:
 * - singles → one player each
 * - doubles → ad-hoc couples (two player ids, no registered team)
 * - teams   → registered team entities
 * Returns null when any referenced player/team is missing or a pair is invalid.
 */
async function buildEntrantSpecs(
  d: TournamentInput,
): Promise<EntrantSpec[] | null> {
  if (d.discipline === "singles") {
    const ids = [...new Set(d.entrantIds)];
    const rows = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(inArray(players.id, ids));
    if (rows.length !== ids.length) return null;
    const map = new Map(rows.map((r) => [r.id, r.name]));
    return ids.map((id) => ({
      name: map.get(id)!,
      playerId: id,
      teamId: null,
      partnerId: null,
    }));
  }

  if (d.discipline === "teams") {
    const ids = [...new Set(d.entrantIds)];
    const rows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, ids));
    if (rows.length !== ids.length) return null;
    const map = new Map(rows.map((r) => [r.id, r.name]));
    return ids.map((id) => ({
      name: map.get(id)!,
      playerId: null,
      teamId: id,
      partnerId: null,
    }));
  }

  // doubles → ad-hoc couples
  const pairs = d.pairs;
  const allIds = [...new Set(pairs.flatMap((p) => [p.playerId, p.partnerId]))];
  const rows = await db
    .select({ id: players.id, name: players.name })
    .from(players)
    .where(inArray(players.id, allIds));
  if (rows.length !== allIds.length) return null;
  const map = new Map(rows.map((r) => [r.id, r.name]));

  // each player may appear in only one couple, and not partner themselves
  const seen = new Set<string>();
  for (const p of pairs) {
    if (p.playerId === p.partnerId) return null;
    if (seen.has(p.playerId) || seen.has(p.partnerId)) return null;
    seen.add(p.playerId);
    seen.add(p.partnerId);
  }

  return pairs.map((p) => ({
    name: `${map.get(p.playerId)!} & ${map.get(p.partnerId)!}`,
    playerId: p.playerId,
    teamId: null,
    partnerId: p.partnerId,
  }));
}

/* ----------------------------------------------------------------------------
   Record a tournament match result
---------------------------------------------------------------------------- */
export async function recordTournamentMatch(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  // Tornei "classici": regola tavolino a 15 (vantaggi, killer point a 19-19).
  const scoreCheck = validateTavolinoScore(scoreA, scoreB);
  if (!scoreCheck.ok) {
    return { ok: false, error: scoreCheck.reason };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match || !match.tournamentId) {
    return { ok: false, error: "Partita non trovata" };
  }
  if (match.status === "completed") {
    return { ok: false, error: "Risultato già registrato" };
  }
  if (!match.entrantAId || !match.entrantBId) {
    return { ok: false, error: "Partita non ancora pronta (manca un avversario)" };
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, match.tournamentId),
  });
  if (!tournament) return { ok: false, error: "Torneo non trovato" };
  if (user.role !== "admin" && tournament.createdById !== user.id) {
    return {
      ok: false,
      error: "Solo l'organizzatore o un admin può inserire i risultati",
    };
  }

  const entrantRows = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, match.tournamentId));
  const entrantById = new Map(entrantRows.map((e) => [e.id, e]));

  const entrantA = entrantById.get(match.entrantAId)!;
  const entrantB = entrantById.get(match.entrantBId)!;

  const sideA = await entrantToSide(entrantA, tournament.discipline);
  const sideB = await entrantToSide(entrantB, tournament.discipline);
  if (!sideA || !sideB) return { ok: false, error: "Partecipanti non validi" };

  const winner: "A" | "B" = scoreA > scoreB ? "A" : "B";

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({ scoreA, scoreB, winner, status: "completed", playedAt: new Date() })
        .where(eq(matches.id, matchId));

      await applyMatchResult(tx, {
        matchId,
        format: tournament.discipline === "singles" ? "singles" : "doubles",
        sideA,
        sideB,
        scoreA,
        scoreB,
        ranked: tournament.config.ranked !== false,
      });

      // Advance winner in knockout
      if (match.nextMatchId && match.nextSlot) {
        const winnerEntrantId = winner === "A" ? match.entrantAId! : match.entrantBId!;
        await advanceEntrant(tx, match.nextMatchId, match.nextSlot, winnerEntrantId);
      }
      // Drop loser into the 3°/4° place final, if wired (semifinals)
      if (match.loserNextMatchId && match.loserNextSlot) {
        const loserEntrantId = winner === "A" ? match.entrantBId! : match.entrantAId!;
        await advanceEntrant(tx, match.loserNextMatchId, match.loserNextSlot, loserEntrantId);
      }
    });

    // Post-processing outside the txn (reads fresh state)
    await maybeGenerateKnockout(tournament.id);
    await maybeCompleteTournament(tournament.id);

    updateTag(DATA_TAG);
    revalidatePath(`/tornei/${tournament.slug}`);
    revalidatePath("/tornei");
    revalidatePath("/classifica");
    return { ok: true };
  } catch (error) {
    console.error("[recordTournamentMatch]", error);
    return { ok: false, error: "Errore nel salvataggio del risultato" };
  }
}

/* ----------------------------------------------------------------------------
   Americano: record a single court result (individual scoring)
---------------------------------------------------------------------------- */
export async function recordAmericanoMatch(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  // L'Americano usa un punteggio per game configurabile ("Punti per game") ed è
  // volutamente libero: si vieta solo il pareggio, non la regola tavolino a 15.
  if (scoreA === scoreB) {
    return { ok: false, error: "Il punteggio non può finire in parità" };
  }

  const match = await db.query.matches.findFirst({
    where: eq(matches.id, matchId),
  });
  if (!match || !match.tournamentId) {
    return { ok: false, error: "Partita non trovata" };
  }
  if (match.status === "completed") {
    return { ok: false, error: "Risultato già registrato" };
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, match.tournamentId),
  });
  if (!tournament) return { ok: false, error: "Torneo non trovato" };
  if (tournament.format !== "americano") {
    return { ok: false, error: "Partita non valida per questo formato" };
  }
  if (user.role !== "admin" && tournament.createdById !== user.id) {
    return {
      ok: false,
      error: "Solo l'organizzatore o un admin può inserire i risultati",
    };
  }

  const winner: "A" | "B" = scoreA > scoreB ? "A" : "B";

  try {
    await db
      .update(matches)
      .set({ scoreA, scoreB, winner, status: "completed", playedAt: new Date() })
      .where(eq(matches.id, matchId));

    // Participants were written at schedule time, so we only set the score and
    // replay ratings — calling applyMatchResult here would duplicate them.
    if (tournament.config.ranked !== false) {
      await recomputeAllElo();
    }
    await maybeCompleteTournament(tournament.id);

    updateTag(DATA_TAG);
    revalidatePath(`/tornei/${tournament.slug}`);
    revalidatePath("/tornei");
    revalidatePath("/classifica");
    return { ok: true };
  } catch (error) {
    console.error("[recordAmericanoMatch]", error);
    return { ok: false, error: "Errore nel salvataggio del risultato" };
  }
}

async function entrantToSide(
  entrant: EntrantRow,
  discipline: string,
): Promise<SideInput | null> {
  if (discipline === "singles") {
    if (!entrant.playerId) return null;
    return { playerIds: [entrant.playerId], teamId: null };
  }

  if (discipline === "doubles") {
    // ad-hoc couple (preferred) — two player ids, no registered team
    if (entrant.playerId && entrant.partnerId) {
      return { playerIds: [entrant.playerId, entrant.partnerId], teamId: null };
    }
    // legacy doubles built from a registered team
    if (entrant.teamId) {
      const team = await db.query.teams.findFirst({
        where: eq(teams.id, entrant.teamId),
      });
      if (!team) return null;
      return { playerIds: [team.player1Id, team.player2Id], teamId: null };
    }
    return null;
  }

  // teams → registered team entity (moves the team Elo)
  if (!entrant.teamId) return null;
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, entrant.teamId),
  });
  if (!team) return null;
  return { playerIds: [team.player1Id, team.player2Id], teamId: team.id };
}

/* ----------------------------------------------------------------------------
   Groups -> knockout transition
---------------------------------------------------------------------------- */
async function maybeGenerateKnockout(tournamentId: string) {
  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t || t.format !== "groups_knockout") return;

  const all = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const groupMatches = all.filter((m) => m.stage === "group");
  const knockoutExists = all.some((m) => m.stage === "knockout");
  if (knockoutExists) return;
  if (groupMatches.some((m) => m.status !== "completed")) return;

  const entrants = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, tournamentId));

  const stEntrants: StandingEntrant[] = entrants.map((e) => ({
    id: e.id,
    name: e.name,
    groupName: e.groupName,
    seed: e.seed,
  }));
  const stMatches: StandingMatch[] = all.map(toStandingMatch);

  const groups = [...new Set(entrants.map((e) => e.groupName).filter(Boolean))] as string[];
  groups.sort();
  const perGroup = Math.max(1, t.config.advancePerGroup ?? 2);
  const qualifiers = qualifiersFromGroups(stEntrants, stMatches, groups, perGroup);
  if (qualifiers.length < 2) return;

  const matchFormat = t.discipline === "singles" ? "singles" : "doubles";
  const gen = generateSingleElim(qualifiers.length, {
    thirdPlace: t.config.thirdPlace,
  });

  await db.transaction(async (tx) => {
    const entrantRows = qualifiers.map((id) => ({ id }) as EntrantRow);
    await persistGenMatches(tx, {
      tournamentId,
      matchFormat,
      ranked: t.config.ranked !== false,
      gen,
      entrants: entrantRows,
    });
  });
}

/* ----------------------------------------------------------------------------
   Completion detection
---------------------------------------------------------------------------- */
/**
 * Winner of an Americano = the top of the individual leaderboard. Maps that
 * player back to their entrant id so it can be stored in winnerEntrantId and
 * surfaced like every other format.
 */
async function americanoWinnerEntrantId(
  tournamentId: string,
): Promise<string | null> {
  const entrants = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, tournamentId));
  const entrantByPlayer = new Map(
    entrants
      .filter((e) => e.playerId)
      .map((e) => [e.playerId as string, e.id]),
  );
  const namedPlayers = entrants
    .filter((e) => e.playerId)
    .map((e) => ({ playerId: e.playerId as string, name: e.name }));

  const matchRows = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));
  const parts = await db
    .select({
      matchId: matchParticipants.matchId,
      side: matchParticipants.side,
      playerId: matchParticipants.playerId,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(eq(matches.tournamentId, tournamentId));

  const standings = computeAmericanoStandings(
    namedPlayers,
    matchRows.map((m) => ({
      id: m.id,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winner: m.winner,
      status: m.status,
    })),
    parts as AmericanoParticipant[],
  );
  const topPlayerId = standings[0]?.playerId;
  return topPlayerId ? (entrantByPlayer.get(topPlayerId) ?? null) : null;
}

async function maybeCompleteTournament(tournamentId: string) {
  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t || t.status === "completed") return;

  const all = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  const hasKnockout = all.some((m) => m.stage === "knockout");
  const pending = all.filter((m) => m.status !== "completed");

  let winnerEntrantId: string | null = null;

  if (t.format === "americano") {
    if (all.length === 0 || pending.length > 0) return;
    winnerEntrantId = await americanoWinnerEntrantId(tournamentId);
  } else if (hasKnockout) {
    // Champion = winner of the grand final. (see tournament/knockout.ts)
    const outcome = knockoutFinalWinner(all);
    if (!outcome.decided) return;
    winnerEntrantId = outcome.winnerEntrantId;
  } else {
    if (pending.length > 0) return;
    // league/round_robin/swiss: winner = top of standings
    const entrants = await db
      .select()
      .from(tournamentEntrants)
      .where(eq(tournamentEntrants.tournamentId, tournamentId));
    const table = computeStandings(
      entrants.map((e) => ({
        id: e.id,
        name: e.name,
        groupName: e.groupName,
        seed: e.seed,
      })),
      all.map(toStandingMatch),
    );
    winnerEntrantId = table[0]?.entrant.id ?? null;
  }

  await db
    .update(tournaments)
    .set({ status: "completed", completedAt: new Date(), winnerEntrantId })
    .where(eq(tournaments.id, tournamentId));
}

function toStandingMatch(m: typeof matches.$inferSelect): StandingMatch {
  return {
    entrantAId: m.entrantAId,
    entrantBId: m.entrantBId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    winner: m.winner,
    status: m.status,
    stage: m.stage,
    groupName: m.groupName,
  };
}

/* ----------------------------------------------------------------------------
   Swiss: generate the next round
---------------------------------------------------------------------------- */
export async function generateNextSwissRound(
  tournamentId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t || t.format !== "swiss") {
    return { ok: false, error: "Torneo non valido" };
  }
  if (user.role !== "admin" && t.createdById !== user.id) {
    return {
      ok: false,
      error: "Solo l'organizzatore o un admin può gestire il torneo",
    };
  }

  const all = await db
    .select()
    .from(matches)
    .where(eq(matches.tournamentId, tournamentId));

  if (all.some((m) => m.status !== "completed")) {
    return { ok: false, error: "Completa prima tutti i match del turno corrente" };
  }
  const maxRound = Math.max(...all.map((m) => m.round ?? 0));
  const totalRounds = t.config.swissRounds ?? 3;
  if (maxRound >= totalRounds) {
    return { ok: false, error: "Il torneo svizzero ha già raggiunto l'ultimo turno" };
  }

  const entrants = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, tournamentId));

  const stEntrants: StandingEntrant[] = entrants.map((e) => ({
    id: e.id,
    name: e.name,
    groupName: e.groupName,
    seed: e.seed,
  }));
  const standings = computeStandings(stEntrants, all.map(toStandingMatch));

  // Pure pairing core: avoid rematches, give the bye to the lowest-ranked
  // entrant who has not already had one. (see tournament/swiss.ts)
  const playedPairs = all
    .filter((m) => m.entrantAId && m.entrantBId)
    .map((m) => [m.entrantAId, m.entrantBId] as [string, string]);
  const hadBye = all
    .filter((m) => m.stage === "swiss" && !m.entrantBId && m.winner === "A")
    .map((m) => m.entrantAId)
    .filter((id): id is string => !!id);

  const { pairs, byeId } = pairSwissRound({
    ranked: standings.map((s) => s.entrant.id),
    playedPairs,
    hadBye,
  });

  const matchFormat = t.discipline === "singles" ? "singles" : "doubles";
  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < pairs.length; i++) {
        await tx.insert(matches).values({
          format: matchFormat,
          status: "scheduled",
          ranked: t.config.ranked !== false,
          tournamentId,
          stage: "swiss",
          round: maxRound + 1,
          slot: i,
          entrantAId: pairs[i][0],
          entrantBId: pairs[i][1],
        });
      }
      if (byeId) {
        // Bye: already resolved as a free win, never ranked (no Elo impact).
        await tx.insert(matches).values({
          format: matchFormat,
          status: "completed",
          ranked: false,
          tournamentId,
          stage: "swiss",
          round: maxRound + 1,
          slot: pairs.length,
          entrantAId: byeId,
          entrantBId: null,
          winner: "A",
          scoreA: 0,
          scoreB: 0,
          note: "Riposo",
          playedAt: new Date(),
        });
      }
      await tx
        .update(tournaments)
        .set({ currentRound: maxRound + 1 })
        .where(eq(tournaments.id, tournamentId));
    });
    updateTag(DATA_TAG);
    revalidatePath(`/tornei/${t.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[generateNextSwissRound]", error);
    return { ok: false, error: "Errore nella generazione del turno" };
  }
}

/* ----------------------------------------------------------------------------
   Open tournaments: create (any user) → invite → join → start
---------------------------------------------------------------------------- */

type OpenTournamentInput = {
  name: string;
  format: string;
  discipline: string;
  ranked: boolean;
  description?: string;
  groups?: number;
  advancePerGroup?: number;
  swissRounds?: number;
  thirdPlace?: boolean;
  doubleRound?: boolean;
  /** americano: target score per game */
  targetScore?: number;
  /** americano: number of rotation rounds */
  americanoRounds?: number;
  /** public = listed for everyone; private = invite-only, hidden from the list */
  visibility?: "public" | "private";
};

/** Any logged-in user can create an open tournament. Generates an invite token. */
export async function createOpenTournament(
  input: OpenTournamentInput,
): Promise<CreateResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per creare un torneo" };
  }

  if (!input.name?.trim()) return { ok: false, error: "Inserisci un nome" };
  const token = crypto.randomUUID();
  const slug = await uniqueTournamentSlug(input.name);
  const config: TournamentConfig = {
    ranked: input.ranked,
    doubleRound: input.doubleRound,
    groups: input.groups,
    advancePerGroup: input.advancePerGroup,
    swissRounds: input.swissRounds,
    thirdPlace: input.thirdPlace,
    targetScore: input.targetScore,
    americanoRounds: input.americanoRounds,
  };

  try {
    await db.insert(tournaments).values({
      name: input.name.trim(),
      slug,
      format: input.format as typeof tournaments.$inferInsert["format"],
      discipline: input.discipline as typeof tournaments.$inferInsert["discipline"],
      status: "draft",
      description: input.description || null,
      config,
      currentRound: 0,
      inviteToken: token,
      openInvite: true,
      visibility: input.visibility === "private" ? "private" : "public",
      createdById: user.id,
    });
    updateTag(DATA_TAG);
    revalidatePath("/tornei");
    return { ok: true, slug };
  } catch (error) {
    console.error("[createOpenTournament]", error);
    return { ok: false, error: "Errore nella creazione del torneo" };
  }
}

/** Join an open tournament via invite token. Adds the player (singles) or skips (doubles need a team). */
export async function joinTournament(
  token: string,
): Promise<ActionResult & { slug?: string }> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per unirti al torneo" };
  }
  if (!user.playerId) {
    return { ok: false, error: "Il tuo account non ha un profilo giocatore" };
  }

  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.inviteToken, token),
  });
  if (!t) return { ok: false, error: "Link di invito non valido" };
  if (!t.openInvite) return { ok: false, error: "Il torneo non è aperto agli inviti" };
  if (t.status !== "draft") return { ok: false, error: "Il torneo è già iniziato" };
  if (t.discipline !== "singles") {
    return { ok: false, error: "Per i tornei a coppie iscriviti tramite il tuo team" };
  }

  // Private tournaments are invite-only: a link alone is not enough.
  if (t.visibility === "private" && t.createdById !== user.id) {
    const invite = await db.query.tournamentInvites.findFirst({
      where: and(
        eq(tournamentInvites.tournamentId, t.id),
        eq(tournamentInvites.invitedUserId, user.id),
      ),
    });
    if (!invite) {
      return {
        ok: false,
        error: "Questo torneo è privato: serve un invito per partecipare",
      };
    }
  }

  const already = await db.query.tournamentEntrants.findFirst({
    where: and(
      eq(tournamentEntrants.tournamentId, t.id),
      eq(tournamentEntrants.playerId, user.playerId),
    ),
  });
  if (already) return { ok: true, slug: t.slug };

  const player = await db.query.players.findFirst({
    where: eq(players.id, user.playerId),
  });
  if (!player) return { ok: false, error: "Profilo giocatore non trovato" };

  const existing = await db
    .select({ id: tournamentEntrants.id })
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, t.id));
  const seed = existing.length + 1;

  await db.insert(tournamentEntrants).values({
    tournamentId: t.id,
    name: player.name,
    seed,
    playerId: player.id,
    teamId: null,
    groupName: null,
  });

  // Joining settles any pending invite for this user.
  await db
    .update(tournamentInvites)
    .set({ status: "accepted" })
    .where(
      and(
        eq(tournamentInvites.tournamentId, t.id),
        eq(tournamentInvites.invitedUserId, user.id),
      ),
    );

  updateTag(DATA_TAG);
  revalidatePath(`/tornei/${t.slug}`);
  revalidatePath("/tornei");
  return { ok: true, slug: t.slug };
}

/**
 * Invite specific accounts (friends) to a tournament. Only the creator or an
 * admin may invite. Inserts invite rows (idempotent) and fires a push to each
 * newly-invited user. Returns the number of new invites created.
 */
export async function inviteFriendsToTournament(
  tournamentId: string,
  userIds: string[],
): Promise<ActionResult & { invited?: number }> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t) return { ok: false, error: "Torneo non trovato" };
  if (user.role !== "admin" && t.createdById !== user.id) {
    return { ok: false, error: "Solo l'organizzatore può invitare" };
  }

  // Only invite people who are actually the caller's friends (or anyone if admin).
  const friendIds = new Set((await getFriends(user.id)).map((f) => f.userId));
  const targets = [...new Set(userIds.filter(Boolean))].filter(
    (id) => id !== user.id && (user.role === "admin" || friendIds.has(id)),
  );
  if (targets.length === 0) {
    return { ok: false, error: "Seleziona almeno un amico da invitare" };
  }

  // Skip users already invited so we only push to the genuinely new ones.
  const existing = await db
    .select({ id: tournamentInvites.invitedUserId })
    .from(tournamentInvites)
    .where(eq(tournamentInvites.tournamentId, tournamentId));
  const alreadyInvited = new Set(existing.map((r) => r.id));
  const fresh = targets.filter((id) => !alreadyInvited.has(id));

  if (fresh.length > 0) {
    await db.insert(tournamentInvites).values(
      fresh.map((id) => ({
        tournamentId,
        invitedUserId: id,
        invitedById: user.id,
      })),
    );

    await sendPushToUsers(fresh, {
      title: "Invito a un torneo 🎾",
      body: `${user.name} ti ha invitato a "${t.name}"`,
      url: `/tornei/${t.slug}`,
      tag: `tournament-invite-${t.id}`,
    });
  }

  updateTag(DATA_TAG);
  revalidatePath(`/tornei/${t.slug}`);
  return { ok: true, invited: fresh.length };
}

/** Creator or admin starts a draft tournament, generating the match schedule. */
export async function startTournament(
  tournamentId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }

  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
    with: { entrants: true },
  });
  if (!t) return { ok: false, error: "Torneo non trovato" };
  if (t.status !== "draft") return { ok: false, error: "Il torneo non è in bozza" };

  const isCreator = t.createdById === user.id;
  if (!isCreator && user.role !== "admin") {
    return { ok: false, error: "Solo il creatore o un admin può avviare il torneo" };
  }

  const entrantIds = t.entrants.map((e) => e.id);
  if (entrantIds.length < 2) {
    return { ok: false, error: "Servono almeno 2 partecipanti per avviare" };
  }

  // Americano: rotating-partner doubles with an individual leaderboard. It has
  // its own scheduler (four players per court) and skips the entrant-vs-entrant
  // generators used by the other formats.
  if (t.format === "americano") {
    if (entrantIds.length < 4) {
      return { ok: false, error: "L'Americano richiede almeno 4 giocatori" };
    }
    const rounds =
      t.config.americanoRounds ?? defaultAmericanoRounds(entrantIds.length);
    try {
      await db.transaction(async (tx) => {
        await persistAmericano(tx, {
          tournamentId: t.id,
          ranked: t.config.ranked !== false,
          entrants: t.entrants,
          rounds,
        });
        await tx
          .update(tournaments)
          .set({ status: "active", currentRound: 1, startedAt: new Date() })
          .where(eq(tournaments.id, tournamentId));
      });
      updateTag(DATA_TAG);
      revalidatePath(`/tornei/${t.slug}`);
      revalidatePath("/tornei");
      return { ok: true };
    } catch (error) {
      console.error("[startTournament:americano]", error);
      return { ok: false, error: "Errore nell'avvio del torneo" };
    }
  }

  const isSingles = t.discipline === "singles";
  const matchFormat = isSingles ? "singles" : "doubles";
  const config = t.config;

  const groupOf = new Map<number, string>();
  if (t.format === "groups_knockout") {
    const numGroups = Math.max(2, Math.min(config.groups ?? 2, GROUP_LABELS.length));
    const buckets = splitIntoGroups(entrantIds.length, numGroups);
    buckets.forEach((indices, g) => {
      for (const idx of indices) groupOf.set(idx, GROUP_LABELS[g]);
    });
  }

  try {
    await db.transaction(async (tx) => {
      const gen = generateInitialSchedule(t.format, entrantIds.length, config, groupOf);
      await persistGenMatches(tx, {
        tournamentId: t.id,
        matchFormat,
        ranked: config.ranked !== false,
        gen,
        entrants: t.entrants,
      });
      await tx
        .update(tournaments)
        .set({ status: "active", currentRound: 1, startedAt: new Date() })
        .where(eq(tournaments.id, tournamentId));
    });
    updateTag(DATA_TAG);
    revalidatePath(`/tornei/${t.slug}`);
    revalidatePath("/tornei");
    return { ok: true };
  } catch (error) {
    console.error("[startTournament]", error);
    return { ok: false, error: "Errore nell'avvio del torneo" };
  }
}

export async function deleteTournament(
  tournamentId: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  try {
    const t = await db.query.tournaments.findFirst({
      where: eq(tournaments.id, tournamentId),
    });
    await db.delete(tournaments).where(eq(tournaments.id, tournamentId));
    // Tournament matches affected Elo; rebuild to stay consistent.
    const { recomputeAllElo } = await import("@/lib/match-engine");
    await recomputeAllElo();
    updateTag(DATA_TAG);
    revalidatePath("/tornei");
    revalidatePath("/classifica");
    if (t) revalidatePath(`/tornei/${t.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[deleteTournament]", error);
    return { ok: false, error: "Errore nell'eliminazione del torneo" };
  }
}
