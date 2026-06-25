import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { cn, pct } from "@/lib/utils";
import type {
  PlayerInsights,
  OpponentRecord,
  PartnerRecord,
} from "@/lib/player-insights";

/**
 * Profile insights: a recent-form strip plus the player's nemesis, favourite
 * victim and best doubles partner. Pure presentational — renders nothing when
 * there's not enough history to say anything.
 */
export function PlayerInsightsPanel({ insights }: { insights: PlayerInsights }) {
  const { form, nemesis, victim, bestPartner } = insights;
  const hasRivalries = Boolean(nemesis || victim || bestPartner);
  if (form.length === 0 && !hasRivalries) return null;

  // Oldest → newest so the most recent result sits on the right (form-guide style).
  const formOrdered = [...form].reverse();

  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg font-extrabold">Approfondimenti</h2>

      {form.length > 0 && (
        <Card>
          <CardLabel className="mb-2">Forma recente</CardLabel>
          <div className="flex items-center gap-1.5">
            {formOrdered.map((g) => (
              <span
                key={g.matchId}
                title={`${g.scoreFor}–${g.scoreAgainst}`}
                aria-label={g.won ? "Vittoria" : "Sconfitta"}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-lg text-xs font-extrabold text-white",
                  g.won ? "bg-win" : "bg-loss",
                )}
              >
                {g.won ? "V" : "S"}
              </span>
            ))}
            <span className="ml-1 text-xs text-muted">
              ultime {form.length}
            </span>
          </div>
        </Card>
      )}

      {hasRivalries && (
        <div className="grid gap-3 sm:grid-cols-3">
          {nemesis && (
            <RivalCard
              label="La tua nemesi"
              emoji="😤"
              rec={nemesis}
              detail={`${nemesis.lost}S – ${nemesis.won}V su ${nemesis.played}`}
            />
          )}
          {victim && (
            <RivalCard
              label="Vittima preferita"
              emoji="🎯"
              rec={victim}
              detail={`${victim.won}V – ${victim.lost}S su ${victim.played}`}
            />
          )}
          {bestPartner && (
            <PartnerCardView
              rec={bestPartner}
              detail={`${bestPartner.won}V su ${bestPartner.played} · ${pct(
                bestPartner.won,
                bestPartner.played,
              )}%`}
            />
          )}
        </div>
      )}
    </div>
  );
}

function RivalCard({
  label,
  emoji,
  rec,
  detail,
}: {
  label: string;
  emoji: string;
  rec: OpponentRecord;
  detail: string;
}) {
  return (
    <Link
      href={`/giocatori/${rec.player.slug}`}
      className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
    >
      <Avatar
        name={rec.player.name}
        colorIndex={rec.player.avatarColor}
        imageUrl={rec.player.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span aria-hidden>{emoji}</span> {label}
        </p>
        <p className="truncate font-bold">{rec.player.name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}

function PartnerCardView({
  rec,
  detail,
}: {
  rec: PartnerRecord;
  detail: string;
}) {
  return (
    <Link
      href={`/giocatori/${rec.player.slug}`}
      className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
    >
      <Avatar
        name={rec.player.name}
        colorIndex={rec.player.avatarColor}
        imageUrl={rec.player.avatarUrl}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span aria-hidden>🤝</span> Miglior compagno
        </p>
        <p className="truncate font-bold">{rec.player.name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
    </Link>
  );
}
