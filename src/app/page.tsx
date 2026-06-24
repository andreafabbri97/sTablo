import Link from "next/link";
import { Trophy, Flame, Users, Swords, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MatchCard } from "@/components/match-card";
import { EmptyState } from "@/components/ui/page";
import { getRanking } from "@/lib/stats";
import { getRecentMatches } from "@/lib/queries";
import { db } from "@/lib/db";
import { players, matches, tournaments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { safe } from "@/lib/safe";
import { cachedQuery } from "@/lib/cache";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

const counts = cachedQuery(async () => {
  const [p, m, t] = await Promise.all([
    db.select({ c: sql<number>`count(*)::int` }).from(players),
    db.select({ c: sql<number>`count(*)::int` }).from(matches),
    db.select({ c: sql<number>`count(*)::int` }).from(tournaments),
  ]);
  return { players: p[0].c, matches: m[0].c, tournaments: t[0].c };
}, ["home-counts"]);

export default async function HomePage() {
  const [ranking, recent, stats, user] = await Promise.all([
    safe(() => getRanking("overall"), []),
    safe(() => getRecentMatches(6), []),
    safe(counts, { players: 0, matches: 0, tournaments: 0 }),
    getCurrentUser(),
  ]);

  const podium = ranking.slice(0, 3);
  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-10">
      <Hero isAdmin={isAdmin} loggedIn={!!user} />

      <section className="grid grid-cols-3 gap-3">
        <StatChip icon={<Users className="h-4 w-4" />} value={stats.players} label="Giocatori" />
        <StatChip icon={<Flame className="h-4 w-4" />} value={stats.matches} label="Partite" />
        <StatChip icon={<Swords className="h-4 w-4" />} value={stats.tournaments} label="Tornei" />
      </section>

      {podium.length > 0 && (
        <section>
          <SectionTitle
            icon={<Trophy className="h-5 w-5" />}
            title="Podio"
            href="/classifica"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {podium.map((row, i) => (
              <Link
                key={row.player.id}
                href={`/giocatori/${row.player.slug}`}
                className="card-surface group flex items-center gap-3 p-4 transition hover:-translate-y-0.5"
                style={{ animation: `var(--animate-fade-up)`, animationDelay: `${i * 80}ms` }}
              >
                <span className="font-display text-2xl">{["🥇", "🥈", "🥉"][i]}</span>
                <Avatar name={row.player.name} colorIndex={row.player.avatarColor} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:text-brand">
                    {row.player.name}
                  </p>
                  <p className="text-xs text-muted">{row.won}V · {row.lost}S</p>
                </div>
                <Badge tone="gold">{row.elo}</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle
          icon={<Flame className="h-5 w-5" />}
          title="Ultime partite"
          href="/partite"
        />
        {recent.length === 0 ? (
          <EmptyState
            icon={<Flame className="h-6 w-6" />}
            title="Ancora nessuna partita"
            description="Quando l'admin registra i primi risultati, appariranno qui."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Hero({ isAdmin, loggedIn }: { isAdmin: boolean; loggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-gradient-to-br from-surface to-surface-2 p-6 sm:p-10">
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand), transparent 70%)" }}
      />
      <div className="pointer-events-none absolute right-8 top-8 text-5xl animate-float">⚽</div>
      <div className="relative max-w-lg">
        <Badge tone="ball" className="mb-3">🏖️ Rimini Beach Sport</Badge>
        <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Il campo digitale del <span className="text-gradient">tavolino</span>
        </h1>
        <p className="mt-3 text-sm text-muted sm:text-base">
          Segna le partite, scala la classifica Elo, sblocca livelli e organizza
          tornei. Il nostro gioco, come si sfida sulla spiaggia di Rimini.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {isAdmin && (
            <Button asChild>
              <Link href="/partite/nuova">
                <Plus className="h-4 w-4" /> Nuova partita
              </Link>
            </Button>
          )}
          {!loggedIn && (
            <Button asChild>
              <Link href="/register">
                Crea il tuo profilo <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link href="/classifica">
              <Trophy className="h-4 w-4" /> Classifica
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function StatChip({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="card-surface flex flex-col items-center gap-1 p-4 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
        {icon}
      </span>
      <span className="font-display text-2xl font-extrabold tabular-nums">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-xl font-extrabold tracking-tight">
        <span className="text-brand">{icon}</span>
        {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-brand"
        >
          Tutti <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
