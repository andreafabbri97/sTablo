import { ImageResponse } from "next/og";
import { getPlayerWithStatsBySlug } from "@/lib/stats";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_META,
  getPlayStyle,
  rankTitle,
} from "@/lib/gamification";
import { initials } from "@/lib/utils";
import {
  OG_BG,
  OG_CONTENT_TYPE,
  OG_SIZE,
  ogAvatarColor,
} from "@/lib/og";
import { safe } from "@/lib/safe";

export const alt = "Card giocatore — sTablo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

function Brand() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1 }}>
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
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await safe(() => getPlayerWithStatsBySlug(slug), null);

  const name = data?.player.name ?? "Giocatore";
  const color = ogAvatarColor(data?.player.avatarColor ?? 0);
  const isPublic = data ? data.player.statsPublic : false;
  const style = data ? getPlayStyle(data.player.playStyle) : null;

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
          padding: "52px 64px",
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
          <Brand />
          {data && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                padding: "10px 22px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
              }}
            >
              Lv {data.level.level} · {rankTitle(data.level.level)}
            </div>
          )}
        </div>

        {/* body */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: 420,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 240,
                height: 240,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
                alignItems: "center",
                justifyContent: "center",
                fontSize: 96,
                fontWeight: 800,
                border: "8px solid rgba(255,255,255,0.28)",
              }}
            >
              {initials(name)}
            </div>
            <div
              style={{
                marginTop: 24,
                fontSize: 50,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {name}
            </div>
            {style && (
              <div
                style={{
                  fontSize: 24,
                  opacity: 0.9,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {style.name}
              </div>
            )}
          </div>

          {isPublic && data ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 210, fontWeight: 800, lineHeight: 1 }}>
                {data.overall}
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: 12,
                  opacity: 0.85,
                }}
              >
                OVR
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.85,
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 700 }}>Scheda privata</div>
              <div style={{ fontSize: 24 }}>Profilo su sTablo</div>
            </div>
          )}
        </div>

        {/* attributes footer */}
        {isPublic && data && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "2px solid rgba(255,255,255,0.25)",
              paddingTop: 22,
            }}
          >
            {ATTRIBUTE_KEYS.map((k) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flex: 1,
                }}
              >
                <div style={{ fontSize: 54, fontWeight: 800 }}>
                  {data.attributes[k]}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    opacity: 0.8,
                    textTransform: "uppercase",
                    letterSpacing: 2,
                  }}
                >
                  {ATTRIBUTE_META[k].label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    { ...size },
  );
}
