/**
 * Fixed palette of match reactions. Kept tiny and tavolino-flavoured so the bar
 * stays a single tap-row on mobile. Stored verbatim (the emoji char) in
 * match_reactions.emoji; the allow-list here is the validation boundary.
 */
export const MATCH_REACTIONS = ["🔥", "👏", "😂", "💪", "🎯", "😱"] as const;

export type MatchReactionEmoji = (typeof MATCH_REACTIONS)[number];

export function isValidReaction(value: string): value is MatchReactionEmoji {
  return (MATCH_REACTIONS as readonly string[]).includes(value);
}

/** Max characters for a match comment — keep it a quick reaction, not an essay. */
export const MAX_COMMENT_LENGTH = 280;
