import { cn } from "@/lib/utils";

/** sTablo mark: a curved teqball-style table with a flying footvolley ball. */
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
          {/* Footvolley ball (Mikasa FT-5 style): yellow sphere + black panels. */}
          <radialGradient id="stablo-ball" cx="0.36" cy="0.3" r="0.82">
            <stop offset="0" stopColor="#fff27a" />
            <stop offset="0.5" stopColor="#ffd21a" />
            <stop offset="1" stopColor="#b88900" />
          </radialGradient>
          <radialGradient id="stablo-ball-gloss" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <clipPath id="stablo-ball-clip">
            <circle r="100" />
          </clipPath>
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
        {/* ball — panels generated in a unit space (r=100), scaled into place */}
        <g
          transform="translate(33,13) scale(0.07)"
          clipPath="url(#stablo-ball-clip)"
        >
          <circle r="100" fill="url(#stablo-ball)" />
          <path d="M0,-41.8L0,-108" stroke="#10131a" strokeWidth="9" strokeLinecap="round" />
          <path d="M39.75,-12.92L102.71,-33.37" stroke="#10131a" strokeWidth="9" strokeLinecap="round" />
          <path d="M24.57,33.82L63.48,87.37" stroke="#10131a" strokeWidth="9" strokeLinecap="round" />
          <path d="M-24.57,33.82L-63.48,87.37" stroke="#10131a" strokeWidth="9" strokeLinecap="round" />
          <path d="M-39.75,-12.92L-102.71,-33.37" stroke="#10131a" strokeWidth="9" strokeLinecap="round" />
          <path d="M0,-44L41.85,-13.6L25.86,35.6L-25.86,35.6L-41.85,-13.6Z" fill="#10131a" />
          <path d="M36.44,-50.16L25.54,-83.7L54.08,-104.43L82.61,-83.7L71.71,-50.16Z" fill="#10131a" />
          <path d="M58.97,19.16L87.5,-1.57L116.03,19.16L105.13,52.7L69.86,52.7Z" fill="#10131a" />
          <path d="M0,62L28.53,82.73L17.63,116.27L-17.63,116.27L-28.53,82.73Z" fill="#10131a" />
          <path d="M-58.97,19.16L-69.86,52.7L-105.13,52.7L-116.03,19.16L-87.5,-1.57Z" fill="#10131a" />
          <path d="M-36.44,-50.16L-71.71,-50.16L-82.61,-83.7L-54.08,-104.43L-25.54,-83.7Z" fill="#10131a" />
          <circle cx="-30" cy="-36" r="42" fill="url(#stablo-ball-gloss)" />
        </g>
      </svg>
      {withWordmark && (
        <span className="font-display text-xl font-extrabold tracking-tight">
          s<span className="text-gradient">Tablo</span>
        </span>
      )}
    </span>
  );
}
