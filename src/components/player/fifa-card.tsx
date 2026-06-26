import { Avatar } from "@/components/ui/avatar";
import { InstagramIcon } from "@/components/icons/instagram-icon";
import { getPlayStyle, FOOT_LABELS, type Attributes, type LevelInfo } from "@/lib/gamification";
import { resolveCardBackground } from "@/lib/card-backgrounds";
import type { Player } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

/** Collectible-card style hero for a player profile. */
export function FifaCard({
  player,
  username,
  overall,
  attributes,
  level,
  backgroundId,
}: {
  player: Player;
  /** Account handle shown under the name, so the card always says who it is. */
  username?: string | null;
  overall: number;
  attributes: Attributes;
  level: LevelInfo;
  /** Override the player's saved background (used for the live editor preview). */
  backgroundId?: string;
}) {
  const style = getPlayStyle(player.playStyle);
  const background = resolveCardBackground(backgroundId ?? player.cardBackground);

  return (
    <div className="relative mx-auto w-full max-w-xs">
      <div
        className={cn(
          "relative overflow-hidden rounded-[var(--radius-2xl)] border border-white/10 p-5 text-white shadow-[var(--shadow-lg)]",
        )}
        style={{ background: background.css }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-2xl" />

        <div className="relative flex items-start justify-between">
          <div className="text-center leading-none">
            <p className="font-display text-4xl font-extrabold">{overall}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">OVR</p>
            {style && <p className="mt-1 text-2xl">{style.emoji}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-right text-[11px] font-semibold uppercase tracking-wider opacity-90">
              <p>Lv {level.level}</p>
              <p>{FOOT_LABELS[player.preferredFoot ?? ""] ?? "—"}</p>
            </div>
            {player.instagram && (
              <a
                href={`https://instagram.com/${player.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Instagram di ${player.name}`}
                className="grid h-7 w-7 place-items-center rounded-lg text-white shadow-md ring-1 ring-white/25 transition hover:scale-105"
                style={{
                  background:
                    "linear-gradient(45deg,#feda75 0%,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5 100%)",
                }}
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <div className="relative my-3 flex justify-center">
          <Avatar name={player.name} colorIndex={player.avatarColor} imageUrl={player.avatarUrl} size="xl" className="ring-4 ring-white/30" />
        </div>

        <div className="relative text-center">
          <p className="truncate font-display text-xl font-extrabold uppercase tracking-wide">
            {player.name}
          </p>
          {username && (
            <p className="truncate text-xs font-semibold tracking-wide opacity-80">
              @{username}
            </p>
          )}
          {style && (
            <p className="text-xs font-semibold uppercase tracking-widest opacity-90">
              {style.name}
            </p>
          )}
        </div>

        <div className="relative mt-4 grid grid-cols-5 gap-1 border-t border-white/20 pt-3 text-center">
          {Object.entries(attributes).map(([k, v]) => (
            <div key={k}>
              <p className="font-mono text-sm font-extrabold tabular-nums">{v}</p>
              <p className="text-[8px] font-bold uppercase opacity-75">{k.slice(0, 3)}</p>
            </div>
          ))}
        </div>

        {player.specialMove && (
          <div className="relative mt-3 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-center backdrop-blur">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/75">Mossa speciale</p>
            <p className="text-sm font-bold text-white">⚡ {player.specialMove}</p>
          </div>
        )}
      </div>
    </div>
  );
}
