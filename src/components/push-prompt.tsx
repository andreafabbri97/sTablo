"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BellRing, X, Loader2 } from "lucide-react";
import { sendTestPush } from "@/lib/actions/push-actions";
import { pushSupported, pushConfigured, subscribeToPush } from "@/lib/push-client";
import { isInstalled } from "@/lib/pwa";

const DISMISS_KEY = "stablo-push-prompt-dismissed";

/**
 * Makes push notifications effectively "on by default" for logged-in users:
 *  - if the OS already granted permission, it silently (re)subscribes this
 *    device so notifications keep working without visiting the profile;
 *  - if permission is still undecided, it shows a one-tap prompt — but only
 *    inside the installed PWA, so it never collides with the install banner
 *    and works on iOS (which only supports push once installed).
 * Browsers require requestPermission() to run from a user gesture, so the
 * actual opt-in happens on the button tap.
 */
export function PushPrompt() {
  const { status } = useSession();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Don't nag (or offer a button that can't work) when push isn't supported
    // or no VAPID key is configured on this deployment.
    if (status !== "authenticated" || !pushSupported() || !pushConfigured())
      return;
    let cancelled = false;

    (async () => {
      // Already granted on this device → re-affirm the subscription silently.
      if (Notification.permission === "granted") {
        await subscribeToPush().catch(() => {});
        return;
      }
      // Denied → respect the choice; only "default" is promptable.
      if (Notification.permission !== "default") return;
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
      } catch {
        /* private mode: just proceed */
      }

      // Installed-app only: avoids clashing with the install banner (which only
      // shows when NOT installed) and matches iOS, where push needs the PWA
      // installed first.
      if (!isInstalled()) return;

      if (!cancelled) setShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function enable() {
    setBusy(true);
    try {
      const res = await subscribeToPush({ promptIfNeeded: true });
      if (res.ok) {
        await sendTestPush().catch(() => {});
        setShow(false);
      } else if (res.reason === "denied") {
        dismiss();
      }
    } finally {
      setBusy(false);
    }
  }

  if (status !== "authenticated" || !show) return null;

  // Full-width wrapper down to the screen bottom: make its transparent padding
  // click-through so it can't block taps on the mobile bottom-nav beneath it.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-lg)] animate-fade-up">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Attiva le notifiche</p>
          <p className="text-xs text-muted">
            Avvisi per conferme, amici e inviti — anche con l&apos;app chiusa.
          </p>
        </div>
        <button
          onClick={enable}
          disabled={busy}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white shadow-[var(--shadow-brand)] disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <BellRing className="h-4 w-4" />
          )}
          Attiva
        </button>
        <button
          onClick={dismiss}
          aria-label="Più tardi"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
