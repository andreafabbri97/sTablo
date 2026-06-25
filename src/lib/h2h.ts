import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { matches, matchParticipants, players } from "./db/schema";
import { shapeMatch, matchWith, type ShapedMatch } from "./queries";
import { cachedQuery } from "./cache";

export type H2HPlayer = {
  id: string;
  name: string;
  slug: string;
  avatarColor: number;
  avatarUrl: string | null;
};

export type H2HFormatRecord = { total: number; aWins: number; bWins: number };

export type HeadToHead = {
  a: H2HPlayer;
  b: H2HPlayer;
  total: number;
  aWins: number;
  bWins: number;
  /** Total points scored across all head-to-head encounters. */
  aPoints: number;
  bPoints: number;
  singles: H2HFormatRecord;
  doubles: H2HFormatRecord;
  /** Encounters, most recent first. */
  matches: ShapedMatch[];
};

function toLite(p: typeof players.$inferSelect): H2HPlayer {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    avatarColor: p.avatarColor,
    avatarUrl: p.avatarUrl,
  };
}

/** Which side a player is on in a shaped match, or null if absent. */
export function sideOf(m: ShapedMatch, playerId: string): "A" | "B" | null {
  if (m.sideA.players.some((p) => p.id === playerId)) return "A";
  if (m.sideB.players.some((p) => p.id === playerId)) return "B";
  return null;
}

function emptyRecord(): H2HFormatRecord {
  return { total: 0, aWins: 0, bWins: 0 };
}

function empty(a: H2HPlayer, b: H2HPlayer): HeadToHead {
  return {
    a,
    b,
    total: 0,
    aWins: 0,
    bWins: 0,
    aPoints: 0,
    bPoints: 0,
    singles: emptyRecord(),
    doubles: emptyRecord(),
    matches: [],
  };
}

/**
 * Pure tally of head-to-head from already-loaded matches. Keeps only completed
 * encounters where the two players were on OPPOSITE sides, then aggregates wins,
 * points and per-format records. Exported for unit testing.
 */
export function tallyHeadToHead(
  aLite: H2HPlayer,
  bLite: H2HPlayer,
  loaded: ShapedMatch[],
): HeadToHead {
  const result = empty(aLite, bLite);

  const encounters = loaded.filter((m) => {
    if (m.status !== "completed") return false;
    const sa = sideOf(m, aLite.id);
    const sb = sideOf(m, bLite.id);
    return sa !== null && sb !== null && sa !== sb;
  });

  result.matches = encounters;
  result.total = encounters.length;

  for (const m of encounters) {
    const aSide = sideOf(m, aLite.id)!; // present by construction
    const aScore = (aSide === "A" ? m.scoreA : m.scoreB) ?? 0;
    const bScore = (aSide === "A" ? m.scoreB : m.scoreA) ?? 0;
    result.aPoints += aScore;
    result.bPoints += bScore;

    const aWon = m.winner === aSide;
    const rec = m.format === "singles" ? result.singles : result.doubles;
    rec.total++;
    if (aWon) {
      result.aWins++;
      rec.aWins++;
    } else {
      result.bWins++;
      rec.bWins++;
    }
  }

  return result;
}

/**
 * Head-to-head record between two players by slug. Counts only completed
 * matches where the two were on OPPOSITE sides (true confrontations), across
 * both singles and doubles. Returns null if either slug is unknown or equal.
 */
async function getHeadToHeadImpl(
  aSlug: string,
  bSlug: string,
): Promise<HeadToHead | null> {
  if (aSlug === bSlug) return null;

  const found = await db
    .select()
    .from(players)
    .where(inArray(players.slug, [aSlug, bSlug]));
  const a = found.find((p) => p.slug === aSlug);
  const b = found.find((p) => p.slug === bSlug);
  if (!a || !b) return null;

  const aLite = toLite(a);
  const bLite = toLite(b);

  // Match ids each player took part in, then intersect.
  const [aRows, bRows] = await Promise.all([
    db
      .select({ matchId: matchParticipants.matchId })
      .from(matchParticipants)
      .where(eq(matchParticipants.playerId, a.id)),
    db
      .select({ matchId: matchParticipants.matchId })
      .from(matchParticipants)
      .where(eq(matchParticipants.playerId, b.id)),
  ]);
  const aSet = new Set(aRows.map((r) => r.matchId));
  const sharedIds = [...new Set(bRows.map((r) => r.matchId))].filter((id) =>
    aSet.has(id),
  );
  if (sharedIds.length === 0) return empty(aLite, bLite);

  const rows = await db.query.matches.findMany({
    where: and(inArray(matches.id, sharedIds), eq(matches.status, "completed")),
    orderBy: [desc(matches.playedAt)],
    with: matchWith,
  });

  return tallyHeadToHead(aLite, bLite, rows.map(shapeMatch));
}

export const getHeadToHead = cachedQuery(getHeadToHeadImpl, ["head-to-head"]);
