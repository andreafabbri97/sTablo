import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { TournamentForm } from "@/components/admin/tournament-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerOptions, getTeamOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuovo torneo" };

export default async function NuovoTorneoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/tornei/nuovo");
  if (user.role !== "admin") redirect("/tornei");

  const [players, teams] = await Promise.all([
    getPlayerOptions(),
    getTeamOptions(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Nuovo torneo"
        subtitle="Scegli formato, disciplina e partecipanti"
      />
      <Card>
        <TournamentForm players={players} teams={teams} />
      </Card>
    </div>
  );
}
