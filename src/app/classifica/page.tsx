import type { Metadata } from "next";
import { Trophy } from "lucide-react";
import { cacheLife, cacheTag } from "next/cache";
import { PageHeader } from "@/components/ui/page";
import { ClassificaView } from "@/components/classifica-view";
import { getRanking, getTeamRanking } from "@/lib/stats";
import { DATA_TAG } from "@/lib/cache";
import { safe } from "@/lib/safe";

export const metadata: Metadata = { title: "Classifica" };

export default function ClassificaPage() {
  return (
    <div>
      {/* Static header + cached rankings = instant shell. The date-dependent
          Stagione board and the viewer's friends load client-side in
          <ClassificaView> (see classificaOverlay). */}
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica"
        subtitle="Ranking in base all'Elo"
        help="classifica"
      />
      <ClassificaBoard />
    </div>
  );
}

async function ClassificaBoard() {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");
  const [overall, singles, doubles, teams] = await Promise.all([
    safe(() => getRanking("overall"), []),
    safe(() => getRanking("singles"), []),
    safe(() => getRanking("doubles"), []),
    safe(() => getTeamRanking(), []),
  ]);

  return (
    <ClassificaView
      overall={overall}
      singles={singles}
      doubles={doubles}
      teams={teams}
    />
  );
}
