"use client";

import { useEffect } from "react";

/** Registers the offline service worker once, on the client, in production. */
export function ServiceWorker() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      process.env.NODE_ENV !== "production"
    ) {
      return;
    }
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort */
      });
    };
    window.addEventListener("load", onLoad);

    // Self-heal a phone stuck on a stale shell: when a *new* worker takes over a
    // page that was already controlled, a deploy swapped the cached assets under
    // us, so reload once to pick up the fresh shell. Guard on an existing
    // controller so the first-ever install (which also fires controllerchange
    // via clients.claim()) doesn't trigger a spurious reload.
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    const armReload = Boolean(navigator.serviceWorker.controller);
    if (armReload) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
    }

    return () => {
      window.removeEventListener("load", onLoad);
      if (armReload) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          onControllerChange,
        );
      }
    };
  }, []);

  return null;
}
