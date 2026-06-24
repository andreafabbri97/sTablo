import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus, Clock, QrCode } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { MatchExplorer } from "@/components/match-explorer";
import { MatchConfirmActions } from "@/components/match-confirm-actions";
import { getAllMatches, getPendingMatches } from "@/lib/queries";
import { canConfirmMatch } from "@/lib/match-perms";
import { getCurrentUser } from "@/lib/auth-helpers";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partite" };

export default async function PartitePage() {
  const [matches, pending, user] = await Promise.all([
    safe(() => getAllMatches(), []),
    safe(() => getPendingMatches(), []),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";
  const viewer = user ? { playerId: user.playerId, role: user.role } : null;

  return (
    <div>
      <PageHeader
        icon={<ListChecks className="h-6 w-6" />}
        title="Partite"
        subtitle={`${matches.length} partite registrate`}
        action={
          user && (
            <Button asChild size="sm">
              <Link href="/partite/nuova">
                <Plus className="h-4 w-4" /> Nuova
              </Link>
            </Button>
          )
        }
        help="partite"
      />

      {pending.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
            <Clock className="h-4 w-4 text-brand" /> Da confermare ({pending.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pending.map((m) => (
              <div key={m.id} className="space-y-2">
                <MatchCard match={m} />
                {canConfirmMatch(m, viewer) ? (
                  <MatchConfirmActions matchId={m.id} />
                ) : (
                  <Link
                    href={`/partite/${m.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-muted hover:text-brand"
                  >
                    <QrCode className="h-3.5 w-3.5" /> Apri / QR per conferma
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {matches.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title="Nessuna partita confermata"
          description={
            user
              ? "Inserisci una partita: l'avversario la conferma e finisce in classifica."
              : "Accedi per inserire le tue partite."
          }
          action={
            user && (
              <Button asChild className="mt-2">
                <Link href="/partite/nuova">
                  <Plus className="h-4 w-4" /> Nuova partita
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <MatchExplorer matches={matches} isAdmin={isAdmin} />
      )}
    </div>
  );
}
