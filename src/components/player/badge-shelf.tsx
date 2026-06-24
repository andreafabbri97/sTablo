import { cn } from "@/lib/utils";
import type { BadgeTone, EarnedBadge } from "@/lib/badges";

const toneBg: Record<BadgeTone, string> = {
  brand: "bg-brand-soft",
  sea: "bg-sea-soft",
  ball: "bg-[color-mix(in_srgb,var(--ball)_22%,transparent)]",
  win: "bg-[color-mix(in_srgb,var(--win)_16%,transparent)]",
  gold: "bg-[color-mix(in_srgb,var(--gold)_22%,transparent)]",
};

export function BadgeShelf({
  badges,
  ownerName,
}: {
  badges: EarnedBadge[];
  /** Used in the empty hint ("…ancora nessun trofeo"). */
  ownerName: string;
}) {
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-extrabold">Trofei</h2>
        <span className="text-sm font-semibold text-muted">
          {earned}/{badges.length}
        </span>
      </div>

      {earned === 0 && (
        <p className="mb-3 text-sm text-muted">
          {ownerName} non ha ancora sbloccato trofei: gioca e vinci per
          collezionarli!
        </p>
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {badges.map((b) => (
          <div
            key={b.id}
            title={b.description}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition",
              b.earned
                ? "border-border bg-surface"
                : "border-dashed border-border bg-surface-2/40",
            )}
          >
            <span
              className={cn(
                "grid h-11 w-11 place-items-center rounded-full text-2xl",
                b.earned
                  ? toneBg[b.tone]
                  : "bg-surface-2 opacity-40 grayscale",
              )}
            >
              {b.emoji}
            </span>
            <p
              className={cn(
                "text-xs font-bold leading-tight",
                !b.earned && "text-muted",
              )}
            >
              {b.title}
            </p>
            <p className="text-[10px] leading-tight text-muted">
              {b.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
