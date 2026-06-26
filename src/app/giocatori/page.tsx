import type { Metadata } from "next";
import { Users } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { PlayersGrid, type PlayerCardData } from "@/components/player/players-grid";
import { getRanking } from "@/lib/stats";
import { getAdminPlayerIds } from "@/lib/roles";
import { DATA_TAG } from "@/lib/cache";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Giocatori" };

export default function GiocatoriPage() {
  return <GiocatoriContent />;
}

/**
 * Cached, global view of the roster — no per-user data — so it's baked into the
 * route's static shell and paints instantly on navigation. The personal «friend»
 * overlay (Amico badges + Tutti/Amici/Altri filter) is loaded client-side inside
 * <PlayersGrid>, so it hydrates a beat later without holding back the list.
 * Invalidated by bustDataCache() (revalidateTag on DATA_TAG) when data changes.
 */
async function GiocatoriContent() {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const [rows, adminIds] = await Promise.all([
    safe(() => getRanking("overall"), []),
    safe(() => getAdminPlayerIds(), new Set<string>()),
  ]);

  const players: PlayerCardData[] = rows.map((row) => ({
    id: row.player.id,
    name: row.player.name,
    username: row.username,
    slug: row.player.slug,
    avatarColor: row.player.avatarColor,
    avatarUrl: row.player.avatarUrl,
    playStyle: row.player.playStyle,
    played: row.played,
    elo: row.elo,
    level: row.level,
    won: row.won,
    lost: row.lost,
    isAdmin: adminIds.has(row.player.id),
    // isFriend is resolved client-side in <PlayersGrid> (per-viewer).
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
