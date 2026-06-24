import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { MatchForm } from "@/components/admin/match-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerOptions, getTeamOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuova partita" };

export default async function NuovaPartitaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/partite/nuova");

  const isAdmin = user.role === "admin";
  const [players, teams] = await Promise.all([
    getPlayerOptions(),
    getTeamOptions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={<Plus className="h-6 w-6" />}
        title="Nuova partita"
        subtitle={
          isAdmin
            ? "Registra il risultato e aggiorna le classifiche"
            : "Inserisci il risultato: l'avversario dovrà confermarlo"
        }
      />
      <Card>
        <MatchForm
          players={players}
          teams={teams}
          isAdmin={isAdmin}
          currentPlayerId={user.playerId ?? undefined}
        />
      </Card>
    </div>
  );
}
