"use client";

import * as React from "react";
import { HelpCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { GUIDES } from "./guides";

/**
 * A round "?" button that opens a per-page guide modal.
 * On >=sm it shows a hover/focus tooltip ("Guida"); on mobile it's just tappable.
 * Theme-aware via the shared tokens; the Modal handles light/dark + bottom-sheet.
 */
export function HelpButton({
  topic,
  className,
}: {
  topic: keyof typeof GUIDES | string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const guide = GUIDES[topic];

  if (!guide) return null;

  return (
    <>
      <div className={cn("group relative inline-flex", className)}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Guida: ${guide.title}`}
          className="grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-muted shadow-sm transition hover:border-brand hover:text-brand active:scale-90"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        {/* desktop tooltip */}
        <span
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground opacity-0 shadow-[var(--shadow-lg)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:block"
        >
          Guida
        </span>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={guide.title}
        icon={<span className="text-2xl leading-none">{guide.emoji}</span>}
      >
        {guide.intro && (
          <p className="mb-4 text-sm leading-relaxed text-muted">{guide.intro}</p>
        )}
        <div className="space-y-4">
          {guide.sections.map((section) => (
            <section key={section.heading}>
              <h3 className="mb-2 text-sm font-bold text-foreground">
                {section.heading}
              </h3>
              <ul className="space-y-1.5">
                {section.points.map((point, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-muted"
                  >
                    <span
                      aria-hidden
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
