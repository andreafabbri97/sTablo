import { cn } from "@/lib/utils";

/**
 * Mikasa FT-5 footvolley ball — the real beach ball used on the Rimini courts:
 * yellow leather with blue soccer panels and a glossy sheen. Reuses the same
 * panel geometry as the in-app <Logo> mark (drawn in a unit r=100 space), but
 * rendered large, colour-accurate and glossy so it can star as the bouncing
 * hero ball. Self-contained SVG → size it freely via `className`.
 */
export function FootvolleyBall({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-110 -110 220 220"
      className={cn("h-16 w-16", className)}
      role="img"
      aria-label="Pallone Mikasa FT-5 da footvolley"
    >
      <defs>
        <radialGradient id="fvb-base" cx="-32" cy="-40" r="155" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe98a" />
          <stop offset="0.5" stopColor="#f8d62a" />
          <stop offset="1" stopColor="#d6ab07" />
        </radialGradient>
        <linearGradient id="fvb-panel" x1="0" y1="-108" x2="0" y2="112" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4f93f2" />
          <stop offset="1" stopColor="#15539f" />
        </linearGradient>
        <radialGradient id="fvb-shade" cx="-28" cy="-36" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0.58" stopColor="#060e24" stopOpacity="0" />
          <stop offset="1" stopColor="#060e24" stopOpacity="0.34" />
        </radialGradient>
        <radialGradient id="fvb-gloss" cx="-40" cy="-46" r="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="fvb-clip">
          <circle r="100" />
        </clipPath>
      </defs>

      <g clipPath="url(#fvb-clip)">
        {/* yellow leather sphere */}
        <circle r="100" fill="url(#fvb-base)" />

        {/* stitched seams */}
        <g stroke="#16294d" strokeWidth="5" strokeLinecap="round" opacity="0.45">
          <path d="M0,-41.8L0,-108" />
          <path d="M39.75,-12.92L102.71,-33.37" />
          <path d="M24.57,33.82L63.48,87.37" />
          <path d="M-24.57,33.82L-63.48,87.37" />
          <path d="M-39.75,-12.92L-102.71,-33.37" />
        </g>

        {/* blue soccer panels */}
        <g fill="url(#fvb-panel)">
          <path d="M0,-44L41.85,-13.6L25.86,35.6L-25.86,35.6L-41.85,-13.6Z" />
          <path d="M36.44,-50.16L25.54,-83.7L54.08,-104.43L82.61,-83.7L71.71,-50.16Z" />
          <path d="M58.97,19.16L87.5,-1.57L116.03,19.16L105.13,52.7L69.86,52.7Z" />
          <path d="M0,62L28.53,82.73L17.63,116.27L-17.63,116.27L-28.53,82.73Z" />
          <path d="M-58.97,19.16L-69.86,52.7L-105.13,52.7L-116.03,19.16L-87.5,-1.57Z" />
          <path d="M-36.44,-50.16L-71.71,-50.16L-82.61,-83.7L-54.08,-104.43L-25.54,-83.7Z" />
        </g>

        {/* spherical shading + glossy highlight */}
        <circle r="100" fill="url(#fvb-shade)" />
        <circle r="100" fill="url(#fvb-gloss)" />
      </g>

      {/* crisp edge so the ball reads on any background */}
      <circle r="99.5" fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}
