/**
 * Best-effort client-side error reporter. Fires a compact POST to `/api/log`
 * so uncaught client errors surface in the server logs. It NEVER throws and
 * NEVER blocks the UI: failures to report are swallowed on purpose — a logging
 * call must not become a second error.
 */

export type ClientErrorReport = {
  message: string;
  stack?: string;
  digest?: string;
  /** Where it came from, e.g. "error-boundary" or "window.onerror". */
  source?: string;
};

/** Pull a human message out of whatever was thrown. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Errore sconosciuto";
  }
}

export function reportClientError(
  error: unknown,
  source: string,
  extra?: { digest?: string },
): void {
  if (typeof window === "undefined") return;

  const report: ClientErrorReport = {
    message: messageOf(error).slice(0, 1000),
    stack: error instanceof Error ? error.stack?.slice(0, 4000) : undefined,
    digest: extra?.digest,
    source,
  };

  try {
    const body = JSON.stringify({ ...report, url: window.location.href });
    // keepalive lets the request outlive a navigation/unload.
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Reporting must never throw — give up silently.
  }
}
