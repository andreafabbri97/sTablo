import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "sTablo — Tavolino Rimini",
    short_name: "sTablo",
    description:
      "Segna le partite di tavolino, scala la classifica Elo e organizza tornei.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070a0f",
    theme_color: "#ff6a2c",
    categories: ["sports", "games"],
    lang: "it",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
