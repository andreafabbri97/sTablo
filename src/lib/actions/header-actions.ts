"use server";

import { fetchNotifications, type Notifications } from "./notification-actions";
import { fetchUnreadMessageCount } from "./chat-actions";

/**
 * The header's combined state — notifications + unread chat count — fetched in a
 * single round-trip. The bell and the messages button used to fire one server
 * action each on every navigation; <HeaderDataProvider> now drives both from
 * this one call. Two wins:
 *  - one client → server invocation per navigation/poll instead of two;
 *  - both reads run inside the SAME server request, so the auth check
 *    (getCurrentUser → the blocked-account lookup added with "blocca profilo")
 *    is deduplicated by React cache() instead of running once per badge.
 * The two reads still run in parallel, so the action is no slower than the
 * slower of the two was on its own.
 */
export type HeaderState = {
  notifications: Notifications;
  unreadMessages: number;
};

export async function fetchHeaderState(): Promise<HeaderState> {
  const [notifications, unreadMessages] = await Promise.all([
    fetchNotifications(),
    fetchUnreadMessageCount(),
  ]);
  return { notifications, unreadMessages };
}
