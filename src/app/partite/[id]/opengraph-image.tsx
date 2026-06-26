import { ImageResponse } from "next/og";
import { getMatchById } from "@/lib/queries";
import type { ShapedSide } from "@/lib/queries";
import { initials } from "@/lib/utils";
import {
  OG_BG_MATCH,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogAvatarColor,
  ogDate,
} from "@/lib/og";
import { safe } from "@/lib/safe";

export const alt = "Risultato partita — sTablo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function SideBlock({
  side,
  win,
  dim,
}: {
  side: ShapedSide;
  win: boolean;
  dim: boolean;
}) {
  const players = side.players.length
    ? side.players
    : [{ id: "x", name: side.label || "?", colorIndex: 0 }];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: 380,
        opacity: dim ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        {players.slice(0, 2).map((p, i) => {
          const c = ogAvatarColor(p.colorIndex);
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                width: 130,
                height: 130,
                marginLeft: i === 0 ? 0 : -24,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 48,
                fontWeight: 800,
                color: "white",
                border: "6px solid rgba(18,10,38,0.85)",
              }}
            >
              {initials(p.name)}
            </div>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 20,
          fontSize: 38,
          fontWeight: 800,
          textAlign: "center",
          maxWidth: 360,
        }}
      >
        {side.label || "—"}
      </div>
      {win && (
        <div
          style={{
            display: "flex",
            marginTop: 12,
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 3,
            padding: "6px 18px",
            borderRadius: 999,
            background: "#fff",
            color: "#b8390a",
          }}
        >
          VINCE
        </div>
      )}
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await safe(() => getMatchById(id), null);

  const hasScore =
    !!match && match.scoreA !== null && match.scoreB !== null;
  const winA = match?.winner === "A";
  const winB = match?.winner === "B";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: OG_BG_MATCH,
          color: "white",
          padding: "48px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 1 }}>
              sTablo
            </div>
            <div
              style={{
                fontSize: 18,
                opacity: 0.8,
                letterSpacing: 5,
                textTransform: "uppercase",
              }}
            >
              Tavolino Rimini
            </div>
          </div>
          {match && (
            <div style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: match.ranked
                    ? "rgba(255,255,255,0.18)"
                    : "rgba(255,255,255,0.10)",
                }}
              >
                {match.ranked ? "Ranked" : "Amichevole"}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 20,
                  fontWeight: 700,
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.10)",
                }}
              >
                {ogDate(match.playedAt)}
              </div>
            </div>
          )}
        </div>

        {/* body: side — score — side */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {match ? (
            <SideBlock side={match.sideA} win={winA} dim={winB} />
          ) : (
            <div style={{ display: "flex", width: 380 }} />
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 150,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {hasScore && match ? (
              <div style={{ display: "flex", alignItems: "center" }}>
                <span style={{ opacity: winA ? 1 : 0.6 }}>{match.scoreA}</span>
                <span style={{ margin: "0 24px", opacity: 0.6 }}>–</span>
                <span style={{ opacity: winB ? 1 : 0.6 }}>{match.scoreB}</span>
              </div>
            ) : (
              <div style={{ display: "flex", fontSize: 110, opacity: 0.85 }}>
                VS
              </div>
            )}
          </div>

          {match ? (
            <SideBlock side={match.sideB} win={winB} dim={winA} />
          ) : (
            <div style={{ display: "flex", width: 380 }} />
          )}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            fontSize: 22,
            opacity: 0.85,
          }}
        >
          {match?.note
            ? `"${match.note}"`
            : match?.status === "scheduled"
              ? "Partita in programma"
              : "Segna le partite, scala la classifica Elo"}
        </div>
      </div>
    ),
    { ...size },
  );
}
