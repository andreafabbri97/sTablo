"use client";

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Logo } from "@/components/logo";
import { isInstalled, canIOSInstall } from "@/lib/pwa";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "stablo-install-dismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  // Whether to show the iOS "Add to Home Screen" instructions. True only on
  // real Safari, which is the only iOS browser that can install a PWA.
  // Derived once; the banner stays hidden (show=false) during hydration, so
  // there's no SSR/client mismatch.
  const [iosInstall] = useState(canIOSInstall);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Never offer to install an app that's already installed.
    if (isInstalled()) return;

    if (localStorage.getItem(DISMISS_KEY)) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    // If the app gets installed (via our button or the browser's own UI),
    // hide the banner for good — nothing left to install.
    const onInstalled = () => {
      setShow(false);
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show instructions banner.
    // Intentionally client-only after mount: installed/dismissed/iOS can only
    // be detected on the client, so the banner must stay hidden during SSR and
    // hydration to avoid a mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (iosInstall) setShow(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [iosInstall]);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] md:pb-4">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-lg)] animate-fade-up">
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
