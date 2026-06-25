/**
 * Gamification layer: play styles, XP/levels and FIFA-card style attributes
 * derived from a player's real match record.
 */

export type PlayStyle = {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** attribute that gets a small flavor boost */
  boosts: AttributeKey;
};

export const PLAY_STYLES: PlayStyle[] = [
  { id: "muro", name: "Il Muro", emoji: "🧱", tagline: "Non passa niente, mai", boosts: "difesa" },
  { id: "bomber", name: "Il Bomber", emoji: "💥", tagline: "Colpisci forte, chiudi il punto", boosts: "potenza" },
  { id: "regista", name: "Il Regista", emoji: "🎼", tagline: "Comandi tu il ritmo del tavolo", boosts: "tecnica" },
  { id: "acrobata", name: "L'Acrobata", emoji: "🤸", tagline: "Spettacolo a ogni rovesciata", boosts: "tecnica" },
  { id: "fulmine", name: "Il Fulmine", emoji: "⚡", tagline: "Primo su ogni pallone", boosts: "potenza" },
  { id: "cecchino", name: "Il Cecchino", emoji: "🎯", tagline: "Angoli chirurgici, zero errori", boosts: "tecnica" },
  { id: "polipo", name: "Il Polipo", emoji: "🐙", tagline: "Arrivi ovunque, copri tutto", boosts: "difesa" },
  { id: "tank", name: "Il Tank", emoji: "🛡️", tagline: "Resisti, logori, vinci", boosts: "costanza" },
  { id: "highlander", name: "L'Highlander", emoji: "⚔️", tagline: "Nei punti caldi non muori mai", boosts: "clutch" },
  { id: "showman", name: "Lo Showman", emoji: "🎩", tagline: "Vinci facendo divertire", boosts: "clutch" },
];

export function getPlayStyle(id: string | null | undefined): PlayStyle | null {
  if (!id) return null;
  return PLAY_STYLES.find((s) => s.id === id) ?? null;
}

export const FOOT_LABELS: Record<string, string> = {
  left: "Mancino",
  right: "Destro",
  both: "Ambidestro",
};

/* ----------------------------------------------------------------------------
   Levels & XP
---------------------------------------------------------------------------- */

export const XP = {
  perMatch: 20,
  perWin: 40,
  perLoss: 10,
  marginBonusCap: 20, // up to +20 for a big win margin
  tournamentWin: 250,
};

/** Cumulative XP required to *reach* a given level (level 1 = 0). */
export function xpThreshold(level: number): number {
  if (level <= 1) return 0;
  return Math.round(80 * Math.pow(level - 1, 1.7));
}

export type LevelInfo = {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNext: number;
  progress: number; // 0..1
  title: string;
};

export function levelFromXp(totalXp: number): LevelInfo {
  let level = 1;
  while (xpThreshold(level + 1) <= totalXp) level++;
  const base = xpThreshold(level);
  const next = xpThreshold(level + 1);
  const xpIntoLevel = totalXp - base;
  const xpForNext = next - base;
  return {
    level,
    totalXp,
    xpIntoLevel,
    xpForNext,
    progress: xpForNext > 0 ? xpIntoLevel / xpForNext : 1,
    title: rankTitle(level),
  };
}

export function rankTitle(level: number): string {
  if (level >= 55) return "Leggenda del Tavolino";
  if (level >= 35) return "Campione di Rimini";
  if (level >= 20) return "Maestro del Tavolino";
  if (level >= 10) return "Veterano";
  if (level >= 5) return "Habitué della Spiaggia";
  return "Novizio del Tavolino";
}

/* ----------------------------------------------------------------------------
   Attributes (0-99) — derived from real stats so they grow as you play & win
---------------------------------------------------------------------------- */

export type AttributeKey =
  | "potenza"
  | "tecnica"
  | "costanza"
  | "difesa"
  | "clutch";

export const ATTRIBUTE_META: Record<
  AttributeKey,
  { label: string; emoji: string }
> = {
  potenza: { label: "Potenza", emoji: "💪" },
  tecnica: { label: "Tecnica", emoji: "🎯" },
  costanza: { label: "Costanza", emoji: "📈" },
  difesa: { label: "Difesa", emoji: "🛡️" },
  clutch: { label: "Clutch", emoji: "🔥" },
};

