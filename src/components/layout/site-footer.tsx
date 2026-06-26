"use client";

import { usePathname } from "next/navigation";

// Computed once at module load (build time), not on every render: a `new Date()`
// during a Client Component's render is non-deterministic and, under Cache
// Components, blocks the static shell. The copyright year doesn't need to be
// request-fresh — the build year is fine.
const YEAR = new Date().getFullYear();

/**
 * Global footer. Shown at the bottom of every page (inside <main>, so its
 * bottom padding clears the fixed mobile BottomNav). Makes the authorship
 * explicit: sTablo is created and owned by Andrea Fabbri.
 *
 * Hidden across the whole `/chat` area: the conversation/picker panes fill the
 * screen (a footer below would add a stray scroll under the keyboard), and the
 * desktop two-column shell is sized to the viewport, so a footer would push the
 * page into a needless scroll.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/chat" || pathname.startsWith("/chat/")) return null;

  return (
    <footer className="mt-14 border-t border-border pt-6 text-center">
      <p className="text-xs text-muted">
        Creato da{" "}
        <span className="font-display font-semibold text-foreground">
          Andrea Fabbri
        </span>
      </p>
      <p className="mt-0.5 text-[11px] text-muted">
        © {YEAR} sTablo · Tutti i diritti riservati
      </p>
    </footer>
  );
}
