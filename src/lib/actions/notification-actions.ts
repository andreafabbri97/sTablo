"use server";

import { assertAuth } from "@/lib/auth-helpers";
import { bustDataCache } from "@/lib/cache";
import { getIncomingRequests, type FriendProfile } from "@/lib/friends";
import { getPendingMatches } from "@/lib/queries";
import { canConfirmMatch } from "@/lib/match-perms";
import { autoConfirmExpired } from "@/lib/match-engine";
import {
  countUnread,
  fetchFeed,
  markAllRead,
  pruneOldNotifications,
} from "@/lib/notifications";
import {
  getPendingTournamentInvites,
  type PendingTournamentInvite,
} from "@/lib/tournament/invites";

export type Notifications = {
  friendRequests: FriendProfile[];
  pendingMatches: { id: string; label: string }[];
  tournamentInvites: PendingTournamentInvite[];
  /** unread count of the persistent in-app feed (drives the /notifiche pill) */
  feedUnread: number;
};

const EMPTY: Notifications = {
  friendRequests: [],
  pendingMatches: [],
  tournamentInvites: [],
  feedUnread: 0,
};

/** One feed entry as sent to the client (timestamps flattened to ISO strings). */
export type FeedItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
};

/**
 * fetchNotifications viene chiamata a ogni cambio rotta e ogni 60s dalla
 * campanella. Lanciare uno scan DB di auto-conferma a ogni navigazione è
 * sprecato: lo limitiamo a una volta ogni 30s per istanza serverless (warm).
 * Il cron resta la garanzia di fondo; questo è solo opportunistico.
 */
const AUTO_CONFIRM_THROTTLE_MS = 30_000;
let lastAutoConfirmAt = 0;

export async function fetchNotifications(): Promise<Notifications> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return EMPTY;
  }

  try {
    // Opportunistic auto-confirm of expired results while users are active,
    // throttled so rapid navigations don't each trigger a DB scan.
    const now = Date.now();
    if (now - lastAutoConfirmAt > AUTO_CONFIRM_THROTTLE_MS) {
      lastAutoConfirmAt = now;
      const flipped = await autoConfirmExpired().catch(() => 0);
      if (flipped > 0) bustDataCache();
      // Opportunistic housekeeping of the feed, on the same throttle.
      await pruneOldNotifications();
    }

    const [friendRequests, pending, tournamentInvites, feedUnread] =
      await Promise.all([
        getIncomingRequests(user.id),
        getPendingMatches(),
        getPendingTournamentInvites(user.id),
        countUnread(user.id),
      ]);

    const viewer = { playerId: user.playerId, role: user.role };
    const pendingMatches = pending
      .filter((m) => canConfirmMatch(m, viewer))
      .map((m) => ({ id: m.id, label: `${m.sideA.label} vs ${m.sideB.label}` }));

    return { friendRequests, pendingMatches, tournamentInvites, feedUnread };
  } catch (error) {
    console.error("[fetchNotifications]", error);
    return EMPTY;
  }
}

/** Full persistent feed for the signed-in user (newest first). */
export async function fetchNotificationFeed(): Promise<FeedItem[]> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return [];
  }
  const rows = await fetchFeed(user.id);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    read: r.readAt != null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Mark the whole feed read — called when the user opens /notifiche. */
export async function markNotificationsRead(): Promise<void> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return;
  }
  await markAllRead(user.id);
}
