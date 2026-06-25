import { cn } from "@/lib/utils";

/**
 * Classic black-and-white soccer ball (Telstar-style), drawn as a self-contained
 * SVG so it looks IDENTICAL on every device. It replaces the ⚽ emoji, whose
 * rendering changed per platform (white/black on Apple, white/blue elsewhere).
 * Geometry is laid out in a unit r=100 space and clipped to the sphere; size it
 * freely via `className`.
 */
export function SoccerBall({ className }: { className?: string }) {
  return (
    <svg
      viewBox="-110 -110 220 220"
      className={cn("h-16 w-16", className)}
      role="img"
      aria-label="Pallone da calcio"
    >
      <defs>
        <radialGradient id="sb-base" cx="-34" cy="-42" r="150" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.62" stopColor="#f1f5f9" />
          <stop offset="1" stopColor="#cbd5e1" />
        </radialGradient>
        <linearGradient id="sb-panel" x1="0" y1="-90" x2="0" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2b2f38" />
          <stop offset="1" stopColor="#12151b" />
        </linearGradient>
        <radialGradient id="sb-shade" cx="-30" cy="-38" r="148" gradientUnits="userSpaceOnUse">
          <stop offset="0.55" stopColor="#0b1220" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1220" stopOpacity="0.28" />
        </radialGradient>
        <radialGradient id="sb-gloss" cx="-42" cy="-48" r="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="sb-clip">
          <circle r="100" />
        </clipPath>
      </defs>

      <g clipPath="url(#sb-clip)">
        {/* white leather sphere */}
        <circle r="100" fill="url(#sb-base)" />

        {/* seams radiating between the white panels */}
        <g stroke="#9aa4b2" strokeWidth="3.5" strokeLinecap="round" opacity="0.65">
          <path d="M0,-41.8L0,-108" />
          <path d="M39.75,-12.92L102.71,-33.37" />
          <path d="M24.57,33.82L63.48,87.37" />
          <path d="M-24.57,33.82L-63.48,87.37" />
          <path d="M-39.75,-12.92L-102.71,-33.37" />
        </g>

        {/* black pentagons */}
        <g fill="url(#sb-panel)">
          <path d="M0,-44L41.85,-13.6L25.86,35.6L-25.86,35.6L-41.85,-13.6Z" />
          <path d="M36.44,-50.16L25.54,-83.7L54.08,-104.43L82.61,-83.7L71.71,-50.16Z" />
          <path d="M58.97,19.16L87.5,-1.57L116.03,19.16L105.13,52.7L69.86,52.7Z" />
          <path d="M0,62L28.53,82.73L17.63,116.27L-17.63,116.27L-28.53,82.73Z" />
          <path d="M-58.97,19.16L-69.86,52.7L-105.13,52.7L-116.03,19.16L-87.5,-1.57Z" />
          <path d="M-36.44,-50.16L-71.71,-50.16L-82.61,-83.7L-54.08,-104.43L-25.54,-83.7Z" />
        </g>

        {/* spherical shading + glossy highlight */}
        <circle r="100" fill="url(#sb-shade)" />
        <circle r="100" fill="url(#sb-gloss)" />
      </g>

      {/* crisp edge so the ball reads on any background */}
      <circle r="99.5" fill="none" stroke="#334155" strokeOpacity="0.35" strokeWidth="2" />
    </svg>
  );
}
