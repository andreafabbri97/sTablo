"use server";

import { eq } from "drizzle-orm";
import { assertAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { sendPushToUser } from "@/lib/push";

type Result = { ok: true } | { ok: false; error: string };

export type PushSubInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** Store (or refresh) a Web Push subscription for the current account. */
export async function savePushSubscription(
  sub: PushSubInput,
  userAgent?: string,
): Promise<Result> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "Subscription non valida" };
  }
  try {
    await db
      .insert(pushSubscriptions)
      .values({
        userId: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: user.id,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          userAgent: userAgent ?? null,
        },
      });
    return { ok: true };
  } catch (error) {
    console.error("[savePushSubscription]", error);
    return { ok: false, error: "Errore nel salvataggio della subscription" };
  }
}

/** Remove a subscription (e.g. when the user disables notifications). */
export async function removePushSubscription(endpoint: string): Promise<Result> {
  try {
    await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  try {
    await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint));
    return { ok: true };
  } catch (error) {
    console.error("[removePushSubscription]", error);
    return { ok: false, error: "Errore nella rimozione" };
  }
}

/** Send a test notification to the caller's own devices. */
export async function sendTestPush(): Promise<Result> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  await sendPushToUser(user.id, {
    title: "sTablo ⚽",
    body: "Le notifiche push sono attive! 🎉",
    url: "/",
    tag: "stablo-test",
  });
  return { ok: true };
}
