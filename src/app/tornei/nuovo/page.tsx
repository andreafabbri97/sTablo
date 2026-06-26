import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/ui/skeletons";
import { Card } from "@/components/ui/card";
import { TournamentCreateSwitch } from "@/components/admin/tournament-create-switch";
import { TournamentOpenForm } from "@/components/tournament-open-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerOptions } from "@/lib/queries";
import { getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Nuovo torneo" };

export default function NuovoTorneoPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl space-y-6">
          <PageHeaderSkeleton />
          <PanelSkeleton />
        </div>
      }
    >
      <NuovoTorneoContent />
    </Suspense>
  );
}

async function NuovoTorneoContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/tornei/nuovo");

  const isAdmin = user.role === "admin";

  if (isAdmin) {
    const [rawOptions, friends] = await Promise.all([
      getPlayerOptions(),
      safe(() => getFriends(user.id), []),
    ]);
    // Flag accepted friends so the participant/pair pickers can offer the
    // «Tutti / Amici / Altri» split (matched by slug, like every other list).
    const friendSlugs = new Set(
      friends.map((f) => f.slug).filter((s): s is string => Boolean(s)),
    );
    const playerOptions = rawOptions.map((p) => ({
      ...p,
      isFriend: friendSlugs.has(p.slug),
    }));
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          icon={<Swords className="h-6 w-6" />}
          title="Nuovo torneo"
          subtitle="Scegli tu i partecipanti, oppure invito aperto con link/QR"
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
