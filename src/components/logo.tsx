import { cn } from "@/lib/utils";

/** sTablo mark: a curved teqball-style table with a flying ball. */
export function Logo({
  className,
  withWordmark = false,
}: {
  className?: string;
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 48 48"
        fill="none"
        className="h-8 w-8 shrink-0"
        aria-hidden
      >
        <defs>
          <linearGradient id="stablo-table" x1="6" y1="34" x2="42" y2="34">
            <stop stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--brand-strong)" />
          </linearGradient>
        </defs>
        {/* curved table */}
        <path
          d="M6 34c0-7 8-11 18-11s18 4 18 11"
          stroke="url(#stablo-table)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* center net line */}
        <path
          d="M24 23v15"
          stroke="var(--sea)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* legs */}
        <path
          d="M11 34l-2 6M37 34l2 6"
          stroke="url(#stablo-table)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* ball */}
        <circle cx="33" cy="13" r="5.5" fill="var(--ball)" />
        <path
          d="M30 11.5l3 1.5 3-1.5M33 8.5v3"
          stroke="var(--ball-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {withWordmark && (
        <span className="font-display text-xl font-extrabold tracking-tight">
          s<span className="text-gradient">Tablo</span>
        </span>
      )}
    </span>
  );
}
