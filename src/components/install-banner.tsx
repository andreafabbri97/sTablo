"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Logo } from "@/components/logo";
import { isInstalled, canIOSInstall } from "@/lib/pwa";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The early-capture script in layout.tsx stashes the deferred prompt here, so
// we never miss the event when Chrome fires it before React mounts.
type WindowWithBIP = Window & { __stabloBIP?: BIPEvent | null };

const DISMISS_KEY = "stablo-install-dismissed";
// Re-offer the install after a week instead of hiding it forever. Legacy "1"
// values (old permanent dismissals) parse to epoch 1ms → already expired → the
// banner shows again, which is what we want.
const DISMISS_TTL = 7 * 24 * 60 * 60 * 1000;

function getStashedPrompt(): BIPEvent | null {
  if (typeof window === "undefined") return null;
  return (window as WindowWithBIP).__stabloBIP ?? null;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  // Whether to show the iOS "Add to Home Screen" instructions. True only on
  // real Safari, which is the only iOS browser that can install a PWA.
  const [iosInstall] = useState(canIOSInstall);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Never offer to install an app that's already installed, or one the user
    // dismissed in the last week.
    if (isInstalled()) return;
    if (isDismissed()) return;

    // Initial visibility comes from client-only signals we can only read after
    // mount: a prompt Chrome stashed before React hydrated (otherwise we'd miss
    // the event), or iOS Safari, which never fires beforeinstallprompt and needs
    // the manual "Aggiungi a schermata Home" instructions instead. A lazy
    // useState initializer can't do this without an SSR hydration mismatch, so
    // we sync here — the one legitimate case the rule below guards against.
    const stashed = getStashedPrompt();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (stashed) setDeferred(stashed);
    if (stashed || iosInstall) setShow(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    const onBIP = (e: Event) => {
      e.preventDefault();
      (window as WindowWithBIP).__stabloBIP = e as BIPEvent;
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // Fired by the layout capture script when it stashes a late prompt.
    const onStashed = () => {
      const e = getStashedPrompt();
      if (e) {
        setDeferred(e);
        setShow(true);
      }
    };
    window.addEventListener("stablo-bip", onStashed);

    // If the app gets installed (via our button or the browser's own UI),
    // hide the banner — nothing left to install.
    const onInstalled = () => {
      setShow(false);
      markDismissed();
      (window as WindowWithBIP).__stabloBIP = null;
    };
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("stablo-bip", onStashed);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [iosInstall]);

  function dismiss() {
    setShow(false);
    markDismissed();
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    (window as WindowWithBIP).__stabloBIP = null;
    dismiss();
  }

  if (!show) return null;

  // The wrapper spans the full width down to the screen bottom, so its
  // transparent padding would sit over the mobile bottom-nav and swallow taps on
  // it. pointer-events-none lets those taps through; the card re-enables them.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-4">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-lg)] animate-fade-up">
        <Logo />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Installa sTablo</p>
          {iosInstall && !deferred ? (
            <p className="text-xs text-muted">
              Tocca <Share className="inline h-3.5 w-3.5" /> e poi{" "}
              <span className="font-semibold">“Aggiungi a schermata Home”</span>
            </p>
          ) : (
            <p className="text-xs text-muted">Aggiungila alla Home come un&apos;app vera.</p>
          )}
        </div>
        {deferred ? (
          <button
            onClick={install}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-bold text-white shadow-[var(--shadow-brand)]"
          >
            <Download className="h-4 w-4" /> Installa
          </button>
        ) : null}
        <button
          onClick={dismiss}
          aria-label="Chiudi"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
