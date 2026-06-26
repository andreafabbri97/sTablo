import { cn } from "@/lib/utils";

/**
 * Shared Suspense fallbacks for the Cache Components migration. Each page's
 * static shell (header, tabs chrome) renders instantly; these stand in for the
 * data-driven part while it streams. Keep their shape close to the real content
 * so the swap doesn't shift the layout (good CLS).
 */

/** A vertical stack of card-shaped rows — lists, rankings, feeds. */
export function RowsSkeleton({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl skeleton" />
      ))}
    </div>
  );
}

/** A segmented tab bar above a list of rows (classifica, partite, tornei). */
export function TabbedListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="h-12 rounded-2xl skeleton" />
      <RowsSkeleton rows={rows} />
    </div>
  );
}

/** A responsive grid of cards — the giocatori roster. */
export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl skeleton" />
      ))}
    </div>
  );
}

/** A single large block — forms, detail panels. */
export function PanelSkeleton({ className }: { className?: string }) {
  return <div className={cn("h-64 rounded-2xl skeleton", className)} aria-hidden />;
}

/** Icon + title + subtitle placeholder, matching <PageHeader>. Used when a
 *  page's whole header (its action/subtitle) depends on request data. */
export function PageHeaderSkeleton() {
  return (
    <div className="mb-6 flex items-center gap-3" aria-hidden>
      <div className="h-11 w-11 rounded-2xl skeleton" />
      <div className="space-y-2">
        <div className="h-6 w-40 rounded-lg skeleton" />
        <div className="h-3 w-28 rounded skeleton" />
      </div>
    </div>
  );
}
