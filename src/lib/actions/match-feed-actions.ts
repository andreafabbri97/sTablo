"use server";

import { getMatchesPage, type ShapedMatch } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriendFeedSlugs } from "@/lib/friends";
import { safe } from "@/lib/safe";

const MAX_PAGE = 200;

/**
 * Per-viewer overlay for the matches feed, fetched client-side so the feed page
 * itself can be a cached static shell: the viewer's circle (self + friends) as
 * slugs (powers the «Solo amici» toggle) and whether they're an admin (shows
 * the delete buttons; the delete action re-checks admin server-side). Empty/
 * false for signed-out visitors or on any error.
 */
export async function viewerFeedInfo(): Promise<{
  friendSlugs: string[];
  isAdmin: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) return { friendSlugs: [], isAdmin: false };
  const friendSlugs = await safe(() => getFriendFeedSlugs(user.id), []);
  return { friendSlugs, isAdmin: user.role === "admin" };
}

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
