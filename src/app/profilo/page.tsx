import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCog, ExternalLink, Mail, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/ui/skeletons";
import { Card, CardTitle, CardLabel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileEditor } from "@/components/player/profile-editor";
import { ChangePasswordForm } from "@/components/player/change-password-form";
import { BadgeShelf } from "@/components/player/badge-shelf";
import { EloChart } from "@/components/player/elo-chart";
import { PushToggle } from "@/components/push-toggle";
import { InstallAppCard } from "@/components/install-app-card";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerWithStats } from "@/lib/stats";
import { getEloSeries } from "@/lib/queries";
import { computeBadges } from "@/lib/badges";

export const metadata: Metadata = { title: "Il mio profilo" };

export default function ProfiloPage() {
  return (
    <Suspense
      fallback={
        <div>
          <PageHeaderSkeleton />
          <PanelSkeleton />
        </div>
      }
    >
      <ProfiloContent />
    </Suspense>
  );
}

async function ProfiloContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/profilo");
  if (!user.playerId) {
    return (
      <Card className="text-center">
        <CardTitle>Nessun profilo collegato</CardTitle>
        <p className="mt-2 text-sm text-muted">
          Contatta l&apos;amministratore per collegare il tuo account a un giocatore.
        </p>
      </Card>
    );
  }

  const data = await getPlayerWithStats(user.playerId);
  if (!data) redirect("/");

  const badges = computeBadges({
    played: data.stats.played,
    won: data.stats.won,
    winRate: data.stats.winRate,
    bestStreak: data.stats.bestStreak,
    currentStreak: data.stats.currentStreak,
    peakElo: data.player.peakElo,
    tournamentsWon: data.tournamentsWon,
    level: data.level.level,
  });

  const eloSeries = await getEloSeries(data.player.id, "player_singles");

  return (
    <div>
      <PageHeader
        icon={<UserCog className="h-6 w-6" />}
        title="Il mio profilo"
        subtitle="Personalizza la tua card e gestisci la privacy"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href={`/giocatori/${data.player.slug}`}>
              <ExternalLink className="h-4 w-4" /> Vedi pubblico
            </Link>
          </Button>
        }
        help="profilo"
      />

      {!user.email && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Mail className="h-5 w-5" />
          </span>
          <p className="text-sm">
            <span className="font-bold">Aggiungi la tua email</span> qui sotto: serve
            per ricontattarti. Se dimentichi la password, un amministratore può
            reimpostartela con una password temporanea.
          </p>
        </div>
      )}

      <ProfileEditor
        player={data.player}
        overall={data.overall}
        attributes={data.attributes}
        level={data.level}
        derived={data.derived}
        username={user.username ?? ""}
        email={user.email ?? ""}
      >
        <Card>
          <CardTitle className="mb-4">Sicurezza</CardTitle>
          <ChangePasswordForm />
        </Card>
        <InstallAppCard />
        <PushToggle />
      </ProfileEditor>

      {/* Andamento Elo — lo stesso grafico del profilo pubblico */}
      <Card className="mt-6">
        <CardLabel className="mb-1 flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5" /> Andamento Elo (singolo)
        </CardLabel>
        <EloChart data={eloSeries} />
      </Card>

      {/* Bacheca trofei — gli stessi badge mostrati sul profilo pubblico */}
      <div className="mt-6">
        <BadgeShelf badges={badges} ownerName={data.player.name} />
      </div>
    </div>
  );
}
