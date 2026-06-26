import type { Metadata } from "next";
import { Users } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { PlayersGrid, type PlayerCardData } from "@/components/player/players-grid";
import { getRanking } from "@/lib/stats";
import { getPlayerUsernames } from "@/lib/queries";
import { getAdminPlayerIds } from "@/lib/roles";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Giocatori" };

export default async function GiocatoriPage() {
  // Everything fires together; friends chains off the resolved user so it still
  // runs in parallel with the (heavier) ranking/admin queries.
  const [rows, adminIds, friends, usernames] = await Promise.all([
    safe(() => getRanking("overall"), []),
    safe(() => getAdminPlayerIds(), new Set<string>()),
    getCurrentUser().then((u) => (u ? safe(() => getFriends(u.id), []) : [])),
    safe(() => getPlayerUsernames(), []),
  ]);
  // Map player id → @username (linked account). Covers inactive players too,
  // since the ranking lists them — hence a dedicated query, not the
  // active-only picker one.
  const usernameById = new Map(
    usernames.map((p) => [p.id, p.username] as const),
  );
  // Friend player slugs so each card can flag who you already know and the
  // Amici filter has something to split on.
  const friendSlugs = new Set(
    friends.map((f) => f.slug).filter((s): s is string => Boolean(s)),
  );

  const players: PlayerCardData[] = rows.map((row) => ({
    id: row.player.id,
    name: row.player.name,
    username: usernameById.get(row.player.id) ?? null,
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
    isFriend: friendSlugs.has(row.player.slug),
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
