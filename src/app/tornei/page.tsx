import type { Metadata } from "next";
import Link from "next/link";
import { Swords, Plus, Trophy } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTournaments, FORMAT_META, DISCIPLINE_LABEL } from "@/lib/tournament/queries";
import { getAccessiblePrivateTournamentIds } from "@/lib/tournament/invites";
import { getCurrentUser } from "@/lib/auth-helpers";
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
  // already joined them.
  const accessiblePrivate = await safe(
    () => getAccessiblePrivateTournamentIds(user),
    new Set<string>(),
  );
  const list = all.filter(
    (t) => t.visibility !== "private" || isAdmin || accessiblePrivate.has(t.id),
  );

  return (
    <div>
      <PageHeader
        icon={<Swords className="h-6 w-6" />}
        title="Tornei"
        subtitle="Campionati, gironi e tabelloni"
        action={
          user && (
            <Button asChild size="sm">
              <Link href="/tornei/nuovo">
                <Plus className="h-4 w-4" /> Crea torneo
              </Link>
            </Button>
          )
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
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((t) => {
            const meta = FORMAT_META[t.format];
            const status = STATUS[t.status] ?? STATUS.draft;
            return (
              <Link
                key={t.id}
                href={`/tornei/${t.slug}`}
                className="card-surface group p-5 transition hover:-translate-y-0.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-3xl">{meta?.emoji}</span>
                  <div className="flex items-center gap-1.5">
                    {t.visibility === "private" && (
                      <Badge tone="muted">🔒 Privato</Badge>
                    )}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
                <h3 className="font-display text-lg font-extrabold group-hover:text-brand">
                  {t.name}
                </h3>
                <p className="text-sm text-muted">
                  {meta?.label} · {DISCIPLINE_LABEL[t.discipline]} · {t.entrantCount} iscritti
                </p>
                {t.status === "completed" && t.winnerEntrantId && (
                  <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">
                    <Trophy className="h-4 w-4" /> Vincitore decretato
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
