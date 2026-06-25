import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, timeAgo, timeUntil, formatDateTime } from "@/lib/utils";
import type { ShapedMatch, ShapedSide } from "@/lib/queries";
import { TEAMS_ENABLED } from "@/lib/features";

export function MatchCard({ match }: { match: ShapedMatch }) {
  const isScheduled = match.status === "scheduled";
  const aWon = match.winner === "A";
  const bWon = match.winner === "B";

  return (
    <div className="card-surface overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={match.format === "singles" ? "sea" : "brand"}>
            {match.format === "singles" ? "1 vs 1" : "2 vs 2"}
          </Badge>
          {match.ranked ? (
            <Badge tone="gold">🏆 Classificata</Badge>
          ) : (
            <Badge tone="muted">🤝 Amichevole</Badge>
          )}
          {match.status === "pending" && (
            <Badge tone="ball">⏳ Da confermare</Badge>
          )}
          {isScheduled && <Badge tone="sea">📅 In programma</Badge>}
        </div>
        <span className="text-xs text-muted">
          {isScheduled ? timeUntil(match.playedAt) : timeAgo(match.playedAt)}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-4">
        <SideView side={match.sideA} won={aWon} align="start" />

        <div className="flex flex-col items-center px-2">
          {isScheduled ? (
            <div className="flex flex-col items-center text-center">
              <span className="font-display text-lg font-extrabold text-muted">VS</span>
              <span className="mt-0.5 text-[11px] font-semibold leading-tight text-brand">
                {formatDateTime(match.playedAt)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-mono text-2xl font-bold tabular-nums">
              <span className={cn(aWon ? "text-foreground" : "text-muted")}>
                {match.scoreA}
              </span>
              <span className="text-muted/50">-</span>
              <span className={cn(bWon ? "text-foreground" : "text-muted")}>
                {match.scoreB}
              </span>
            </div>
          )}
        </div>

        <SideView side={match.sideB} won={bWon} align="end" />
      </div>

      {match.note && (
        <p className="border-t border-border px-4 py-2 text-xs italic text-muted">
          “{match.note}”
        </p>
      )}
    </div>
  );
}

function SideView({
  side,
  won,
  align,
}: {
  side: ShapedSide;
  won: boolean;
  align: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5",
        align === "end" ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2",
          align === "end" && "flex-row-reverse",
        )}
      >
        <div className={cn("flex -space-x-2", align === "end" && "flex-row-reverse space-x-reverse")}>
          {side.players.map((p) => (
            <Avatar key={p.slug} name={p.name} colorIndex={p.colorIndex} imageUrl={p.imageUrl} size="sm" />
          ))}
        </div>
        {won && <span className="text-base">🏆</span>}
      </div>
      <div className={cn("w-full min-w-0", align === "end" && "text-right")}>
        {side.players.map((p) => (
          <Link
            key={p.slug}
            href={`/giocatori/${p.slug}`}
            className={cn(
              "block truncate text-sm font-semibold hover:text-brand",
              won ? "text-foreground" : "text-muted",
            )}
          >
            {p.name}
          </Link>
        ))}
        {TEAMS_ENABLED && side.teamName && (
          <span className="text-[11px] font-bold uppercase tracking-wide text-brand">
            {side.teamName}
          </span>
        )}
      </div>
    </div>
  );
}
