"use server";

import { getMatchesPage, type ShapedMatch } from "@/lib/queries";

const MAX_PAGE = 200;

/**
 * Public, paginated feed of completed matches for the /partite "carica altre".
 * Inputs are clamped so a crafted request can't ask for an unbounded page.
 */
export async function loadMoreMatches(
  offset: number,
  limit: number,
): Promise<ShapedMatch[]> {
  const safeOffset = Math.max(0, Math.floor(Number(offset)) || 0);
  const safeLimit = Math.min(
    MAX_PAGE,
    Math.max(1, Math.floor(Number(limit)) || 50),
  );
  return getMatchesPage(safeOffset, safeLimit);
}
