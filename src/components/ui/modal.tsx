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
 * Accessible, theme-aware modal. On mobile it behaves as a bottom sheet
 * (rounded top, anchored to the bottom); on >=sm it's a centered dialog.
 * Closes on Escape, on backdrop tap, and locks body scroll while open.
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

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm animate-fade-in"
      />
      <div
        className={cn(
          "relative z-10 max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)] animate-fade-up sm:max-w-lg sm:rounded-3xl",
          className,
        )}
      >
        {/* mobile grab handle */}
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-border sm:hidden" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon}
            {title && (
              <h2 className="font-display text-xl font-extrabold tracking-tight">
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
