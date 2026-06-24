import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserCog, ExternalLink, Mail } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FifaCard } from "@/components/player/fifa-card";
import { ProfileForm } from "@/components/player/profile-form";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getPlayerWithStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Il mio profilo" };

export default async function ProfiloPage() {
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
      />

      {!user.email && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-brand bg-brand-soft p-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Mail className="h-5 w-5" />
          </span>
          <p className="text-sm">
            <span className="font-bold">Aggiungi la tua email</span> qui sotto: serve
            per recuperare l&apos;account se dimentichi la password.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-4">
          <FifaCard
            player={data.player}
            overall={data.overall}
            attributes={data.attributes}
            level={data.level}
          />
          <p className="text-center text-xs text-muted">
            Anteprima della tua card
          </p>
        </div>
        <Card>
          <CardTitle className="mb-4">Modifica profilo</CardTitle>
          <ProfileForm
            player={data.player}
            username={user.username ?? ""}
            email={user.email ?? ""}
          />
        </Card>
      </div>
    </div>
  );
}
