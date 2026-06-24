import { and, isNull, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { matches, players } from "./db/schema";
import { applyMatchResult, recomputeAllElo } from "./match-engine";

/**
 * Demo data lives here so both the seed (build time) and the admin panel use
 * the same set. A demo match is a casual match with no creator and no
 * tournament (createdById IS NULL AND tournamentId IS NULL) — real matches
 * always have a creator, tournament matches always have a tournamentId, so the
 * marker never touches real data.
 *
 * Tavolino: si vince arrivando a 15. Sul 14-14 si va ai vantaggi (due punti
 * di scarto) fino al killer point: a 19-19 il 20° punto è decisivo (20-19).
 */
type DemoSingle = [string, string, number, number, boolean];
type DemoDouble = [[string, string], [string, string], number, number, boolean];

export const DEMO_SINGLES: DemoSingle[] = [
  ["mesh", "bernu", 15, 11, true],
  ["edo", "toro", 15, 13, true],
  ["dadda", "pau", 13, 15, true],
  ["jaco", "mesh", 17, 15, true], // ai vantaggi
  ["bernu", "edo", 15, 9, true],
  ["toro", "dadda", 13, 15, false],
  ["pau", "jaco", 15, 12, false],
  ["mesh", "edo", 15, 10, false],
  ["bernu", "pau", 11, 15, false],
  ["dadda", "jaco", 20, 19, false], // killer point
];

export const DEMO_DOUBLES: DemoDouble[] = [
  [["mesh", "bernu"], ["edo", "toro"], 15, 13, true],
  [["dadda", "pau"], ["jaco", "mesh"], 15, 17, true], // ai vantaggi
  [["bernu", "edo"], ["toro", "dadda"], 15, 9, true],
  [["pau", "jaco"], ["mesh", "edo"], 15, 11, true],
  [["toro", "bernu"], ["dadda", "jaco"], 13, 15, true],
  [["mesh", "toro"], ["edo", "pau"], 15, 11, false],
  [["bernu", "jaco"], ["dadda", "mesh"], 16, 14, false], // ai vantaggi
  [["edo", "dadda"], ["pau", "toro"], 13, 15, false],
  [["jaco", "bernu"], ["mesh", "pau"], 15, 7, false],
  [["toro", "edo"], ["dadda", "bernu"], 20, 19, false], // killer point
];

export const DEMO_TOTAL = DEMO_SINGLES.length + DEMO_DOUBLES.length;

const demoMarker = and(isNull(matches.createdById), isNull(matches.tournamentId));

export async function countDemoMatches(): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(matches)
    .where(demoMarker);
  return row?.c ?? 0;
}

/** Delete all demo matches and rebuild ratings. Returns how many were removed. */
export async function clearDemoMatches(): Promise<number> {
  const existing = await countDemoMatches();
  if (existing > 0) {
    await db.delete(matches).where(demoMarker);
    await recomputeAllElo();
  }
  return existing;
}

/** (Re)create the full demo set. Clears any existing demo first. */
export async function insertDemoMatches(): Promise<number> {
  await db.delete(matches).where(demoMarker);

  // resolve nicknames -> player ids by slug
  const nicks = new Set<string>();
  for (const [a, b] of DEMO_SINGLES) {
    nicks.add(a);
    nicks.add(b);
  }
  for (const [pa, pb] of DEMO_DOUBLES) {
    pa.forEach((n) => nicks.add(n));
    pb.forEach((n) => nicks.add(n));
  }
  const rows = await db
    .select({ id: players.id, slug: players.slug })
    .from(players)
    .where(inArray(players.slug, [...nicks]));
  const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
  const id = (n: string) => bySlug.get(n);

  let i = 0;
  let inserted = 0;

  const add = async (
    format: "singles" | "doubles",
    aIds: string[],
    bIds: string[],
    sa: number,
    sb: number,
    ranked: boolean,
  ) => {
    if (aIds.includes(undefined as unknown as string)) return;
    if (bIds.includes(undefined as unknown as string)) return;
    const playedAt = new Date(Date.now() - (DEMO_TOTAL - i) * 43200000);
    i++;
    await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(matches)
        .values({
          format,
          status: "completed",
          ranked,
          scoreA: sa,
          scoreB: sb,
          winner: sa > sb ? "A" : "B",
          playedAt,
        })
        .returning({ id: matches.id });
      await applyMatchResult(tx, {
        matchId: m.id,
        format,
        sideA: { playerIds: aIds, teamId: null },
        sideB: { playerIds: bIds, teamId: null },
        scoreA: sa,
        scoreB: sb,
        ranked,
      });
    });
    inserted++;
  };

  for (const [a, b, sa, sb, r] of DEMO_SINGLES) {
    const ia = id(a);
    const ib = id(b);
    if (ia && ib) await add("singles", [ia], [ib], sa, sb, r);
  }
  for (const [pa, pb, sa, sb, r] of DEMO_DOUBLES) {
    const a1 = id(pa[0]);
    const a2 = id(pa[1]);
    const b1 = id(pb[0]);
    const b2 = id(pb[1]);
    if (a1 && a2 && b1 && b2) await add("doubles", [a1, a2], [b1, b2], sa, sb, r);
  }

  await recomputeAllElo();
  return inserted;
}
