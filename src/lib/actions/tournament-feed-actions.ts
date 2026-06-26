"use server";

import { getTournaments } from "@/lib/tournament/queries";
import { getAccessiblePrivateTournamentIds } from "@/lib/tournament/invites";
import { getFriendTournamentIds } from "@/lib/friends";
import { getCurrentUser } from "@/lib/auth-helpers";
import { toTournamentCard } from "@/lib/tournament/cards";
import type { TournamentCardData } from "@/components/tournaments-explorer";
import { safe } from "@/lib/safe";

/**
 * Per-viewer tournament overlay, fetched client-side so the /tornei page can be
 * a cached static shell of PUBLIC tournaments only. Returns:
 *  - `privateCards`: the private tournaments THIS viewer may see (creator /
 *    admin / invited / joined) — never put in the shared cache for privacy.
 *  - `friendIds`: tournament ids where one of the viewer's friends took part,
 *    to flag «Amici» on any card (public or private).
 * Empty for signed-out visitors or on error.
 */
export async function viewerTournaments(): Promise<{
  privateCards: TournamentCardData[];
  friendIds: string[];
}> {
  const user = await getCurrentUser();
  const [all, accessiblePrivate, friendIds] = await Promise.all([
    safe(() => getTournaments(), []),
    safe(() => getAccessiblePrivateTournamentIds(user), new Set<string>()),
    user
      ? safe(() => getFriendTournamentIds(user.id), new Set<string>())
      : Promise.resolve(new Set<string>()),
  ]);
  const isAdmin = user?.role === "admin";

  const privateCards = all
    .filter(
      (t) =>
        t.visibility === "private" && (isAdmin || accessiblePrivate.has(t.id)),
    )
    .map((t) => toTournamentCard(t, friendIds.has(t.id)));

  return { privateCards, friendIds: [...friendIds] };
}
