"use client";

import { useEffect } from "react";

/** Under Neon's ~5-min autosuspend; ping a bit more often to stay ahead of it. */
const PING_MS = 240_000; // 4 minutes

/**
 * Pings /api/ping while the app is open so the (free-tier, scale-to-zero) Neon
 * database stays awake — a sleeping DB wakes in 1–3s, which is what makes
 * navigation feel stuck. Fires on mount, on a 4-min timer, and whenever the tab
 * regains focus; skips while hidden so background tabs don't ping needlessly.
 * Renders nothing.
 */
export function KeepWarm() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/ping", { cache: "no-store" }).catch(() => {});
    };
    ping();
    const id = window.setInterval(ping, PING_MS);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
