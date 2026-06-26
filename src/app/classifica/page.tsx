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
import { getPlayerSlugById } from "@/lib/queries";
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
  const [overall, singles, doubles, teams, seasonRows, circle] =
    await Promise.all([
      safe(() => getRanking("overall"), []),
      safe(() => getRanking("singles"), []),
      safe(() => getRanking("doubles"), []),
      safe(() => getTeamRanking(), []),
      safe(() => getSeasonStandings(season.start, season.end), []),
      getCurrentUser().then(async (u) => {
        if (!u) return { friendSlugs: [] as string[], selfSlug: null as string | null };
        const [friends, selfSlug] = await Promise.all([
          safe(() => getFriends(u.id), []),
          u.playerId
            ? safe(() => getPlayerSlugById(u.playerId as string), null)
            : Promise.resolve(null),
        ]);
        return {
          // Friend player slugs so the «Tutti / Amici / Altri» filter has
          // something to split each board on (matched by player.slug).
          friendSlugs: friends
            .map((f) => f.slug)
            .filter((s): s is string => Boolean(s)),
          // The viewer's own slug: in the Classifica the «Amici» scope must
          // include YOU — you want the Elo ranking of your circle, yourself
          // included. (The players list, by contrast, only lists others.)
          selfSlug,
        };
      }),
    ]);

  const { friendSlugs, selfSlug } = circle;

  return (
    <ClassificaView
      overall={overall}
      singles={singles}
      doubles={doubles}
      teams={teams}
      season={seasonRows}
      seasonLabel={season.label}
      friendSlugs={friendSlugs}
      selfSlug={selfSlug}
    />
  );
}
