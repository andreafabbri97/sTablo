import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock, Pencil, TrendingUp, Quote, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, CardLabel } from "@/components/ui/card";
import { MatchCard } from "@/components/match-card";
import { FifaCard } from "@/components/player/fifa-card";
import { LevelBar } from "@/components/player/level-bar";
import { AttributeBars } from "@/components/player/attribute-bars";
import { EloChart } from "@/components/player/elo-chart";
import { BadgeShelf } from "@/components/player/badge-shelf";
import { getPlayerWithStatsBySlug } from "@/lib/stats";
import { getEloSeries, getMatchesForPlayer, getPlayerSlugById } from "@/lib/queries";
import { computeBadges } from "@/lib/badges";
import { getCurrentUser } from "@/lib/auth-helpers";
import { userIdForPlayer, getFriendState } from "@/lib/friends";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { getPlayStyle, FOOT_LABELS } from "@/lib/gamification";
import { pct } from "@/lib/utils";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await safe(() => getPlayerWithStatsBySlug(slug), null);
  if (!data) return { title: "Giocatore" };
  const { player, level, overall } = data;
  const desc = player.statsPublic
    ? `Lv ${level.level} · OVR ${overall} — la card di ${player.name} su sTablo.`
    : `Il profilo di ${player.name} su sTablo.`;
  return {
    title: player.name,
    description: desc,
    openGraph: { title: `${player.name} · sTablo`, description: desc },
    twitter: { title: `${player.name} · sTablo`, description: desc },
  };
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await safe(() => getPlayerWithStatsBySlug(slug), null);
  if (!data) notFound();

  const { player, stats, level, attributes, overall, tournamentsWon } = data;
  const badges = computeBadges({
    played: stats.played,
    won: stats.won,
    winRate: stats.winRate,
    bestStreak: stats.bestStreak,
    currentStreak: stats.currentStreak,
    peakElo: player.peakElo,
    tournamentsWon,
    level: level.level,
  });
  const [user, series, recent] = await Promise.all([
    getCurrentUser(),
    safe(() => getEloSeries(player.id, "player_singles"), []),
    safe(() => getMatchesForPlayer(player.id, 8), []),
  ]);

  const isOwner = user?.playerId === player.id;
  const showCard = player.statsPublic || isOwner || user?.role === "admin";
  const style = getPlayStyle(player.playStyle);

  // Slug of the logged-in viewer's own profile, to build the head-to-head link.
  const viewerSlug =
    user?.playerId && user.playerId !== player.id
      ? await safe(() => getPlayerSlugById(user.playerId as string), null)
      : null;

  const targetUserId = await userIdForPlayer(player.id);
  const friendState = user
    ? await getFriendState(user.id, targetUserId)
    : "no-account";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card-surface flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-left">
        <Avatar name={player.name} colorIndex={player.avatarColor} imageUrl={player.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            {player.name}
          </h1>
          {player.nickname && (
            <p className="text-sm font-semibold text-brand">“{player.nickname}”</p>
          )}
          {player.motto && (
            <p className="mt-1 flex items-center justify-center gap-1 text-sm italic text-muted sm:justify-start">
              <Quote className="h-3.5 w-3.5" /> {player.motto}
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge tone="brand">Elo singolo {player.eloSingles}</Badge>
            <Badge tone="sea">Elo doppio {player.eloDoubles}</Badge>
            <Badge tone="gold">Picco {player.peakElo}</Badge>
          </div>
          {player.bio && (
            <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-relaxed text-muted">
              {player.bio}
            </p>
          )}
        </div>
        {isOwner ? (
          <Button asChild variant="secondary" size="sm">
            <Link href="/profilo">
              <Pencil className="h-4 w-4" /> Modifica
            </Link>
          </Button>
        ) : (
          user && (
            <div className="flex flex-col gap-2">
              {targetUserId && (
                <AddFriendButton targetUserId={targetUserId} state={friendState} />
              )}
              {viewerSlug && (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/giocatori/${viewerSlug}/vs/${player.slug}`}>
                    <Swords className="h-4 w-4" /> Testa a testa
                  </Link>
                </Button>
              )}
            </div>
          )
        )}
      </div>

      {/* Gamification (privacy-gated) */}
      {showCard ? (
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <FifaCard player={player} overall={overall} attributes={attributes} level={level} />
          <div className="space-y-4">
            <LevelBar level={level} />
            <Card>
              <CardTitle className="mb-3">Caratteristiche</CardTitle>
              <AttributeBars attributes={attributes} />
            </Card>
            {(style || player.preferredFoot || player.specialMove) && (
              <Card className="flex flex-wrap gap-4">
                {player.preferredFoot && (
                  <Info label="Piede" value={FOOT_LABELS[player.preferredFoot]} />
                )}
                {style && <Info label="Stile" value={`${style.emoji} ${style.name}`} />}
                {player.specialMove && (
                  <Info label="Mossa speciale" value={`⚡ ${player.specialMove}`} />
                )}
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-2 text-muted">
            <Lock className="h-5 w-5" />
          </span>
          <CardTitle>Statistiche private</CardTitle>
          <p className="max-w-xs text-sm text-muted">
            {player.name} ha scelto di non condividere livello e caratteristiche.
            La classifica e i risultati restano pubblici.
          </p>
        </Card>
      )}

      {/* Public stats — always visible */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Partite" value={stats.played} />
        <StatBox label="Vittorie" value={stats.won} tone="win" />
        <StatBox label="Sconfitte" value={stats.lost} tone="loss" />
        <StatBox label="% Vittorie" value={`${pct(stats.won, stats.played)}%`} />
        <StatBox label="Punti fatti" value={stats.pointsFor} />
        <StatBox label="Differenza" value={(stats.pointDiff >= 0 ? "+" : "") + stats.pointDiff} />
        <StatBox label="Striscia" value={streakLabel(stats.currentStreak)} />
        <StatBox label="Miglior serie" value={`${stats.bestStreak}V`} />
      </div>

      {/* Trofei — sbloccati dalle statistiche pubbliche */}
      <BadgeShelf badges={badges} ownerName={player.name} />

      {/* Elo chart */}
      <Card>
        <CardLabel className="mb-1 flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" /> Andamento Elo (singolo)
        </CardLabel>
        <EloChart data={series} />
      </Card>

      {/* Recent matches */}
      {recent.length > 0 && (
        <div>
          <h2 className="mb-3 font-display text-lg font-extrabold">Ultime partite</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function streakLabel(streak: number): string {
  if (streak === 0) return "—";
  return streak > 0 ? `${streak}V 🔥` : `${Math.abs(streak)}S`;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <CardLabel>{label}</CardLabel>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "win" | "loss";
}) {
  return (
    <div className="card-surface p-4 text-center">
      <p
        className={
          "font-display text-2xl font-extrabold tabular-nums " +
          (tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "")
        }
      >
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
