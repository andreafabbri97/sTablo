import { Suspense } from "react";
import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { TabbedListSkeleton } from "@/components/ui/skeletons";
import { ClassificaView } from "@/components/classifica-view";
import { getRanking, getTeamRanking } from "@/lib/stats";
import { getSeasonStandings, seasonForDate } from "@/lib/seasons";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";
import { connection } from "next/server";

export const metadata: Metadata = { title: "Classifica" };

export default function ClassificaPage() {
  return (
    <div>
      {/* Static shell — paints instantly on navigation. */}
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica"
        subtitle="Ranking in base all'Elo"
        help="classifica"
      />
      {/* Rankings depend on the DB + the viewer's friends → stream at request time. */}
      <Suspense fallback={<TabbedListSkeleton />}>
        <ClassificaBoard />
      </Suspense>
    </div>
  );
}

async function ClassificaBoard() {
  // Opt into request-time rendering before reading the clock: under Cache
  // Components, `new Date()` must follow a dynamic-data access.
  await connection();
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
    <ClassificaView
      overall={overall}
      singles={singles}
      doubles={doubles}
      teams={teams}
      season={seasonRows}
      seasonLabel={season.label}
      friendSlugs={friendSlugs}
    />
  );
}
