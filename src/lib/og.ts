/**
 * Shared constants & helpers for dynamically generated Open Graph images
 * (`opengraph-image.tsx` route handlers using `next/og`). Satori only supports
 * flexbox + a subset of CSS, so everything here is plain values/inline styles.
 */

/** Standard OG / Twitter large-image canvas. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

export const OG_CONTENT_TYPE = "image/png";

/** Brand gradient shared with the on-screen FIFA card. */
export const OG_BG =
  "linear-gradient(160deg, #ff6a2c 0%, #f0510f 45%, #1b1033 100%)";

/** Cooler variant used for match cards, to tell the two apart at a glance. */
export const OG_BG_MATCH =
  "linear-gradient(150deg, #ff6a2c 0%, #b8390a 38%, #120a26 100%)";

/**
 * Concrete avatar gradient stops (hex), index-aligned with AVATAR_GRADIENTS in
 * lib/utils so an OG avatar matches the player's in-app color.
 */
const OG_AVATAR_COLORS: ReadonlyArray<readonly [string, string]> = [
  ["#fb923c", "#f43f5e"],
  ["#22d3ee", "#2563eb"],
  ["#a3e635", "#059669"],
  ["#e879f9", "#9333ea"],
  ["#fbbf24", "#ea580c"],
  ["#38bdf8", "#4f46e5"],
  ["#2dd4bf", "#0891b2"],
  ["#f472b6", "#e11d48"],
];

export function ogAvatarColor(index: number): { from: string; to: string } {
  const [from, to] =
    OG_AVATAR_COLORS[((index % OG_AVATAR_COLORS.length) + OG_AVATAR_COLORS.length) %
      OG_AVATAR_COLORS.length];
  return { from, to };
}

/** Short Italian date (e.g. "24 giu 2026") for OG captions. */
export function ogDate(d: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}
