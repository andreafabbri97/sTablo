/**
 * Global footer. Shown at the bottom of every page (inside <main>, so its
 * bottom padding clears the fixed mobile BottomNav). Makes the authorship
 * explicit: sTablo is created and owned by Andrea Fabbri.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 border-t border-border pt-6 text-center">
      <p className="text-sm text-muted">
        Creato da{" "}
        <span className="font-display font-semibold text-foreground">
          Andrea Fabbri
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">
        © {year} sTablo · Tutti i diritti riservati
      </p>
    </footer>
  );
}
