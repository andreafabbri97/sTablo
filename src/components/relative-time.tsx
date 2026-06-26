"use client";

import { useEffect, useState } from "react";
import { timeAgo, timeUntil, formatDateTime } from "@/lib/utils";

/**
 * Relative timestamp ("13 ore fa" / "fra 2 giorni") computed on the CLIENT.
 *
 * Why a client component: `timeAgo`/`timeUntil` read `Date.now()`, which is
 * non-deterministic and therefore forbidden inside a `use cache` scope. Keeping
 * the relative text client-side lets the server components that render it (match
 * cards, feeds) be cached into the instant static shell. The server (and first
 * client render) emit a deterministic absolute date; the relative text swaps in
 * on mount and ticks every minute.
 */
export function RelativeTime({
  date,
  mode = "auto",
  className,
}: {
  date: Date | string;
  /** "ago" past, "until" countdown, or "auto" (pick by whether it's future). */
  mode?: "ago" | "until" | "auto";
  className?: string;
}) {
  const iso = typeof date === "string" ? date : date.toISOString();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    const compute = () => {
      const useUntil =
        mode === "until" || (mode === "auto" && d.getTime() > Date.now());
      setText(useUntil ? timeUntil(d) : timeAgo(d));
    };
    compute();
    const id = window.setInterval(compute, 60_000);
    return () => window.clearInterval(id);
  }, [iso, mode]);

  return (
    <span className={className} suppressHydrationWarning>
      {text ?? formatDateTime(iso)}
    </span>
  );
}
