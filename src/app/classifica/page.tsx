import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { ClassificaView } from "@/components/classifica-view";
import { getRanking, getTeamRanking } from "@/lib/stats";
import { getSeasonStandings, seasonForDate } from "@/lib/seasons";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Classifica" };

export default async function ClassificaPage() {
  const season = seasonForDate(new Date());
  const [overall, singles, doubles, teams, seasonRows] = await Promise.all([
    safe(() => getRanking("overall"), []),
    safe(() => getRanking("singles"), []),
    safe(() => getRanking("doubles"), []),
    safe(() => getTeamRanking(), []),
    safe(() => getSeasonStandings(season.start, season.end), []),
  ]);

  return (
    <div>
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica"
        subtitle="Ranking Elo del tavolino"
        help="classifica"
      />
      <ClassificaView
        overall={overall}
        singles={singles}
        doubles={doubles}
        teams={teams}
        season={seasonRows}
        seasonLabel={season.label}
      />
    </div>
  );
}
