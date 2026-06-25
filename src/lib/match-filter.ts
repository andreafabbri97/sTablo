import type { ShapedMatch } from "@/lib/queries";

/**
 * True when at least one participant of the match has a slug in `slugs`.
 * Powers the feed's «Solo amici» toggle, where `slugs` is the viewer's circle
 * (themselves plus their accepted friends). Pure — safe to use client-side
 * (only the `ShapedMatch` type is imported, which the compiler erases).
 */
export function matchInvolvesAnySlug(
  match: ShapedMatch,
  slugs: ReadonlySet<string>,
): boolean {
  if (slugs.size === 0) return false;
  for (const p of match.sideA.players) if (slugs.has(p.slug)) return true;
  for (const p of match.sideB.players) if (slugs.has(p.slug)) return true;
  return false;
}
