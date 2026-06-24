/**
 * Server-side Web Push. Keep this module server-only (it pulls in node crypto
 * via `web-push`) — import it from server actions / server components only.
 *
 * VAPID keys are read lazily: if they aren't set yet, every send becomes a
 * silent no-op so the app (and the build) never crash before the env vars are
 * configured on the host.
 */
import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:notifiche@s-tablo.vercel.app";

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!PUBLIC_KEY || !PRIVATE_KEY) return false;
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  configured = true;
  return true;
}

/** True when VAPID keys are present — used to decide whether to offer the toggle server-side. */
export function pushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  /** path to open on click, e.g. "/partite/123" */
  url?: string;
  /** collapse key so repeat notifications replace each other */
  tag?: string;
};

/** Send a push to every device registered for a user. Best-effort, never throws. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!ensureConfigured()) return;

  let subs;
  try {
    subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  } catch {
    return;
  }
  if (!subs.length) return;

  const data = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          data,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        // 404 / 410 → the subscription is dead; drop it so we stop retrying.
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, sub.endpoint))
            .catch(() => {});
        }
      }
    }),
  );
}

/** Fan out a push to several users (de-duplicated). */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<void> {
  const unique = [...new Set(userIds.filter(Boolean))];
  await Promise.all(unique.map((id) => sendPushToUser(id, payload)));
}
