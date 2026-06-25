import { cn } from "@/lib/utils";

/**
 * Mikasa FT-5 footvolley ball — the yellow/blue beach-soccer ball used on the
 * Rimini courts. It's a classic soccer-ball layout recoloured: an all-yellow
 * glossy sphere with a central yellow pentagon and bold blue triangles fanning
 * out from its corners to divide the yellow panels — exactly the "pentagoni
 * gialli + triangoli blu" look. Lit from the top-left with a wet, glossy sheen.
 * Self-contained SVG → size it freely via `className`.
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
        <linearGradient id="fvb-blue" x1="-60" y1="-90" x2="60" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#56a0ff" />
          <stop offset="0.55" stopColor="#2f78e6" />
          <stop offset="1" stopColor="#123f8f" />
        </linearGradient>
        <radialGradient id="fvb-shade" cx="-30" cy="-38" r="150" gradientUnits="userSpaceOnUse">
          <stop offset="0.55" stopColor="#05122e" stopOpacity="0" />
          <stop offset="1" stopColor="#05122e" stopOpacity="0.42" />
        </radialGradient>
        <radialGradient id="fvb-gloss" cx="-42" cy="-48" r="64" gradientUnits="userSpaceOnUse">
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

        {/* the pattern, tilted a touch as if caught mid-spin. The lighting below
            stays fixed to the light source. */}
        <g transform="rotate(-12)">
          {/* blue triangles fanning out from each corner of the centre pentagon
              to the rim — the dividers between the yellow panels */}
          <g fill="url(#fvb-blue)">
            <path d="M0,-24.8 L-43.84,-89.88 L43.84,-89.88 Z" />
            <path d="M23.59,-7.66 L71.93,-69.47 L99.03,13.92 Z" />
            <path d="M14.58,20.06 L88.29,46.95 L17.36,98.48 Z" />
            <path d="M-14.58,20.06 L-17.36,98.48 L-88.29,46.95 Z" />
            <path d="M-23.59,-7.66 L-99.03,13.92 L-71.93,-69.47 Z" />
          </g>

          {/* the central yellow pentagon sits on top of the triangle apexes */}
          <path d="M0,-40 L38.04,-12.36 L23.51,32.36 L-23.51,32.36 L-38.04,-12.36 Z" fill="url(#fvb-base)" />

          {/* stitched seams: the pentagon outline + the spokes to the rim */}
          <g
            fill="none"
            stroke="#0f2347"
            strokeWidth="3.5"
            strokeOpacity="0.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            <path d="M0,-40 L38.04,-12.36 L23.51,32.36 L-23.51,32.36 L-38.04,-12.36 Z" />
            <path d="M0,-40 L0,-100 M38.04,-12.36 L95.11,-30.9 M23.51,32.36 L58.78,80.9 M-23.51,32.36 L-58.78,80.9 M-38.04,-12.36 L-95.11,-30.9" />
          </g>
        </g>

        {/* spherical shading + glossy highlight (fixed to the light source) */}
        <circle r="100" fill="url(#fvb-shade)" />
        <circle r="100" fill="url(#fvb-gloss)" />
        {/* small wet specular dot for the lucid sheen */}
        <ellipse cx="-40" cy="-50" rx="20" ry="14" fill="#ffffff" opacity="0.5" transform="rotate(-24 -40 -50)" />
      </g>

      {/* crisp edge so the ball reads on any background */}
      <circle r="99.5" fill="none" stroke="#0b1220" strokeOpacity="0.18" strokeWidth="2" />
    </svg>
  );
}
