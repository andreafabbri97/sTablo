import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "sea" | "ball" | "win" | "loss" | "muted" | "gold";

const tones: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  sea: "bg-sea-soft text-sea",
  ball: "bg-[color-mix(in_srgb,var(--ball)_22%,transparent)] text-ball-ink dark:text-ball",
  win: "bg-[color-mix(in_srgb,var(--win)_16%,transparent)] text-win",
  loss: "bg-[color-mix(in_srgb,var(--loss)_16%,transparent)] text-loss",
  muted: "bg-surface-2 text-muted",
  gold: "bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[var(--gold)]",
};

export function Badge({
  className,
  tone = "muted",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
