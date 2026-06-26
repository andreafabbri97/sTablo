import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/ui/skeletons";
import { Card } from "@/components/ui/card";
import { MatchForm } from "@/components/admin/match-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerMatchOptions } from "@/lib/queries";
import { getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Nuova partita" };

export default function NuovaPartitaPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense
        fallback={
          <>
            <PageHeaderSkeleton />
            <PanelSkeleton />
          </>
        }
      >
        <NuovaPartitaContent />
      </Suspense>
    </div>
  );
}

async function NuovaPartitaContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/partite/nuova");

  const isAdmin = user.role === "admin";
  const [rawPlayers, friends] = await Promise.all([
    getPlayerMatchOptions(),
    safe(() => getFriends(user.id), []),
  ]);
  // Flag accepted friends so the picker can offer the «Tutti / Amici / Altri»
  // split (matched by slug, like every other friend-aware list).
  const friendSlugs = new Set(
    friends.map((f) => f.slug).filter((s): s is string => Boolean(s)),
  );
  const players = rawPlayers.map((p) => ({
    ...p,
    isFriend: friendSlugs.has(p.slug),
  }));

  return (
    <>
      <PageHeader
        icon={<Plus className="h-6 w-6" />}
        title="Nuova partita"
        subtitle={
          isAdmin
            ? "Registra il risultato e aggiorna le classifiche"
            : "Inserisci il risultato: l'avversario dovrà confermarlo"
        }
        help="nuova-partita"
      />
      <Card>
        <MatchForm
          players={players}
          isAdmin={isAdmin}
          currentPlayerId={user.playerId ?? undefined}
        />
      </Card>
    </>
  );
}
