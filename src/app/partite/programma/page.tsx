import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Swords } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { PageHeaderSkeleton, PanelSkeleton } from "@/components/ui/skeletons";
import { Card } from "@/components/ui/card";
import { ChallengeForm } from "@/components/admin/challenge-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerOptions } from "@/lib/queries";

export const metadata: Metadata = { title: "Programma una sfida" };

export default function ProgrammaSfidaPage() {
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
        <ProgrammaContent />
      </Suspense>
    </div>
  );
}

async function ProgrammaContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/partite/programma");

  const isAdmin = user.role === "admin";
  const players = await getPlayerOptions();

  return (
    <>
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Programma una sfida"
        subtitle="Fissa data e avversario: il risultato lo registri dopo aver giocato"
        help="programma"
      />
      <Card>
        <ChallengeForm
          players={players}
          isAdmin={isAdmin}
          currentPlayerId={user.playerId ?? undefined}
        />
      </Card>
    </>
  );
}
