"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentEntrants,
  matches,
  teams,
  players,
  type TournamentConfig,
} from "@/lib/db/schema";
import { tournamentSchema } from "@/lib/validation";
import { assertAdmin } from "@/lib/auth-helpers";
import { slugify } from "@/lib/utils";
import { applyMatchResult, type SideInput } from "@/lib/match-engine";
import {
  generateRoundRobin,
  generateSingleElim,
  generateSwissRound1,
  splitIntoGroups,
  GROUP_LABELS,
  type GenMatch,
} from "@/lib/tournament/generators";
import {
  computeStandings,
  qualifiersFromGroups,
  type StandingEntrant,
  type StandingMatch,
} from "@/lib/tournament/standings";
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
  const entrantIds = [...new Set(d.entrantIds)];
  if (entrantIds.length < 2) {
    return { ok: false, error: "Servono almeno 2 partecipanti distinti" };
  }

  const isSingles = d.discipline === "singles";
  const matchFormat = isSingles ? "singles" : "doubles";

  // Resolve entrant display names
  const names = await resolveEntrantNames(entrantIds, isSingles);
  if (!names) {
    return { ok: false, error: "Partecipanti non validi" };
  }

  const config: TournamentConfig = {
    ranked: d.ranked,
    doubleRound: d.doubleRound,
    groups: d.groups,
    advancePerGroup: d.advancePerGroup,
    swissRounds: d.swissRounds,
    thirdPlace: d.thirdPlace,
  };

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
        const buckets = splitIntoGroups(entrantIds.length, groups);
        buckets.forEach((indices, g) => {
          for (const idx of indices) groupOf.set(idx, GROUP_LABELS[g]);
        });
      }

      // Insert entrants in seeded order
      const entrantRows = await tx
        .insert(tournamentEntrants)
        .values(
          entrantIds.map((eid, i) => ({
            tournamentId: t.id,
            name: names[i],
            seed: i + 1,
            groupName: groupOf.get(i) ?? null,
            playerId: isSingles ? eid : null,
            teamId: isSingles ? null : eid,
          })),
        )
        .returning();

      // Generate the initial schedule
      const gen = generateInitialSchedule(d.format, entrantIds.length, config, groupOf);

      await persistGenMatches(tx, {
        tournamentId: t.id,
        matchFormat,
        ranked: d.ranked,
        gen,
        entrants: entrantRows,
      });
    });

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
        status: "scheduled",
        ranked: args.ranked,
        tournamentId: args.tournamentId,
        stage: g.stage,
        groupName: g.groupName,
        round: g.round,
        slot: g.slot,
        note: g.label,
        entrantAId: g.aEntrant == null ? null : args.entrants[g.aEntrant].id,
        entrantBId: g.bEntrant == null ? null : args.entrants[g.bEntrant].id,
      })
      .returning({ id: matches.id });
    localToDb.set(g.localId, row.id);
  }

  // wire next-match links
  for (const g of args.gen) {
    if (g.nextLocalId) {
      await tx
        .update(matches)
        .set({
          nextMatchId: localToDb.get(g.nextLocalId),
          nextSlot: g.nextSlot,
        })
        .where(eq(matches.id, localToDb.get(g.localId)!));
    }
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

async function resolveEntrantNames(
  ids: string[],
  isSingles: boolean,
): Promise<string[] | null> {
  if (isSingles) {
    const rows = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(inArray(players.id, ids));
    const map = new Map(rows.map((r) => [r.id, r.name]));
    if (rows.length !== ids.length) return null;
    return ids.map((id) => map.get(id)!);
  }
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, ids));
  const map = new Map(rows.map((r) => [r.id, r.name]));
  if (rows.length !== ids.length) return null;
  return ids.map((id) => map.get(id)!);
}

/* ----------------------------------------------------------------------------
   Record a tournament match result
---------------------------------------------------------------------------- */
export async function recordTournamentMatch(
  matchId: string,
  scoreA: number,
  scoreB: number,
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
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
  if (!match.entrantAId || !match.entrantBId) {
    return { ok: false, error: "Partita non ancora pronta (manca un avversario)" };
  }

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, match.tournamentId),
  });
  if (!tournament) return { ok: false, error: "Torneo non trovato" };

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
    });

    // Post-processing outside the txn (reads fresh state)
    await maybeGenerateKnockout(tournament.id);
    await maybeCompleteTournament(tournament.id);

    revalidatePath(`/tornei/${tournament.slug}`);
    revalidatePath("/tornei");
    revalidatePath("/classifica");
    return { ok: true };
  } catch (error) {
    console.error("[recordTournamentMatch]", error);
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
  if (!entrant.teamId) return null;
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, entrant.teamId),
  });
  if (!team) return null;
  return {
    playerIds: [team.player1Id, team.player2Id],
    teamId: discipline === "teams" ? team.id : null,
  };
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

  if (hasKnockout) {
    // Final = the knockout match with the highest round and no nextMatch
    const knockout = all.filter((m) => m.stage === "knockout" && m.note !== "Finale 3°/4°");
    const maxRound = Math.max(...knockout.map((m) => m.round ?? 0));
    const final = knockout.find((m) => m.round === maxRound && !m.nextMatchId);
    if (final && final.status === "completed") {
      winnerEntrantId = final.winner === "A" ? final.entrantAId : final.entrantBId;
    } else {
      return;
    }
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
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }

  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.id, tournamentId),
  });
  if (!t || t.format !== "swiss") {
    return { ok: false, error: "Torneo non valido" };
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

  // Avoid rematches
  const played = new Set<string>();
  for (const m of all) {
    if (m.entrantAId && m.entrantBId) {
      played.add(pairKey(m.entrantAId, m.entrantBId));
    }
  }

  const queue = standings.map((s) => s.entrant.id);
  const pairs: [string, string][] = [];
  const used = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const a = queue[i];
    if (used.has(a)) continue;
    let partner: string | null = null;
    for (let j = i + 1; j < queue.length; j++) {
      const b = queue[j];
      if (used.has(b)) continue;
      if (!played.has(pairKey(a, b))) {
        partner = b;
        break;
      }
    }
    // fallback: first available even if rematch
    if (!partner) {
      partner = queue.find((b) => b !== a && !used.has(b)) ?? null;
    }
    if (partner) {
      used.add(a);
      used.add(partner);
      pairs.push([a, partner]);
    }
  }

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
      await tx
        .update(tournaments)
        .set({ currentRound: maxRound + 1 })
        .where(eq(tournaments.id, tournamentId));
    });
    revalidatePath(`/tornei/${t.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[generateNextSwissRound]", error);
    return { ok: false, error: "Errore nella generazione del turno" };
  }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(":");
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
    revalidatePath("/tornei");
    revalidatePath("/classifica");
    if (t) revalidatePath(`/tornei/${t.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[deleteTournament]", error);
    return { ok: false, error: "Errore nell'eliminazione del torneo" };
  }
}
