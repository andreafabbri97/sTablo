import Link from "next/link";
import { CalendarClock, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { RelativeTime } from "@/components/relative-time";
import type { ShapedMatch, ShapedSide } from "@/lib/queries";
import { tournamentRoundLabel } from "@/lib/tournament/round-label";
import { TEAMS_ENABLED } from "@/lib/features";

/**
 * A match as a feed card. The whole card links to the match detail page
 * (`linkable`, on by default) via a stretched overlay link; inner links —
 * player profiles and the tournament chip — sit above it so they stay
 * clickable. Pass `linkable={false}` on the detail page itself so the card
 * doesn't link to the page it's already on.
 */
export function MatchCard({
  match,
  linkable = true,
}: {
  match: ShapedMatch;
  linkable?: boolean;
}) {
  const isScheduled = match.status === "scheduled";
  const aWon = match.winner === "A";
  const bWon = match.winner === "B";
  const roundLabel = tournamentRoundLabel(match);
  // Tournament matches store their round name in `note`; only show a free-text
  // quote for casual matches, where `note` is a real player comment.
  const userNote = match.tournamentId ? null : match.note;

  return (
    <div
      className={cn(
        "card-surface relative overflow-hidden p-0",
        linkable && "transition hover:border-brand/40",
      )}
    >
      {linkable && (
        <Link
          href={`/partite/${match.id}`}
          aria-label="Apri il dettaglio della partita"
          className="absolute inset-0 z-[1] focus-visible:ring-2 focus-visible:ring-brand/40"
        />
      )}

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
          {roundLabel && <Badge tone="muted">{roundLabel}</Badge>}
        </div>
        <RelativeTime
          date={match.playedAt}
          mode={isScheduled ? "until" : "ago"}
          className="text-xs text-muted"
        />
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

      {/* Meta row: when it was played + which tournament it belongs to, so the
          match is unmistakable when commenting on it. */}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {formatDateTime(match.playedAt)}
        </span>
        {match.tournamentName && match.tournamentSlug && (
          <Link
            href={`/tornei/${match.tournamentSlug}`}
            className="relative z-[2] inline-flex max-w-[55%] items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 font-bold text-brand hover:underline"
            title={`Torneo: ${match.tournamentName}`}
          >
            <Swords className="h-3 w-3 shrink-0" />
            <span className="truncate">{match.tournamentName}</span>
          </Link>
        )}
      </div>

      {userNote && (
        <p className="border-t border-border px-4 py-2 text-xs italic text-muted">
          “{userNote}”
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
          <div key={p.slug} className="min-w-0">
            <Link
              href={`/giocatori/${p.slug}`}
              className={cn(
                "relative z-[2] block truncate text-sm font-semibold hover:text-brand",
                won ? "text-foreground" : "text-muted",
              )}
            >
              {p.name}
            </Link>
            {p.username && (
              <span className="block truncate text-[11px] leading-tight text-muted">
                @{p.username}
              </span>
            )}
          </div>
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
