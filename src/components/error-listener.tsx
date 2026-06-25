"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-logger";

/**
 * Catches errors that React error boundaries can't see — uncaught exceptions in
 * event handlers / timers and unhandled promise rejections — and forwards them
 * to the server log. Renders nothing; just wires up window listeners once.
 */
export function ErrorListener() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError(event.error ?? event.message, "window.onerror");
    }
    function onRejection(event: PromiseRejectionEvent) {
      reportClientError(event.reason, "unhandledrejection");
    }

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
