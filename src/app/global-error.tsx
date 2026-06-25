"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-logger";

/**
 * Root error boundary. Catches errors thrown by the root layout itself, where
 * the normal layout (and its global stylesheet) isn't available — so this must
 * render its own <html>/<body> and lean on inline styles only. Kept deliberately
 * minimal and dependency-free so it can render even when much has gone wrong.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "global-error", { digest: error.digest });
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070a0f",
          color: "#f5f7fa",
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <div style={{ fontSize: 44, lineHeight: 1 }}>⚠️</div>
          <h1
            style={{
              margin: "16px 0 8px",
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            Errore imprevisto
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#9aa4b2" }}>
            L&apos;app ha avuto un problema serio. Ricarica la pagina per
            riprovare.
          </p>
          {error.digest && (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: 12,
                color: "#6b7280",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            style={{
              marginTop: 20,
              height: 44,
              padding: "0 24px",
              border: "none",
              borderRadius: 12,
              background: "#ff6a2c",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Ricarica
          </button>
        </div>
      </body>
    </html>
  );
}
