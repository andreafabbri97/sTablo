import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { ClassificaView } from "@/components/classifica-view";
import { getRanking, getTeamRanking } from "@/lib/stats";
import { getSeasonStandings, seasonForDate } from "@/lib/seasons";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Classifica" };

export default async function ClassificaPage() {
  const season = seasonForDate(new Date());
  const [overall, singles, doubles, teams, seasonRows, friends] =
    await Promise.all([
      safe(() => getRanking("overall"), []),
      safe(() => getRanking("singles"), []),
      safe(() => getRanking("doubles"), []),
      safe(() => getTeamRanking(), []),
      safe(() => getSeasonStandings(season.start, season.end), []),
      getCurrentUser().then((u) => (u ? safe(() => getFriends(u.id), []) : [])),
    ]);

  // Friend player slugs so the «Tutti / Amici / Altri» filter has something to
  // split each board on (rows are matched by player.slug, like /giocatori).
  const friendSlugs = friends
    .map((f) => f.slug)
    .filter((s): s is string => Boolean(s));

  return (
    <div>
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica"
        subtitle="Ranking in base all'Elo"
        help="classifica"
      />
      <ClassificaView
        overall={overall}
        singles={singles}
        doubles={doubles}
        teams={teams}
        season={seasonRows}
        seasonLabel={season.label}
        friendSlugs={friendSlugs}
      />
    </div>
  );
}