/** Canonical attribute order — the single source of truth for iteration. */
export const ATTRIBUTE_KEYS: AttributeKey[] = [
  "potenza",
  "tecnica",
  "costanza",
  "difesa",
  "clutch",
];

export type PlayerCoreStats = {
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  bestStreak: number;
  currentStreak: number;
  tournamentsWon: number;
  totalXp: number;
};

export type Attributes = Record<AttributeKey, number>;

const clamp = (n: number, min = 1, max = 99) =>
  Math.max(min, Math.min(max, Math.round(n)));

/**
 * Map real performance onto 5 attributes. Everyone starts around the low 40s
 * and climbs with volume, win-rate, margins and trophies.
 */
export function computeAttributes(
  stats: PlayerCoreStats,
  playStyleId?: string | null,
): Attributes {
  const { played, won, pointsFor, pointsAgainst, bestStreak, currentStreak } =
    stats;
  const winRate = played > 0 ? won / played : 0;
  const avgFor = played > 0 ? pointsFor / played : 0;
  const avgAgainst = played > 0 ? pointsAgainst / played : 0;
  const level = levelFromXp(stats.totalXp).level;
  const experience = Math.min(20, level); // experience bonus tapering

  const attrs: Attributes = {
    potenza: clamp(38 + avgFor * 1.6 + (avgFor - avgAgainst) * 1.2 + experience),
    tecnica: clamp(40 + winRate * 45 + experience),
    costanza: clamp(
      36 + Math.min(played, 40) * 0.7 + bestStreak * 1.5 + experience,
    ),
    difesa: clamp(40 + Math.max(0, 15 - avgAgainst) * 2.2 + experience * 0.8),
    clutch: clamp(
      38 +
        stats.tournamentsWon * 6 +
        Math.max(0, currentStreak) * 2.5 +
        winRate * 20,
    ),
  };

  const style = getPlayStyle(playStyleId);
  if (style) attrs[style.boosts] = clamp(attrs[style.boosts] + 6);

  return attrs;
}

