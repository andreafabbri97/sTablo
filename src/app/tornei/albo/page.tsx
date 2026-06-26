import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, ArrowLeft, Crown, Star } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { RowsSkeleton } from "@/components/ui/skeletons";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { PlayerName } from "@/components/player/player-name";
import { Badge } from "@/components/ui/badge";
import {
  getTournamentChampions,
  type TournamentChampion,
} from "@/lib/tournament/albo";
import { FORMAT_META, DISCIPLINE_LABEL } from "@/lib/tournament/queries";
import { getPlayerUsernames } from "@/lib/queries";
import { getSeasonMvps, type SeasonMvp } from "@/lib/seasons";
import { formatDate } from "@/lib/utils";
import { safe } from "@/lib/safe";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Albo d'oro" };

export default function AlboPage() {
  return (
    <div>
      {/* Static shell: title + back-to-tornei action paint instantly. */}
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Albo d'oro"
        subtitle="I campioni dei tornei e gli MVP delle stagioni"
        action={
          <Button asChild size="sm" variant="secondary">
            <Link href="/tornei">
              <ArrowLeft className="h-4 w-4" /> Tornei
            </Link>
          </Button>
        }
        help="tornei"
      />
      <Suspense fallback={<RowsSkeleton rows={4} />}>
        <AlboContent />
      </Suspense>
    </div>
  );
}

async function AlboContent() {
  // `getSeasonMvps()` defaults its reference to `new Date()`; opt into
  // request-time rendering first so reading the clock is allowed.
  await connection();
  const [champions, mvps, usernames] = await Promise.all([
    safe(() => getTournamentChampions(), [] as TournamentChampion[]),
    safe(() => getSeasonMvps(), [] as SeasonMvp[]),
    safe(() => getPlayerUsernames(), [] as { id: string; username: string | null }[]),
  ]);

  // player id → account handle, to label each season MVP with their @username.
  const usernameById = new Map(usernames.map((u) => [u.id, u.username]));

  const isEmpty = champions.length === 0 && mvps.length === 0;

  return (
    <>
      {isEmpty ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Ancora nessun trofeo"
          description="Quando un torneo viene concluso o una stagione finisce, i campioni compaiono qui in eterno. 🏆"
        />
      ) : (
        <div className="space-y-8">
          {champions.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
                <Trophy className="h-5 w-5 text-[var(--gold)]" /> Campioni dei
                tornei
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {champions.map((c) => (
                  <ChampionCard key={c.tournamentId} champion={c} />
                ))}
              </div>
            </section>
          )}

          {mvps.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
                <Star className="h-5 w-5 text-[var(--gold)]" /> MVP delle
                stagioni
              </h2>
              <div className="space-y-2.5">
                {mvps.map((m, i) => (
                  <MvpRow
                    key={`${m.season.year}-${m.season.month}`}
                    item={m}
                    username={usernameById.get(m.mvp.player.id) ?? null}
                    latest={i === 0}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function ChampionCard({ champion: c }: { champion: TournamentChampion }) {
  const meta = FORMAT_META[c.format];
  const winner = (
    <div className="flex items-center gap-2.5">
      <Avatar
        name={c.winner.name}
        colorIndex={c.winner.avatarColor}
        imageUrl={c.winner.avatarUrl}
        size="sm"
        ring
      />
      <span className="min-w-0">
        <PlayerName
          name={c.winner.name}
          username={c.winner.username}
          nameClassName="font-display font-extrabold text-[var(--gold)]"
        />
      </span>
    </div>
  );

  return (
    <Card className="relative overflow-hidden border-[color-mix(in_srgb,var(--gold)_35%,var(--border))]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-2xl">{meta?.emoji ?? "🏆"}</span>
        <span className="text-xs text-muted">{formatDate(c.decidedAt)}</span>
      </div>
      <Link
        href={`/tornei/${c.slug}`}
        className="font-display text-base font-extrabold hover:text-brand"
      >
        {c.name}
      </Link>
      <p className="mt-0.5 text-xs text-muted">
        {meta?.label ?? c.format} · {DISCIPLINE_LABEL[c.discipline] ?? c.discipline}
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] px-3 py-2">
        <Crown className="h-4 w-4 shrink-0 text-[var(--gold)]" />
        {c.winner.slug ? (
          <Link href={`/giocatori/${c.winner.slug}`} className="min-w-0 hover:opacity-80">
            {winner}
          </Link>
        ) : (
          winner
        )}
      </div>
    </Card>
  );
}

function MvpRow({
  item,
  username,
  latest,
}: {
  item: SeasonMvp;
  username: string | null;
  latest: boolean;
}) {
  const { mvp, season } = item;
  const name = mvp.player.name;
  const inner = (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Avatar
          name={name}
          colorIndex={mvp.player.avatarColor}
          imageUrl={mvp.player.avatarUrl}
          size="md"
          ring={latest}
        />
        {latest && (
          <span className="absolute -right-1 -top-1 text-base drop-shadow">👑</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs capitalize text-muted">{season.label}</p>
        <PlayerName
          name={name}
          username={username}
          nameClassName="font-display font-extrabold group-hover:text-brand"
        />
      </div>
    </div>
  );

  return (
    <Card
      className={
        latest
          ? "flex items-center justify-between gap-3 border-[color-mix(in_srgb,var(--gold)_40%,var(--border))] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)]"
          : "flex items-center justify-between gap-3"
      }
    >
      <Link href={`/giocatori/${mvp.player.slug}`} className="group min-w-0">
        {inner}
      </Link>
      <div className="flex shrink-0 flex-col items-end gap-1 text-right">
        <Badge tone="gold">
          <Trophy className="h-3 w-3" /> {mvp.won}{" "}
          {mvp.won === 1 ? "vittoria" : "vittorie"}
        </Badge>
        <span className="text-xs text-muted">
          {mvp.won}-{mvp.lost} · {item.totalMatches}{" "}
          {item.totalMatches === 1 ? "partita" : "partite"}
        </span>
      </div>
    </Card>
  );
}
