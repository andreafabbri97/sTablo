import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { matches, matchParticipants } from "./db/schema";
import { shapeMatch, type ShapedMatch } from "./queries";
import { sideOf } from "./h2h";
import { cachedQuery } from "./cache";

/**
 * Deeper personal stats for a player's profile: recent form, the opponent who
 * beats them most (nemesis), the opponent they beat most (favourite victim), and
 * their best doubles partner. All derived in a single pure pass over the
 * player's completed matches, so the heavy lifting is unit-testable.
 */

/** Minimum shared matches before a rivalry / partnership is worth naming. */
export const MIN_ENCOUNTERS = 2;

/** How many recent results the form strip shows. */
export const FORM_LENGTH = 6;

export type InsightPlayer = {
  id: string;
  name: string;
  slug: string;
  avatarColor: number;
  avatarUrl: string | null;
};

export type OpponentRecord = {
  player: InsightPlayer;
  played: number;
  /** Wins by the subject player against this opponent. */
  won: number;
  lost: number;
  winRate: number;
};

export type PartnerRecord = {
  player: InsightPlayer;
  played: number;
  won: number;
  winRate: number;
};

export type FormGame = {
  matchId: string;
  won: boolean;
  scoreFor: number;
  scoreAgainst: number;
  format: "singles" | "doubles";
  playedAt: Date;
};

export type PlayerInsights = {
  /** Most recent first, up to FORM_LENGTH. */
  form: FormGame[];
  /** Opponent who has beaten the player the most. */
  nemesis: OpponentRecord | null;
  /** Opponent the player has beaten the most. */
  victim: OpponentRecord | null;
  /** Doubles partner with the best win-rate alongside the player. */
  bestPartner: PartnerRecord | null;
};

function lite(p: ShapedMatch["sideA"]["players"][number]): InsightPlayer {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    avatarColor: p.colorIndex,
    avatarUrl: p.imageUrl,
  };
}

const EMPTY: PlayerInsights = {
  form: [],
  nemesis: null,
  victim: null,
  bestPartner: null,
};

/**
 * Fold a player's completed matches into form + rivalries + best partner. Pure:
 * takes already-shaped matches so it can be exercised without a database.
 */
export function computeInsights(
  playerId: string,
  loaded: ShapedMatch[],
): PlayerInsights {
  const completed = loaded.filter((m) => {
    if (m.status !== "completed") return false;
    return sideOf(m, playerId) !== null;
  });
  if (completed.length === 0) return { ...EMPTY };

  // Newest first for the form strip.
  const byRecent = [...completed].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime(),
  );

  const form: FormGame[] = byRecent.slice(0, FORM_LENGTH).map((m) => {
    const side = sideOf(m, playerId)!;
    const scoreFor = (side === "A" ? m.scoreA : m.scoreB) ?? 0;
    const scoreAgainst = (side === "A" ? m.scoreB : m.scoreA) ?? 0;
    return {
      matchId: m.id,
      won: m.winner === side,
      scoreFor,
      scoreAgainst,
      format: m.format,
      playedAt: m.playedAt,
    };
  });

  // Per-opponent (faced on the opposite side) and per-partner (same side, doubles).
  const opp = new Map<string, { p: InsightPlayer; played: number; won: number; lost: number }>();
  const partner = new Map<string, { p: InsightPlayer; played: number; won: number }>();

  for (const m of completed) {
    const side = sideOf(m, playerId)!;
    const won = m.winner === side;
    const mySide = side === "A" ? m.sideA : m.sideB;
    const otherSide = side === "A" ? m.sideB : m.sideA;

    for (const o of otherSide.players) {
      const cur = opp.get(o.id) ?? { p: lite(o), played: 0, won: 0, lost: 0 };
      cur.played++;
      if (won) cur.won++;
      else cur.lost++;
      opp.set(o.id, cur);
    }

    if (m.format === "doubles") {
      for (const mate of mySide.players) {
        if (mate.id === playerId) continue;
        const cur = partner.get(mate.id) ?? { p: lite(mate), played: 0, won: 0 };
        cur.played++;
        if (won) cur.won++;
        partner.set(mate.id, cur);
      }
    }
  }

  const opponents = [...opp.values()].filter((o) => o.played >= MIN_ENCOUNTERS);
  const partners = [...partner.values()].filter((p) => p.played >= MIN_ENCOUNTERS);

  // Nemesis: most losses against; tie-break by lowest win-rate, then most played.
  const nemesisSrc = opponents
    .filter((o) => o.lost > 0)
    .sort(
      (a, b) =>
        b.lost - a.lost ||
        a.won / a.played - b.won / b.played ||
        b.played - a.played,
    )[0];

  // Favourite victim: most wins against; tie-break by highest win-rate, then most played.
  const victimSrc = opponents
    .filter((o) => o.won > 0)
    .sort(
      (a, b) =>
        b.won - a.won ||
        b.won / b.played - a.won / a.played ||
        b.played - a.played,
    )[0];

  // Best partner: highest win-rate together; tie-break by most wins, then most played.
  const partnerSrc = partners
    .filter((p) => p.won > 0)
    .sort(
      (a, b) =>
        b.won / b.played - a.won / a.played ||
        b.won - a.won ||
        b.played - a.played,
    )[0];

  return {
    form,
    nemesis: nemesisSrc
      ? {
          player: nemesisSrc.p,
          played: nemesisSrc.played,
          won: nemesisSrc.won,
          lost: nemesisSrc.lost,
          winRate: nemesisSrc.won / nemesisSrc.played,
        }
      : null,
    victim: victimSrc
      ? {
          player: victimSrc.p,
          played: victimSrc.played,
          won: victimSrc.won,
          lost: victimSrc.lost,
          winRate: victimSrc.won / victimSrc.played,
        }
      : null,
    bestPartner: partnerSrc
      ? {
          player: partnerSrc.p,
          played: partnerSrc.played,
          won: partnerSrc.won,
          winRate: partnerSrc.won / partnerSrc.played,
        }
      : null,
  };
}

/** Load a player's completed matches and fold them into insights (cached). */
async function getPlayerInsightsImpl(playerId: string): Promise<PlayerInsights> {
  const partRows = await db
    .select({ matchId: matchParticipants.matchId })
    .from(matchParticipants)
    .where(eq(matchParticipants.playerId, playerId));
  const ids = [...new Set(partRows.map((r) => r.matchId))];
  if (ids.length === 0) return { ...EMPTY };

  const rows = await db.query.matches.findMany({
    where: inArray(matches.id, ids),
    with: { participants: { with: { player: true, team: true } } },
  });

  return computeInsights(playerId, rows.map(shapeMatch));
}

export const getPlayerInsights = cachedQuery(getPlayerInsightsImpl, [
  "player-insights",
]);
