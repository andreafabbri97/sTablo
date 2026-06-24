"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global navigation progress bar.
 *
 * In this Next.js, client navigations to dynamic/auth-gated routes keep the
 * *old* page on screen until the server finishes rendering — which feels
 * frozen. `loading.js` Suspense fallbacks don't reliably cover sibling
 * navigations under a shared layout, so we give immediate feedback that reacts
 * to the click itself (not the server response): a thin bar that starts on any
 * internal link click / back-forward and completes when the route changes.
 */
const SHOW_DELAY = 120; // don't flash the bar on near-instant navigations
const DONE_DELAY = 260; // time to animate to 100% then fade out
const SAFETY_TIMEOUT = 12000; // never get stuck if a navigation is cancelled

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const activeRef = useRef(false);
  const visibleRef = useRef(false);
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPending() {
    if (showTimer.current) clearTimeout(showTimer.current);
    if (trickle.current) clearInterval(trickle.current);
    if (safety.current) clearTimeout(safety.current);
    showTimer.current = trickle.current = safety.current = null;
  }

  function start() {
    if (activeRef.current) return;
    activeRef.current = true;
    clearPending();
    showTimer.current = setTimeout(() => {
      visibleRef.current = true;
      setVisible(true);
      setProgress(10);
      trickle.current = setInterval(() => {
        setProgress((p) => (p >= 92 ? p : p + (94 - p) * 0.06 + 0.4));
      }, 220);
    }, SHOW_DELAY);
    safety.current = setTimeout(finish, SAFETY_TIMEOUT);
  }

  function finish() {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearPending();
    if (!visibleRef.current) {
      setProgress(0);
      return;
    }
    setProgress(100);
    doneTimer.current = setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      setProgress(0);
    }, DONE_DELAY);
  }

  // Navigation completed: the route (path or query) changed.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Navigation started: any internal link click or back/forward.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      clearPending();
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div
        className="h-full bg-gradient-to-r from-brand via-brand-strong to-sea shadow-[0_0_12px_rgba(255,106,44,0.7)] transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${progress}%`, opacity: visible ? 1 : 0 }}
      />
    </div>
  );
}
