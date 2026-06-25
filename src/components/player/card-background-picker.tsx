"use client";

import { Check } from "lucide-react";
import { CARD_BACKGROUNDS } from "@/lib/card-backgrounds";
import { cn } from "@/lib/utils";

/**
 * Grid of card-shaped swatches for choosing the FIFA-card background. Each tile
 * previews the actual gradient; the selected one gets a brand ring + check. The
 * choice is lifted to the parent so the big card preview updates live.
 */
export function CardBackgroundPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      role="group"
      aria-labelledby="card-bg-label"
      className="rounded-xl border border-border bg-surface p-4"
    >
      <p id="card-bg-label" className="text-sm font-bold">
        Sfondo della card 🎨
      </p>
      <p className="text-xs text-muted">
        Scegli il colore della tua card: l&apos;anteprima si aggiorna subito.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {CARD_BACKGROUNDS.map((bg) => {
          const selected = bg.id === value;
          return (
            <button
              key={bg.id}
              type="button"
              onClick={() => onChange(bg.id)}
              aria-pressed={selected}
              aria-label={`Sfondo ${bg.name}`}
              title={bg.name}
              className={cn(
                "relative aspect-[3/4] overflow-hidden rounded-lg border text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand",
                selected
                  ? "border-brand ring-2 ring-brand"
                  : "border-white/10 hover:brightness-110",
              )}
              style={{ background: bg.css }}
            >
              {selected && (
                <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-brand shadow">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wide text-white">
                {bg.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
