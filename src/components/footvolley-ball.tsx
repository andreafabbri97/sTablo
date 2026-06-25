import { cn } from "@/lib/utils";

/**
 * Mikasa FT-5 footvolley ball — the real beach ball used on the Rimini courts:
 * a glossy yellow sphere with bold blue panels running pole-to-pole, exactly the
 * blue/yellow beach-soccer look. The panels are true elliptical meridians (so
 * the sphere reads as round, not flat), tilted a touch as if caught mid-spin,
 * lit from the top-left with a wet, glossy sheen. Self-contained SVG → size it
 * freely via `className`.
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
        <radialGradient id="fvb-base" cx="-34" cy="-42" r="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff1a6" />
          <stop offset="0.5" stopColor="#f7d51f" />
          <stop offset="1" stopColor="#cfa006" />
        </radialGradient>
        <linearGradient id="fvb-panel" x1="-70" y1="-100" x2="70" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5aa0f7" />
          <stop offset="0.55" stopColor="#2f78e6" />
          <stop offset="1" stopColor="#103f8f" />
        </linearGradient>
        <radialGradient id="fvb-shade" cx="-30" cy="-38" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0.55" stopColor="#05122e" stopOpacity="0" />
          <stop offset="1" stopColor="#05122e" stopOpacity="0.4" />
        </radialGradient>
        <radialGradient id="fvb-gloss" cx="-42" cy="-48" r="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.7" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id="fvb-clip">
          <circle r="100" />
        </clipPath>
      </defs>

      <g clipPath="url(#fvb-clip)">
        {/* yellow leather sphere */}
        <circle r="100" fill="url(#fvb-base)" />

        {/* blue panels + their stitched seams, tilted as if mid-spin. The pattern
            spins with the ball; the lighting below stays fixed to the light. */}
        <g transform="rotate(-18)">
          {/* blue panels: centre lune + the two silhouette lunes (pole-to-pole) */}
          <g fill="url(#fvb-panel)">
            <path d="M0,-100 C17.07,-100 30.9,-55.23 30.9,0 C30.9,55.23 17.07,100 0,100 C-17.07,100 -30.9,55.23 -30.9,0 C-30.9,-55.23 -17.07,-100 0,-100 Z" />
            <path d="M0,-100 C55.23,-100 100,-55.23 100,0 C100,55.23 55.23,100 0,100 C44.68,100 80.9,55.23 80.9,0 C80.9,-55.23 44.68,-100 0,-100 Z" />
            <path d="M0,-100 C-55.23,-100 -100,-55.23 -100,0 C-100,55.23 -55.23,100 0,100 C-44.68,100 -80.9,55.23 -80.9,0 C-80.9,-55.23 -44.68,-100 0,-100 Z" />
          </g>

          {/* seams where the panels meet (the four inner meridians) */}
          <g
            fill="none"
            stroke="#102347"
            strokeWidth="4.5"
            strokeLinecap="round"
            opacity="0.4"
          >
            <path d="M0,-100 C17.07,-100 30.9,-55.23 30.9,0 C30.9,55.23 17.07,100 0,100" />
            <path d="M0,-100 C-17.07,-100 -30.9,-55.23 -30.9,0 C-30.9,55.23 -17.07,100 0,100" />
            <path d="M0,-100 C44.68,-100 80.9,-55.23 80.9,0 C80.9,55.23 44.68,100 0,100" />
            <path d="M0,-100 C-44.68,-100 -80.9,-55.23 -80.9,0 C-80.9,55.23 -44.68,100 0,100" />
          </g>
        </g>

        {/* spherical shading + glossy highlight (fixed to the light source) */}
        <circle r="100" fill="url(#fvb-shade)" />
        <circle r="100" fill="url(#fvb-gloss)" />
        {/* small wet specular dot for the lucid sheen */}
        <ellipse cx="-40" cy="-50" rx="20" ry="14" fill="#ffffff" opacity="0.55" transform="rotate(-24 -40 -50)" />
      </g>

      {/* crisp edge so the ball reads on any background */}
      <circle r="99.5" fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}
