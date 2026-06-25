"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** True only after hydration on the client — avoids portalling during SSR. */
function useMounted() {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Accessible, theme-aware modal. Always a centered dialog with fully rounded
 * corners (on mobile too). Closes on Escape, on backdrop tap, and locks body
 * scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const mounted = useMounted();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus into the dialog so keyboard/screen-reader users land inside it.
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm animate-fade-in"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)] outline-none animate-fade-up sm:max-w-lg",
          className,
        )}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            {title && (
              <h2
                id={titleId}
                className="font-display text-xl font-extrabold tracking-tight"
              >
                {title}
              </h2>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
