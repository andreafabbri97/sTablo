import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { TournamentCreateSwitch } from "@/components/admin/tournament-create-switch";
import { TournamentOpenForm } from "@/components/tournament-open-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerOptions } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuovo torneo" };

export default async function NuovoTorneoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/tornei/nuovo");

  const isAdmin = user.role === "admin";

  if (isAdmin) {
    const playerOptions = await getPlayerOptions();
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          icon={<Swords className="h-6 w-6" />}
          title="Nuovo torneo"
          subtitle="Invito aperto con link/QR, oppure scegli tu i partecipanti"
          help="nuovo-torneo"
        />
        <Card>
          <TournamentCreateSwitch players={playerOptions} />
        </Card>
      </div>
    );
  }

  // Players: open tournament with invite link
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Nuovo torneo"
        subtitle="Crea il torneo e invita gli amici col link o QR"
        help="nuovo-torneo"
      />
      <Card>
        <TournamentOpenForm />
      </Card>
    </div>
  );
}
