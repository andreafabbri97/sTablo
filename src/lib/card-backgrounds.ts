/**
 * Player-selectable backgrounds for the collectible FIFA card.
 *
 * Purely cosmetic: a player picks one in the profile editor and it's persisted
 * as the `card_background` slug on their player row. The card text, the soft
 * glow and the divider lines are all white/translucent, so every preset MUST be
 * dark and saturated enough to keep white text readable (≈3:1 against white on
 * the lightest — top-left — stop). Keep that contract when adding new ones.
 *
 * The slug `viola` reproduces the original hard-coded gradient exactly, so it is
 * the default for every existing player (DB column default) and the card looks
 * identical to before the feature shipped.
 */
export type CardBackground = {
  /** Stable id persisted on the player row — never reuse or rename. */
  id: string;
  /** Human label shown in the picker. */
  name: string;
  /** Value applied to the card's CSS `background` property. */
  css: string;
};

export const CARD_BACKGROUNDS: CardBackground[] = [
  {
    id: "viola",
    name: "Viola",
    css: "linear-gradient(160deg, var(--brand) 0%, var(--brand-strong) 45%, #1b1033 100%)",
  },
  {
    id: "oceano",
    name: "Oceano",
    css: "linear-gradient(160deg, #0e7490 0%, #155e75 50%, #042027 100%)",
  },
  {
    id: "notte",
    name: "Notte",
    css: "linear-gradient(160deg, #1e40af 0%, #1e1b4b 55%, #0a0f24 100%)",
  },
  {
    id: "smeraldo",
    name: "Smeraldo",
    css: "linear-gradient(160deg, #047857 0%, #064e3b 50%, #042018 100%)",
  },
  {
    id: "oro",
    name: "Oro",
    css: "linear-gradient(160deg, #a16207 0%, #713f12 50%, #1c1206 100%)",
  },
  {
    id: "tramonto",
    name: "Tramonto",
    css: "linear-gradient(160deg, #c2410c 0%, #9d174d 55%, #3b0a2e 100%)",
  },
  {
    id: "rubino",
    name: "Rubino",
    css: "linear-gradient(160deg, #be123c 0%, #881337 50%, #2a0610 100%)",
  },
  {
    id: "ardesia",
    name: "Ardesia",
    css: "linear-gradient(160deg, #475569 0%, #1e293b 55%, #0b0f1a 100%)",
  },
];

/** Default slug — must match the `card_background` DB column default. */
export const DEFAULT_CARD_BACKGROUND = "viola";

/** All ids, as a non-empty tuple for `z.enum` in validation. */
export const CARD_BACKGROUND_IDS = CARD_BACKGROUNDS.map((b) => b.id) as [
  string,
  ...string[],
];

/**
 * Resolve a stored slug to its preset, always falling back to the default so an
 * unknown/legacy value can never break rendering.
 */
export function resolveCardBackground(
  id: string | null | undefined,
): CardBackground {
  return (
    CARD_BACKGROUNDS.find((b) => b.id === id) ?? CARD_BACKGROUNDS[0]
  );
}
