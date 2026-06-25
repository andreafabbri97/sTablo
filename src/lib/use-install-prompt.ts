"use client";

import { useCallback, useEffect, useState } from "react";
import { isInstalled, canIOSInstall } from "@/lib/pwa";

/** The deferred `beforeinstallprompt` event Chrome/Edge hand us. */
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
type WindowWithBIP = Window & { __stabloBIP?: BIPEvent | null };

function getStashedPrompt(): BIPEvent | null {
  if (typeof window === "undefined") return null;
  return (window as WindowWithBIP).__stabloBIP ?? null;
}

export type InstallState = {
  /** Running as an installed PWA (standalone). Read only after mount. */
  installed: boolean;
  /** A native install prompt is available (Android/desktop Chromium). */
  canPrompt: boolean;
  /** Real iOS Safari, which installs via the Share → "Aggiungi a Home" steps. */
  iosInstall: boolean;
  /** Fire the native install prompt; resolves with the user's choice. */
  promptInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
};

/**
 * Shared install detection for the settings install card (and any future
 * install affordance): is the app already installed, is a native prompt
 * available, and is this iOS Safari? Pairs with the early-capture script in
 * layout.tsx that stashes the deferred prompt on `window.__stabloBIP` before
 * React mounts, so we never miss Chrome's one-shot event.
 *
 * The standalone <InstallBanner> keeps its own copy of this wiring on purpose:
 * it's live PWA glue we don't want to perturb. New callers should use this hook.
 */
export function useInstallPrompt(): InstallState {
  const [installed, setInstalled] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [iosInstall, setIosInstall] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Client-only signals: read them after mount to avoid an SSR hydration
    // mismatch (the server can't know the display mode or a stashed prompt).
    /* eslint-disable react-hooks/set-state-in-effect */
    setInstalled(isInstalled());
    setIosInstall(canIOSInstall());
    setDeferred(getStashedPrompt());
    /* eslint-enable react-hooks/set-state-in-effect */

    const onBIP = (e: Event) => {
      e.preventDefault();
      (window as WindowWithBIP).__stabloBIP = e as BIPEvent;
      setDeferred(e as BIPEvent);
    };
    const onStashed = () => setDeferred(getStashedPrompt());
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      (window as WindowWithBIP).__stabloBIP = null;
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("stablo-bip", onStashed);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("stablo-bip", onStashed);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const e = deferred ?? getStashedPrompt();
    if (!e) return "unavailable" as const;
    await e.prompt();
    const choice = await e.userChoice;
    setDeferred(null);
    (window as WindowWithBIP).__stabloBIP = null;
    return choice.outcome;
  }, [deferred]);

  return { installed, canPrompt: deferred != null, iosInstall, promptInstall };
}
