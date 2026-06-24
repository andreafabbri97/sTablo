import type { Metadata } from "next";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { getRanking, getTeamRanking, type RankingDiscipline } from "@/lib/stats";
import { safe } from "@/lib/safe";
import { cn, pct } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Classifica" };

const TABS = [
  { key: "overall", label: "Generale" },
  { key: "singles", label: "Singolo" },
  { key: "doubles", label: "Doppio" },
  { key: "teams", label: "Team" },
] as const;

export default async function ClassificaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const tab = (TABS.find((t) => t.key === d)?.key ?? "overall") as
    | RankingDiscipline
    | "teams";

  return (
    <div>
      <PageHeader
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica"
        subtitle="Ranking Elo del tavolino"
      />

      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/classifica?d=${t.key}`}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-semibold transition",
              tab === t.key
                ? "bg-brand text-white shadow-[var(--shadow-brand)]"
                : "text-muted hover:bg-surface-2",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === "teams" ? <TeamRanking /> : <PlayerRanking discipline={tab} />}
    </div>
  );
}

async function PlayerRanking({ discipline }: { discipline: RankingDiscipline }) {
  const rows = (await safe(() => getRanking(discipline), [])).filter(
    (r) => r.played > 0,
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-6 w-6" />}
        title="Classifica vuota"
        description="Servono partite giocate per popolare il ranking."
      />
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <Link
          key={row.player.id}
          href={`/giocatori/${row.player.slug}`}
          className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
        >
          <RankBadge rank={i + 1} />
          <Avatar name={row.player.name} colorIndex={row.player.avatarColor} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{row.player.name}</p>
            <p className="text-xs text-muted">
              Lv {row.level} · {row.won}V · {row.lost}S · {pct(row.won, row.played)}%
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono font-extrabold tabular-nums text-brand">{row.elo}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">Elo</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

async function TeamRanking() {
  const teams = await safe(() => getTeamRanking(), []);
  if (teams.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-6 w-6" />}
        title="Nessun team"
        description="Crea dei team (coppie con alias) per vedere la classifica a squadre."
      />
    );
  }
  return (
    <div className="space-y-2">
      {teams.map((team, i) => (
        <div key={team.id} className="card-surface flex items-center gap-3 p-3">
          <RankBadge rank={i + 1} />
          <Avatar name={team.name} colorIndex={team.avatarColor} size="sm" />
          <p className="min-w-0 flex-1 truncate font-bold">{team.name}</p>
          <div className="text-right">
            <p className="font-mono font-extrabold tabular-nums text-brand">{team.eloDoubles}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted">Elo team</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = ["🥇", "🥈", "🥉"][rank - 1];
  if (medal) {
    return <span className="w-8 text-center text-xl">{medal}</span>;
  }
  return (
    <span className="w-8 text-center font-display text-sm font-bold text-muted">
      {rank}
    </span>
  );
}
