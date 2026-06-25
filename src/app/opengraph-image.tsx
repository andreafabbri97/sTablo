import { ImageResponse } from "next/og";
import { OG_BG, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";

export const alt = "sTablo — il campo digitale del tavolino di Rimini";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: OG_BG,
          color: "white",
          padding: "72px 80px",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -2 }}>
          sTablo
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            marginTop: 8,
            letterSpacing: 6,
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          Tavolino · Rimini
        </div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.85, maxWidth: 900 }}>
          Segna le partite, scala la classifica Elo, organizza tornei.
        </div>
      </div>
    ),
    { ...size },
  );
}
