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
      // Raster PNGs of the official sTablo logo. The "-v2" suffix is a deliberate
      // cache-bust: installed PWAs key the home-screen icon by URL, so a NEW path
      // is what makes existing installs pick up the changed artwork (paired with
      // the bumped service-worker cache that re-fetches this manifest). No SVG
      // here on purpose — Chrome prefers an `any`-sized SVG and would keep
      // rendering the old vector mark instead of this logo.
      { src: "/icon-192-v2.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512-v2.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-v2.png",
        sizes: "512x512",
        type: "image/png",
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
