import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getRanking } from "@/lib/stats";
import { getPlayStyle } from "@/lib/gamification";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giocatori" };

export default async function GiocatoriPage() {
  const rows = await safe(() => getRanking("overall"), []);

  return (
    <div>
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Giocatori"
        subtitle={`${rows.length} profili registrati`}
        help="giocatori"
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nessun giocatore"
          description="Invita i tuoi amici a registrarsi per popolare la rosa."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const style = getPlayStyle(row.player.playStyle);
            return (
              <Link
                key={row.player.id}
                href={`/giocatori/${row.player.slug}`}
                className="card-surface group flex items-center gap-3 p-4 transition hover:-translate-y-0.5"
              >
                <Avatar name={row.player.name} colorIndex={row.player.avatarColor} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:text-brand">
                    {row.player.name}
                  </p>
                  {style ? (
                    <p className="truncate text-xs text-muted">
                      {style.emoji} {style.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">{row.played} partite</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{row.elo} Elo</Badge>
                    <Badge tone="ball">Lv {row.level}</Badge>
                    <span className="text-xs text-muted">{row.won}V·{row.lost}S</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
