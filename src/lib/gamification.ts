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

/** XP earned by a single completed match for one participant. */
export function matchXp(won: boolean, scoreFor: number, scoreAgainst: number) {
  let xp = XP.perMatch + (won ? XP.perWin : XP.perLoss);
  if (won) {
    xp += Math.min(XP.marginBonusCap, Math.max(0, scoreFor - scoreAgainst));
  }
  return xp;
}