/** FIFA-style overall rating. */
export function overall(attrs: Attributes): number {
  const vals = Object.values(attrs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/* ----------------------------------------------------------------------------
   Personalization — a budget system.

   Each level grants a TOTAL pool of attribute points (`levelStatBudget`): the
   five attributes may not sum to more than that. So players of the same level
   are coherent with one another, and raising one attribute means lowering
   another. Your LEVEL (earned via XP — you win, you climb faster) is the power
   axis; the attribute *shape* is your personal style. A per-attribute ceiling
   (`levelAttributeCap`) additionally stops a low-level player from spiking a
   single stat to 99. All of this is purely cosmetic: it never touches Elo or
   the ranking (Elo is a separate competitive scale, not comparable with XP).
---------------------------------------------------------------------------- */

/** Lowest value any single attribute can hold. */
export const ATTRIBUTE_FLOOR = 10;

/**
 * Per-attribute ceiling at a given level. Starts modest and only reaches 99 in
 * the low-30s levels, so no single stat can be maxed early.
 *   Lv 1 → 51 · Lv 5 → 57 · Lv 10 → 65 · Lv 20 → 80 · Lv 33 → 99
 */
export function levelAttributeCap(level: number): number {
  return Math.max(ATTRIBUTE_FLOOR, Math.min(99, Math.floor(50 + level * 1.5)));
}

/** Targeted average attribute value at a level — drives the total budget. Kept
 *  strictly below the per-attribute cap so the budget always leaves room for
 *  variation (you can't park every stat at the cap). */
function levelAttributeAvg(level: number): number {
  return Math.max(ATTRIBUTE_FLOOR, Math.min(88, Math.floor(42 + level * 1.3)));
}

/**
 * Total attribute points available at a level: the sum of all five attributes
 * may not exceed this. Grows with level and is always fully allocatable given
 * the per-attribute cap.
 *   Lv 1 → 215 · Lv 5 → 240 · Lv 10 → 275 · Lv 20 → 340 · Lv 33 → 420
 */
export function levelStatBudget(level: number): number {
  return levelAttributeAvg(level) * ATTRIBUTE_KEYS.length;
}

const sumAttrs = (a: Attributes) =>
  ATTRIBUTE_KEYS.reduce((s, k) => s + a[k], 0);

/**
 * Force a full attribute set into the valid region: each value clamped to
 * [floor, cap], and the total shaved down (from the largest attributes first)
 * until it fits the budget. Deterministic; always returns a valid set.
 */
export function clampToBudget(
  values: Partial<Record<string, number>>,
  budget: number,
  cap: number,
): Attributes {
  const out = {} as Attributes;
  for (const k of ATTRIBUTE_KEYS) {
    out[k] = clamp(values[k] ?? ATTRIBUTE_FLOOR, ATTRIBUTE_FLOOR, cap);
  }
  let total = sumAttrs(out);
  // Shave one point at a time off the current largest (reducible) attribute.
  // Bounded by total-budget (≤ ~445 iterations), so effectively instant.
  while (total > budget) {
    let key: AttributeKey | null = null;
    let max = ATTRIBUTE_FLOOR;
    for (const k of ATTRIBUTE_KEYS) {
      if (out[k] > max) {
        max = out[k];
        key = k;
      }
    }
    if (!key) break; // every attribute already at the floor
    out[key] -= 1;
    total -= 1;
  }
  return out;
}

/**
 * Spend EVERY available point. Starts from {@link clampToBudget} (each value in
 * [floor, cap], total never above budget) and then, while the total is still
 * below budget, hands out the leftover one point at a time to the lowest
 * attribute that still has head-room. Lifting the weakest stat first keeps the
 * card balanced and the result deterministic; the budget is always fully
 * allocatable (budget ≤ cap × 5 by construction), so the total lands on exactly
 * the budget. This is what makes a card use all its points instead of leaving
 * some free.
 */
export function fillToBudget(
  values: Partial<Record<string, number>>,
  budget: number,
  cap: number,
): Attributes {
  const out = clampToBudget(values, budget, cap);
  let total = sumAttrs(out);
  while (total < budget) {
    let key: AttributeKey | null = null;
    let min = Infinity;
    for (const k of ATTRIBUTE_KEYS) {
      if (out[k] < cap && out[k] < min) {
        min = out[k];
        key = k;
      }
    }
    if (!key) break; // every attribute already at the cap
    out[key] += 1;
    total += 1;
  }
  return out;
}

/**
 * The "auto" card: performance-derived shape, fitted to the level budget. Always
 * spends the whole budget — an under-budget derived shape is topped up (lowest
 * stats first) so no points are ever left free.
 */
export function baselineAttributes(
  derived: Attributes,
  level: number,
): Attributes {
  return fillToBudget(derived, levelStatBudget(level), levelAttributeCap(level));
}

/** Does a stored overrides blob hold any real customization? */
export function hasCustomAttributes(
  custom: Partial<Record<string, number>> | null | undefined,
): boolean {
  return (
    !!custom &&
    ATTRIBUTE_KEYS.some((k) => typeof custom[k] === "number")
  );
}

/**
 * Final attributes to display and to persist: the derived baseline with the
 * player's overrides overlaid, the whole thing re-validated against floor, cap
 * and budget. The full budget is always spent (no free points), so older cards
 * that left points unassigned are topped up automatically. With no overrides
 * this is just the baseline.
 */
export function resolveAttributes(
  derived: Attributes,
  custom: Partial<Record<string, number>> | null | undefined,
  level: number,
): Attributes {
  const baseline = baselineAttributes(derived, level);
  if (!hasCustomAttributes(custom)) return baseline;
  const merged: Partial<Record<string, number>> = { ...baseline };
  for (const k of ATTRIBUTE_KEYS) {
    const v = custom![k];
    if (typeof v === "number" && Number.isFinite(v)) merged[k] = v;
  }
  return fillToBudget(
    merged,
    levelStatBudget(level),
    levelAttributeCap(level),
  );
}

/** XP earned by a single completed match for one participant. */
export function matchXp(won: boolean, scoreFor: number, scoreAgainst: number) {
  let xp = XP.perMatch + (won ? XP.perWin : XP.perLoss);
  if (won) {
    xp += Math.min(XP.marginBonusCap, Math.max(0, scoreFor - scoreAgainst));
  }
  return xp;
}
