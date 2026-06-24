import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  tournaments,
  tournamentInvites,
  tournamentEntrants,
} from "@/lib/db/schema";

export type PendingTournamentInvite = {
  id: string;
  name: string;
  slug: string;
  token: string | null;
};

type Viewer = { id: string; playerId: string | null } | null;

/**
 * The set of PRIVATE tournament ids a user is allowed to see: the ones they
 * created, were invited to, or are already an entrant of. Public tournaments
 * are visible to everyone and are NOT included here.
 */
export async function getAccessiblePrivateTournamentIds(
  user: Viewer,
): Promise<Set<string>> {
  const ids = new Set<string>();
  if (!user) return ids;

  const created = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(
      and(
        eq(tournaments.createdById, user.id),
        eq(tournaments.visibility, "private"),
      ),
    );
  for (const r of created) ids.add(r.id);

  const invited = await db
    .select({ id: tournamentInvites.tournamentId })
    .from(tournamentInvites)
    .where(eq(tournamentInvites.invitedUserId, user.id));
  for (const r of invited) ids.add(r.id);

  if (user.playerId) {
    const entered = await db
      .select({ id: tournamentEntrants.tournamentId })
      .from(tournamentEntrants)
      .where(eq(tournamentEntrants.playerId, user.playerId));
    for (const r of entered) ids.add(r.id);
  }

  return ids;
}

/** Whether a viewer may open a tournament's detail page. */
export async function canViewTournament(
  user: Viewer,
  t: { id: string; visibility: "public" | "private" },
): Promise<boolean> {
  if (t.visibility === "public") return true;
  const ids = await getAccessiblePrivateTournamentIds(user);
  return ids.has(t.id);
}

/** Pending invites to still-joinable (draft) tournaments, for the bell. */
export async function getPendingTournamentInvites(
  userId: string,
): Promise<PendingTournamentInvite[]> {
  const rows = await db
    .select({
      id: tournamentInvites.id,
      name: tournaments.name,
      slug: tournaments.slug,
      token: tournaments.inviteToken,
      status: tournaments.status,
    })
    .from(tournamentInvites)
    .innerJoin(tournaments, eq(tournamentInvites.tournamentId, tournaments.id))
    .where(
      and(
        eq(tournamentInvites.invitedUserId, userId),
        eq(tournamentInvites.status, "pending"),
      ),
    );
  return rows
    .filter((r) => r.status === "draft")
    .map((r) => ({ id: r.id, name: r.name, slug: r.slug, token: r.token }));
}

/** User ids already invited to a tournament (to pre-mark them in the picker). */
export async function getInvitedUserIds(
  tournamentId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: tournamentInvites.invitedUserId })
    .from(tournamentInvites)
    .where(eq(tournamentInvites.tournamentId, tournamentId));
  return rows.map((r) => r.id);
}
