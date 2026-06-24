import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { getAllMatches } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth-helpers";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partite" };

export default async function PartitePage() {
  const [matches, user] = await Promise.all([
    safe(() => getAllMatches(), []),
    getCurrentUser(),
  ]);
  const isAdmin = user?.role === "admin";

  return (
    <div>
      <PageHeader
        icon={<ListChecks className="h-6 w-6" />}
        title="Partite"
        subtitle={`${matches.length} partite registrate`}
        action={
          isAdmin && (
            <Button asChild size="sm">
              <Link href="/partite/nuova">
                <Plus className="h-4 w-4" /> Nuova
              </Link>
            </Button>
          )
        }
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-6 w-6" />}
          title="Nessuna partita"
          description={
            isAdmin
              ? "Registra la prima partita per avviare le classifiche."
              : "L'admin non ha ancora registrato partite."
          }
          action={
            isAdmin && (
              <Button asChild className="mt-2">
                <Link href="/partite/nuova">
                  <Plus className="h-4 w-4" /> Registra partita
                </Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => (
            <div key={m.id} className="space-y-1">
              <MatchCard match={m} />
              {isAdmin && (
                <div className="flex justify-end px-1">
                  <DeleteMatchButton matchId={m.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
