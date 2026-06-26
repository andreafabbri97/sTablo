import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Swords, UserPlus, Users, Clock } from "lucide-react";
import { PanelSkeleton } from "@/components/ui/skeletons";
import { db } from "@/lib/db";
import { tournaments, tournamentEntrants } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-helpers";
import { joinTournament } from "@/lib/actions/tournament-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import Link from "next/link";

export const metadata: Metadata = { title: "Unisciti al torneo" };

async function JoinButton({ token }: { token: string }) {
  async function join() {
    "use server";
    const res = await joinTournament(token);
    if (res.ok && res.slug) redirect(`/tornei/${res.slug}`);
  }
  return (
    <form action={join}>
      <Button type="submit" size="lg" className="w-full">
        <UserPlus className="h-4 w-4" /> Iscriviti
      </Button>
    </form>
  );
}


export default function TorneoInvitoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm py-8">
          <PanelSkeleton className="h-72" />
        </div>
      }
    >
      <TorneoInvitoContent params={params} />
    </Suspense>
  );
}

async function TorneoInvitoContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await db.query.tournaments.findFirst({
    where: eq(tournaments.inviteToken, token),
  });

  if (!t || !t.openInvite) {
    return (
      <div className="mx-auto max-w-sm pt-20 text-center">
        <p className="text-2xl">🚫</p>
        <h1 className="mt-3 font-display text-xl font-extrabold">Link non valido</h1>
        <p className="mt-2 text-sm text-muted">Questo link di invito non esiste o non è più attivo.</p>
        <Button asChild className="mt-6"><Link href="/tornei">Vai ai tornei</Link></Button>
      </div>
    );
  }

  const user = await getCurrentUser();
  const entrants = await db
    .select()
    .from(tournamentEntrants)
    .where(eq(tournamentEntrants.tournamentId, t.id));

  const alreadyJoined =
    user?.playerId && entrants.some((e) => e.playerId === user.playerId);

  return (
    <div className="mx-auto max-w-sm space-y-5 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
          <Swords className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-extrabold">{t.name}</h1>
        <p className="mt-1 text-sm text-muted">
          {t.discipline === "singles" ? "Singolo" : t.discipline === "doubles" ? "Doppio" : "Team"} ·{" "}
          {t.config.ranked ? "🏆 Classificato" : "🤝 Amichevole"}
        </p>
        {t.description && (
          <p className="mt-2 text-sm">{t.description}</p>
        )}
      </div>

      <Card className="space-y-3">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Partecipanti ({entrants.length})
        </CardTitle>
        {entrants.length === 0 ? (
          <p className="text-sm text-muted">Ancora nessuno iscritto — sii il primo!</p>
        ) : (
          <ul className="space-y-2">
            {entrants.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <Avatar name={e.name} colorIndex={0} size="xs" />
                <span className="font-medium">{e.name}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {t.status !== "draft" ? (
        <Card className="text-center">
          <p className="flex items-center justify-center gap-2 font-semibold text-muted">
            <Clock className="h-4 w-4" />
            {t.status === "active" ? "Il torneo è già iniziato" : "Torneo completato"}
          </p>
          <Button asChild className="mt-3 w-full">
            <Link href={`/tornei/${t.slug}`}>Vedi il torneo</Link>
          </Button>
        </Card>
      ) : alreadyJoined ? (
        <Card className="text-center space-y-3">
          <p className="font-semibold text-win">✓ Sei già iscritto!</p>
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/tornei/${t.slug}`}>Vedi il torneo</Link>
          </Button>
        </Card>
      ) : user ? (
        <Card className="space-y-3">
          <JoinButton token={token} />
          <p className="text-center text-xs text-muted">
            Ti iscrivi come <strong>{user.name}</strong>
          </p>
        </Card>
      ) : (
        <Card className="space-y-3 text-center">
          <p className="text-sm text-muted">Accedi per iscriverti al torneo</p>
          <Button asChild className="w-full">
            <Link href={`/login?callbackUrl=/tornei/invito/${token}`}>Accedi</Link>
          </Button>
        </Card>
      )}
    </div>
  );
}
