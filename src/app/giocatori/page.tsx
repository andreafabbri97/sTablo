import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { PlayersGrid, type PlayerCardData } from "@/components/player/players-grid";
import { getRanking } from "@/lib/stats";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giocatori" };

export default async function GiocatoriPage() {
  const rows = await safe(() => getRanking("overall"), []);

  const players: PlayerCardData[] = rows.map((row) => ({
    id: row.player.id,
    name: row.player.name,
    nickname: row.player.nickname,
    slug: row.player.slug,
    avatarColor: row.player.avatarColor,
    avatarUrl: row.player.avatarUrl,
    playStyle: row.player.playStyle,
    played: row.played,
    elo: row.elo,
    level: row.level,
    won: row.won,
    lost: row.lost,
  }));

  return (
    <div>
      <PageHeader
        icon={<Users className="h-6 w-6" />}
        title="Giocatori"
        subtitle={`${rows.length} profili registrati`}
        help="giocatori"
      />

      {players.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nessun giocatore"
          description="Invita i tuoi amici a registrarsi per popolare la rosa."
        />
      ) : (
        <PlayersGrid players={players} />
      )}
    </div>
  );
}
