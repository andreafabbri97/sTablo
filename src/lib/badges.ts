/**
 * Achievement badges derived entirely from a player's existing stats — no extra
 * tables, computed on read. Each badge has a predicate over a small set of
 * signals; the UI shows earned ones highlighted and the rest as locked goals.
 */

export type BadgeTone = "brand" | "sea" | "ball" | "win" | "gold";

export type BadgeSignals = {
  played: number;
  won: number;
  /** 0..1 */
  winRate: number;
  bestStreak: number;
  /** May be negative during a losing run. */
  currentStreak: number;
  peakElo: number;
  tournamentsWon: number;
  level: number;
};

export type BadgeDef = {
  id: string;
  emoji: string;
  title: string;
  /** What it takes to earn it (shown on the badge). */
  description: string;
  tone: BadgeTone;
  earned: (s: BadgeSignals) => boolean;
};

export type EarnedBadge = Omit<BadgeDef, "earned"> & { earned: boolean };

/** Ordered roughly easy → prestigious; the shelf surfaces earned ones first. */
export const BADGES: readonly BadgeDef[] = [
  {
    id: "debut",
    emoji: "🎬",
    title: "Esordio",
    description: "Gioca la tua prima partita",
    tone: "brand",
    earned: (s) => s.played >= 1,
  },
  {
    id: "regular",
    emoji: "🔁",
    title: "Habitué",
    description: "10 partite giocate",
    tone: "brand",
    earned: (s) => s.played >= 10,
  },
  {
    id: "veteran",
    emoji: "🎖️",
    title: "Veterano",
    description: "50 partite giocate",
    tone: "sea",
    earned: (s) => s.played >= 50,
  },
  {
    id: "centurion",
    emoji: "💯",
    title: "Centurione",
    description: "100 partite giocate",
    tone: "gold",
    earned: (s) => s.played >= 100,
  },
  {
    id: "hot",
    emoji: "🔥",
    title: "Sul pezzo",
    description: "3 vittorie di fila adesso",
    tone: "win",
    earned: (s) => s.currentStreak >= 3,
  },
  {
    id: "unstoppable",
    emoji: "⚡",
    title: "Inarrestabile",
    description: "Serie record di 5 vittorie",
    tone: "win",
    earned: (s) => s.bestStreak >= 5,
  },
  {
    id: "rampage",
    emoji: "🌋",
    title: "Furia",
    description: "Serie record di 10 vittorie",
    tone: "gold",
    earned: (s) => s.bestStreak >= 10,
  },
  {
    id: "sharp",
    emoji: "🎯",
    title: "Cecchino",
    description: "60% di vittorie (min. 10 partite)",
    tone: "sea",
    earned: (s) => s.played >= 10 && s.winRate >= 0.6,
  },
  {
    id: "master",
    emoji: "🧠",
    title: "Maestro",
    description: "Raggiungi il livello 5",
    tone: "sea",
    earned: (s) => s.level >= 5,
  },
  {
    id: "champion",
    emoji: "🏆",
    title: "Campione",
    description: "Vinci un torneo",
    tone: "gold",
    earned: (s) => s.tournamentsWon >= 1,
  },
  {
    id: "dynasty",
    emoji: "👑",
    title: "Dinastia",
    description: "Vinci 3 tornei",
    tone: "gold",
    earned: (s) => s.tournamentsWon >= 3,
  },
  {
    id: "elite",
    emoji: "⭐",
    title: "Elite",
    description: "Raggiungi 1500 di picco Elo",
    tone: "ball",
    earned: (s) => s.peakElo >= 1500,
  },
  {
    id: "legend",
    emoji: "🚀",
    title: "Stratosfera",
    description: "Raggiungi 1700 di picco Elo",
    tone: "ball",
    earned: (s) => s.peakElo >= 1700,
  },
];

/** All badges with their earned flag, earned ones first (definition order within each group). */
export function computeBadges(signals: BadgeSignals): EarnedBadge[] {
  const evaluated = BADGES.map(({ earned, ...rest }) => ({
    ...rest,
    earned: earned(signals),
  }));
  // Stable partition: earned first, locked after, each keeping definition order.
  return [
    ...evaluated.filter((b) => b.earned),
    ...evaluated.filter((b) => !b.earned),
  ];
}

export function countEarned(signals: BadgeSignals): number {
  return BADGES.reduce((n, b) => n + (b.earned(signals) ? 1 : 0), 0);
}
