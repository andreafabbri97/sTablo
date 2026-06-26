import type { Metadata } from "next";
import Link from "next/link";
import { Swords, Plus, Trophy } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import {
  TournamentsExplorer,
  type TournamentCardData,
} from "@/components/tournaments-explorer";
import { getTournaments, FORMAT_META, DISCIPLINE_LABEL } from "@/lib/tournament/queries";
import { getAccessiblePrivateTournamentIds } from "@/lib/tournament/invites";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriendTournamentIds } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tornei" };

const STATUS: Record<string, { label: string; tone: "win" | "brand" | "muted" | "ball" }> = {
  active: { label: "In corso", tone: "win" },
  completed: { label: "Concluso", tone: "muted" },
  draft: { label: "⏳ In attesa", tone: "ball" },
};

export default async function TorneiPage() {
  const [all, user] = await Promise.all([
    safe(() => getTournaments(), []),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";

  // Private tournaments stay hidden unless you created, were invited to, or
  // already joined them. The friend set powers the «Solo amici» toggle.
  const [accessiblePrivate, friendTournamentIds] = await Promise.all([
    safe(() => getAccessiblePrivateTournamentIds(user), new Set<string>()),
    user
      ? safe(() => getFriendTournamentIds(user.id), new Set<string>())
      : Promise.resolve(new Set<string>()),
  ]);
  const list = all.filter(
    (t) => t.visibility !== "private" || isAdmin || accessiblePrivate.has(t.id),
  );

  const cards: TournamentCardData[] = list.map((t) => {
    const meta = FORMAT_META[t.format];
    const status = STATUS[t.status] ?? STATUS.draft;
    return {
      id: t.id,
      slug: t.slug,
      name: t.name,
      formatEmoji: meta?.emoji ?? "🎯",
      formatLabel: meta?.label ?? t.format,
      disciplineLabel: DISCIPLINE_LABEL[t.discipline] ?? t.discipline,
      entrantCount: t.entrantCount,
      statusLabel: status.label,
      statusTone: status.tone,
      isPrivate: t.visibility === "private",
      showWinner: t.status === "completed" && !!t.winnerEntrantId,
      hasFriend: friendTournamentIds.has(t.id),
    };
  });
  const canFilterFriends = friendTournamentIds.size > 0;

  return (
    <div>
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Tornei"
        subtitle="Campionati, gironi e tabelloni"
        action={
          <>
            <Button asChild size="sm" variant="secondary">
              <Link href="/tornei/albo">
                <Trophy className="h-4 w-4" /> Albo d&apos;oro
              </Link>
            </Button>
            {user && (
              <Button asChild size="sm">
                <Link href="/tornei/nuovo">
                  <Plus className="h-4 w-4" /> Crea torneo
                </Link>
              </Button>
            )}
          </>
        }
        help="tornei"
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title="Nessun torneo"
          description={
            isAdmin
              ? "Crea il primo torneo: campionato, eliminazione, gironi o svizzero."
              : "L'admin non ha ancora creato tornei."
          }
          action={
            isAdmin && (
              <Button asChild className="mt-2">
                <Link href="/tornei/nuovo">
                  <Plus className="h-4 w-4" /> Crea torneo
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <TournamentsExplorer
          tournaments={cards}
          canFilterFriends={canFilterFriends}
        />
      )}
    </div>
  );
}
