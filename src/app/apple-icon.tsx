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
    <linearGradient id="table" x1="96" y1="300" x2="416" y2="392" gradientUnits="userSpaceOnUse">
      <stop stop-color="#ff9356"/>
      <stop offset="0.55" stop-color="#ff6a2c"/>
      <stop offset="1" stop-color="#f0510f"/>
    </linearGradient>
    <radialGradient id="ball" cx="344" cy="134" r="80" gradientUnits="userSpaceOnUse">
      <stop stop-color="#eaff8a"/>
      <stop offset="0.5" stop-color="#d7ff3e"/>
      <stop offset="1" stop-color="#a6cc1f"/>
    </radialGradient>
    <radialGradient id="ballHalo" cx="360" cy="150" r="100" gradientUnits="userSpaceOnUse">
      <stop stop-color="#d7ff3e" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#d7ff3e" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <rect width="512" height="512" fill="url(#glow)"/>
  <ellipse cx="256" cy="426" rx="152" ry="18" fill="#000000" opacity="0.30"/>
  <g filter="url(#soft)">
    <path d="M92 360c0-74 82-122 164-122s164 48 164 122" stroke="url(#table)" stroke-width="38" stroke-linecap="round"/>
    <path d="M134 360l-22 58M378 360l22 58" stroke="url(#table)" stroke-width="30" stroke-linecap="round"/>
  </g>
  <path d="M256 236v150" stroke="#2ad0ef" stroke-width="28" stroke-linecap="round"/>
  <path d="M256 244v66" stroke="#bff4ff" stroke-width="10" stroke-linecap="round" opacity="0.55"/>
  <circle cx="360" cy="150" r="100" fill="url(#ballHalo)"/>
  <circle cx="360" cy="150" r="54" fill="url(#ball)"/>
  <path d="M331 137l29 15 29-15M360 108v30" stroke="#1a2200" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <circle cx="342" cy="132" r="13" fill="#ffffff" opacity="0.45"/>
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
