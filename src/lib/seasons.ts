import { and, eq, gte, lt, inArray } from "drizzle-orm";
import { db } from "./db";
import { matches, matchParticipants, players } from "./db/schema";
import { cachedQuery } from "./cache";

/**
 * Seasons = calendar months. Standings are recomputed on the fly from the
 * completed ranked matches played within a month, so there's no season table to
 * maintain — the month boundaries are the only state, and they're derived from
 * the date. Pure date helpers are kept side-effect-free and testable.
 */

const MONTHS_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export type Season = {
  year: number;
  /** 1-12 */
  month: number;
  /** e.g. "giugno 2026" */
  label: string;
  /** inclusive start — first instant of the month */
  start: Date;
  /** exclusive end — first instant of the next month */
  end: Date;
};

/** Build a season from a 1-12 month number. */
export function makeSeason(year: number, month: number): Season {
  // JS Date months are 0-indexed; our API speaks 1-12.
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return { year, month, label: `${MONTHS_IT[month - 1]} ${year}`, start, end };
}

/** The season (month) that a given date falls into. */
export function seasonForDate(d: Date): Season {
  return makeSeason(d.getFullYear(), d.getMonth() + 1);
}

/** The season immediately before the given one (rolls the year over in January). */
export function previousSeason(s: Season): Season {
  return s.month === 1
    ? makeSeason(s.year - 1, 12)
    : makeSeason(s.year, s.month - 1);
}

export type SeasonStanding = {
  player: typeof players.$inferSelect;
  played: number;
  won: number;
  lost: number;
  pointDiff: number;
  winRate: number;
  /** Season points — 3 per win. */
  points: number;
};

/**
 * Standings for completed RANKED matches whose `playedAt` falls in [start, end).
 * Only players who actually played in the window appear. Sorted by season points
 * (wins), then win-rate, then point difference. Wrapped in the shared cache and
 * busted by bustDataCache() like every other read; the Date args key each month
 * separately.
 */
async function getSeasonStandingsImpl(
  start: Date,
  end: Date,
): Promise<SeasonStanding[]> {
  const rows = await db
    .select({
      playerId: matchParticipants.playerId,
      side: matchParticipants.side,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      winner: matches.winner,
    })
    .from(matchParticipants)
    .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
    .where(
      and(
        eq(matches.status, "completed"),
        eq(matches.ranked, true),
        gte(matches.playedAt, start),
        lt(matches.playedAt, end),
      ),
    );

  const acc = new Map<
    string,
    { played: number; won: number; lost: number; pf: number; pa: number }
  >();
  for (const r of rows) {
    const isA = r.side === "A";
    const pf = (isA ? r.scoreA : r.scoreB) ?? 0;
    const pa = (isA ? r.scoreB : r.scoreA) ?? 0;
    const won = r.winner === r.side;
    const cur = acc.get(r.playerId) ?? {
      played: 0,
      won: 0,
      lost: 0,
      pf: 0,
      pa: 0,
    };
    cur.played++;
    cur.pf += pf;
    cur.pa += pa;
    if (won) cur.won++;
    else cur.lost++;
    acc.set(r.playerId, cur);
  }

  const ids = [...acc.keys()];
  if (!ids.length) return [];

  const playerRows = await db
    .select()
    .from(players)
    .where(inArray(players.id, ids));
  const byId = new Map(playerRows.map((p) => [p.id, p]));

  const result = ids
    .map((id) => {
      const a = acc.get(id)!;
      const player = byId.get(id);
      if (!player) return null;
      return {
        player,
        played: a.played,
        won: a.won,
        lost: a.lost,
        pointDiff: a.pf - a.pa,
        winRate: a.played > 0 ? a.won / a.played : 0,
        points: a.won * 3,
      } satisfies SeasonStanding;
    })
    .filter((x): x is SeasonStanding => x !== null);

  result.sort(
    (x, y) =>
      y.points - x.points ||
      y.winRate - x.winRate ||
      y.pointDiff - x.pointDiff ||
      y.won - x.won,
  );
  return result;
}

export const getSeasonStandings = cachedQuery(getSeasonStandingsImpl, [
  "season-standings",
]);
