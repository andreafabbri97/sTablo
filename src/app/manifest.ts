import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Stable identity so the install isn't duplicated if start_url ever changes.
    id: "/",
    name: "sTablo — Tavolino Rimini",
    short_name: "sTablo",
    description:
      "Segna le partite di tavolino, scala la classifica Elo e organizza tornei.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: "ltr",
    background_color: "#070a0f",
    theme_color: "#ff6a2c",
    categories: ["sports", "games"],
    lang: "it",
    icons: [
      // SVG first for crisp scaling on modern browsers; PNG 192/512 as the
      // widely-required raster fallback so the install prompt (and the home
      // icon on older Android) always has a valid icon.
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    // Long-press the home-screen icon → jump straight to a key section.
    shortcuts: [
      {
        name: "Classifica",
        short_name: "Classifica",
        url: "/classifica",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Partite",
        short_name: "Partite",
        url: "/partite",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      {
        name: "Registra partita",
        short_name: "Nuova",
        url: "/partite/nuova",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
      },
    ],
  };
}
