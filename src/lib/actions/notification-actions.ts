"use server";

import { updateTag } from "next/cache";
import { assertAuth } from "@/lib/auth-helpers";
import { DATA_TAG } from "@/lib/cache";
import { getIncomingRequests, type FriendProfile } from "@/lib/friends";
import { getPendingMatches } from "@/lib/queries";
import { canConfirmMatch } from "@/lib/match-perms";
import { autoConfirmExpired } from "@/lib/match-engine";

export type Notifications = {
  friendRequests: FriendProfile[];
  pendingMatches: { id: string; label: string }[];
};

const EMPTY: Notifications = { friendRequests: [], pendingMatches: [] };

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
    if (flipped > 0) updateTag(DATA_TAG);

    const [friendRequests, pending] = await Promise.all([
      getIncomingRequests(user.id),
      getPendingMatches(),
    ]);

    const viewer = { playerId: user.playerId, role: user.role };
    const pendingMatches = pending
      .filter((m) => canConfirmMatch(m, viewer))
      .map((m) => ({ id: m.id, label: `${m.sideA.label} vs ${m.sideB.label}` }));

    return { friendRequests, pendingMatches };
  } catch (error) {
    console.error("[fetchNotifications]", error);
    return EMPTY;
  }
}
