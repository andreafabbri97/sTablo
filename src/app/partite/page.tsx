import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus, Clock, QrCode, Swords, CalendarClock, ShieldAlert } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { PageHeaderSkeleton, RowsSkeleton } from "@/components/ui/skeletons";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { MatchExplorer } from "@/components/match-explorer";
import { MatchConfirmActions } from "@/components/match-confirm-actions";
import {
  getAllMatches,
  getMatchesCount,
  getPendingMatches,
  getScheduledMatches,
} from "@/lib/queries";
import { canConfirmMatch } from "@/lib/match-perms";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriendFeedSlugs } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Partite" };

/** Most-recent matches loaded for the explorer; older ones stay in the DB. */
const MATCHES_WINDOW = 500;

export default function PartitePage() {
  // The header's action + subtitle depend on the viewer and on counts, so the
  // whole page streams behind a header+list skeleton.
  return (
    <Suspense
      fallback={
        <div>
          <PageHeaderSkeleton />
          <RowsSkeleton rows={6} />
        </div>
      }
    >
      <PartiteContent />
    </Suspense>
  );
}

async function PartiteContent() {
  const [matches, total, pending, scheduled, user] = await Promise.all([
    safe(() => getAllMatches(MATCHES_WINDOW), []),
    safe(() => getMatchesCount(), 0),
    safe(() => getPendingMatches(), []),
    safe(() => getScheduledMatches(), []),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";
  const viewer = user ? { playerId: user.playerId, role: user.role } : null;
  // The viewer's circle (self + friends) as slugs, to power the «Solo amici»
  // feed toggle. Empty for signed-out visitors or users with no friends yet.
  const friendSlugs = user
    ? await safe(() => getFriendFeedSlugs(user.id), [])
    : [];

  return (
    <div>
      <PageHeader
        icon={<ListChecks className="h-6 w-6" />}
        title="Partite"
        subtitle={`${total} partite registrate`}
        action={
          user && (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/partite/programma">
                  <Swords className="h-4 w-4" /> Programma
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/partite/nuova">
                  <Plus className="h-4 w-4" /> Nuova
                </Link>
              </Button>
            </div>
          )
        }
        help="partite"
      />

      {scheduled.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
            <CalendarClock className="h-4 w-4 text-brand" /> Prossime sfide ({scheduled.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {scheduled.map((m) => (
              <div key={m.id} className="space-y-2">
                <MatchCard match={m} />
                <Link
                  href={`/partite/${m.id}`}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-semibold text-muted hover:text-brand"
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Apri sfida / registra risultato
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

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
                  <MatchConfirmActions
                    matchId={m.id}
                    disputed={!!m.disputedAt}
                    disputeReason={m.disputeReason}
                  />
                ) : m.disputedAt ? (
                  <Link
                    href={`/partite/${m.id}`}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 py-2 text-xs font-semibold text-gold"
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Conteso · in verifica
                  </Link>
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
        <MatchExplorer
          matches={matches}
          isAdmin={isAdmin}
          totalCount={total}
          friendSlugs={friendSlugs.length ? friendSlugs : undefined}
        />
      )}
    </div>
  );
}
