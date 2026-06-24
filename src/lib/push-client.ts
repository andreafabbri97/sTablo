/**
 * Browser-side Web Push helpers, shared by the profile toggle and the app-wide
 * auto-prompt. Keeps the subscribe/permission dance in one place so both entry
 * points behave identically. All functions assume a browser context.
 */
import { savePushSubscription } from "@/lib/actions/push-actions";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** True when this browser can do service-worker push at all. */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Current OS/browser permission, or "unsupported" when push isn't available. */
export function pushPermission(): NotificationPermission | "unsupported" {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

/** Convert a base64url VAPID key to the ArrayBuffer the Push API expects. */
function urlBase64ToBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}

export type SubscribeReason =
  | "unsupported"
  | "no-key"
  | "denied"
  | "needs-prompt"
  | "no-sw"
  | "error";

export type SubscribeResult =
  | { ok: true }
  | { ok: false; reason: SubscribeReason; message?: string };

/**
 * Ensure the current device is subscribed and the subscription is saved
 * server-side.
 *
 * - `promptIfNeeded: false` (default) only proceeds when permission is already
 *   "granted" — used for the silent, app-wide auto-enable so we never nag.
 * - `promptIfNeeded: true` may call `Notification.requestPermission()`, which
 *   browsers (notably iOS/Safari) require to run inside a user gesture — used
 *   by the explicit "Abilita" buttons.
 */
export async function subscribeToPush(
  opts: { promptIfNeeded?: boolean } = {},
): Promise<SubscribeResult> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-key" };

  if (Notification.permission === "denied") {
    return { ok: false, reason: "denied" };
  }
  if (Notification.permission === "default") {
    if (!opts.promptIfNeeded) return { ok: false, reason: "needs-prompt" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        ok: false,
        reason: permission === "denied" ? "denied" : "needs-prompt",
      };
    }
  }

  // The SW only registers in production; bail cleanly elsewhere so the silent
  // path never hangs on serviceWorker.ready.
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return { ok: false, reason: "no-sw" };
  const reg = await navigator.serviceWorker.ready;

  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToBuffer(VAPID_PUBLIC_KEY),
      }));

    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, reason: "error", message: "Subscription non valida" };
    }
    const res = await savePushSubscription(
      {
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      },
      navigator.userAgent,
    );
    if (!res.ok) return { ok: false, reason: "error", message: res.error };
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

/** Remove the local subscription (server row is deleted by the caller). */
export async function getLocalSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
