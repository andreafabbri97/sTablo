import { ImageResponse } from "next/og";

/**
 * iOS home-screen icon for the installed PWA. iOS Safari ignores SVG
 * apple-touch-icons, so we rasterise the sTablo mark to a 180×180 PNG here
 * (Next file convention → injects <link rel="apple-touch-icon">). The artwork is
 * full-bleed and opaque: iOS applies its own rounded-squircle mask, so we must
 * not pre-round or leave transparent corners. Kept visually in sync with
 * public/icon.svg.
 */

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
      <stop stop-color="#16202d"/>
      <stop offset="1" stop-color="#070a0f"/>
    </linearGradient>
    <radialGradient id="glow" cx="368" cy="138" r="330" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff7a40" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ff7a40" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="seaGlow" cx="150" cy="430" r="280" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2ad0ef" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#2ad0ef" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="table" x1="96" y1="300" x2="416" y2="392" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff9356"/>
      <stop offset="0.55" stop-color="#ff6a2c"/>
      <stop offset="1" stop-color="#f0510f"/>
    </linearGradient>
    <radialGradient id="ballHalo" cx="360" cy="150" r="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ffd21a" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffd21a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ballY" cx="0.36" cy="0.30" r="0.82">
      <stop offset="0" stop-color="#fff27a"/>
      <stop offset="0.5" stop-color="#ffd21a"/>
      <stop offset="1" stop-color="#b88900"/>
    </radialGradient>
    <radialGradient id="ballGloss" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="ballClip"><circle r="100"/></clipPath>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <rect width="512" height="512" fill="url(#seaGlow)"/>
  <ellipse cx="256" cy="426" rx="152" ry="18" fill="#000000" opacity="0.30"/>
  <g filter="url(#soft)">
    <path d="M92 360c0-74 82-122 164-122s164 48 164 122" stroke="url(#table)" stroke-width="38" stroke-linecap="round"/>
    <path d="M134 360l-22 58M378 360l22 58" stroke="url(#table)" stroke-width="30" stroke-linecap="round"/>
  </g>
  <path d="M256 236v150" stroke="#2ad0ef" stroke-width="28" stroke-linecap="round"/>
  <path d="M256 244v66" stroke="#bff4ff" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
  <circle cx="360" cy="150" r="100" fill="url(#ballHalo)"/>
  <g transform="translate(360,150) scale(0.54)" clip-path="url(#ballClip)">
    <circle r="100" fill="url(#ballY)"/>
    <path d="M0,-33.3L0,-108" stroke="#10131a" stroke-width="6" stroke-linecap="round"/>
    <path d="M31.67,-10.29L102.71,-33.37" stroke="#10131a" stroke-width="6" stroke-linecap="round"/>
    <path d="M19.57,26.94L63.48,87.37" stroke="#10131a" stroke-width="6" stroke-linecap="round"/>
    <path d="M-19.57,26.94L-63.48,87.37" stroke="#10131a" stroke-width="6" stroke-linecap="round"/>
    <path d="M-31.67,-10.29L-102.71,-33.37" stroke="#10131a" stroke-width="6" stroke-linecap="round"/>
    <path d="M0,-37L35.19,-11.43L21.75,29.93L-21.75,29.93L-35.19,-11.43Z" fill="#10131a"/>
    <path d="M33.5,-46.11L21.52,-83.01L52.9,-105.81L84.29,-83.01L72.3,-46.11Z" fill="#10131a"/>
    <path d="M54.21,17.61L85.6,-5.19L116.98,17.61L104.99,54.51L66.2,54.51Z" fill="#10131a"/>
    <path d="M0,57L31.38,79.8L19.4,116.7L-19.4,116.7L-31.38,79.8Z" fill="#10131a"/>
    <path d="M-54.21,17.61L-66.2,54.51L-104.99,54.51L-116.98,17.61L-85.6,-5.19Z" fill="#10131a"/>
    <path d="M-33.5,-46.11L-72.3,-46.11L-84.29,-83.01L-52.9,-105.81L-21.52,-83.01Z" fill="#10131a"/>
    <circle cx="-30" cy="-36" r="42" fill="url(#ballGloss)"/>
  </g>
</svg>`;

export default function AppleIcon() {
  const src = `data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={180} height={180} src={src} alt="sTablo" />
      </div>
    ),
    { ...size },
  );
}
