"use server";

import { assertAuth } from "@/lib/auth-helpers";
import { bustDataCache } from "@/lib/cache";
import { getIncomingRequests, type FriendProfile } from "@/lib/friends";
import { getPendingMatches } from "@/lib/queries";
import { canConfirmMatch } from "@/lib/match-perms";
import { autoConfirmExpired } from "@/lib/match-engine";
import {
  getPendingTournamentInvites,
  type PendingTournamentInvite,
} from "@/lib/tournament/invites";

export type Notifications = {
  friendRequests: FriendProfile[];
  pendingMatches: { id: string; label: string }[];
  tournamentInvites: PendingTournamentInvite[];
};

const EMPTY: Notifications = {
  friendRequests: [],
  pendingMatches: [],
  tournamentInvites: [],
};

export async function fetchNotifications(): Promise<Notifications> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return EMPTY;
  }

  try {
    // Opportunistic auto-confirm of expired results while users are active.
    const flipped = await autoConfirmExpired().catch(() => 0);
    if (flipped > 0) bustDataCache();

    const [friendRequests, pending, tournamentInvites] = await Promise.all([
      getIncomingRequests(user.id),
      getPendingMatches(),
      getPendingTournamentInvites(user.id),
    ]);

    const viewer = { playerId: user.playerId, role: user.role };
    const pendingMatches = pending
      .filter((m) => canConfirmMatch(m, viewer))
      .map((m) => ({ id: m.id, label: `${m.sideA.label} vs ${m.sideB.label}` }));

    return { friendRequests, pendingMatches, tournamentInvites };
  } catch (error) {
    console.error("[fetchNotifications]", error);
    return EMPTY;
  }
}
