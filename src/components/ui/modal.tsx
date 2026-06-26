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
 * Tracks the visual viewport (the area actually visible above the on-screen
 * keyboard) while the modal is open. Returns the offset/height to pin the
 * overlay to, or null when unsupported (fall back to a normal full-screen
 * overlay). Without this, an `inset-0` overlay centers the panel in the full
 * layout viewport — i.e. partly behind the mobile keyboard.
 */
function useVisualViewport(open: boolean) {
  const [rect, setRect] = React.useState<{ top: number; height: number } | null>(
    null,
  );
  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setRect({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setRect(null);
    };
  }, [open]);
  return rect;
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
  const viewport = useVisualViewport(open);

  // Keep the latest onClose without it driving the effects below — callers often
  // pass an inline function that changes identity on every render.
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // Escape-to-close + body scroll lock, tied only to `open`.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Move focus into the dialog ONLY when it opens — never on later re-renders,
  // otherwise we'd steal focus from inputs inside (closing the mobile keyboard).
  React.useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className={cn(
        "fixed left-0 z-[100] flex w-full items-center justify-center p-4",
        // When we know the visual viewport, pin to it (top/height inline);
        // otherwise cover the whole screen.
        viewport ? "" : "inset-0",
      )}
      style={
        viewport ? { top: viewport.top, height: viewport.height } : undefined
      }
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
          "relative z-10 max-h-full w-full overflow-y-auto rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-lg)] outline-none animate-fade-up sm:max-w-lg",
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
