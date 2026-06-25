"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-logger";

/**
 * Segment-level error boundary. Catches render/runtime errors in any route and
 * shows a friendly Italian fallback instead of a blank screen, while reporting
 * the error to the server log for diagnostics. `unstable_retry()` (Next 16.2)
 * re-fetches and re-renders the segment — the right recovery for a failed load.
 */
export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    reportClientError(error, "error-boundary", { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-loss/10 text-loss">
        <AlertTriangle className="h-7 w-7" />
      </span>
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Qualcosa è andato storto
        </h1>
        <p className="mt-1 max-w-sm text-sm text-muted">
          C&apos;è stato un intoppo nel caricare questa pagina. Riprova: se il
          problema continua, ci stiamo già lavorando.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted/70">
            Codice errore: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button onClick={() => unstable_retry()}>
          <RotateCcw className="h-4 w-4" /> Riprova
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">
            <Home className="h-4 w-4" /> Torna alla home
          </Link>
        </Button>
      </div>
    </div>
  );
}
