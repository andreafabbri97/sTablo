"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/page";
import { cn, pct } from "@/lib/utils";
import type { RankRow } from "@/lib/stats";

type TeamRow = {
  id: string;
  name: string;
  avatarColor: number;
  eloDoubles: number;
};

type Tab = "overall" | "singles" | "doubles" | "teams";

const TABS: { key: Tab; label: string }[] = [
  { key: "overall", label: "Generale" },
  { key: "singles", label: "Singolo" },
  { key: "doubles", label: "Doppio" },
  { key: "teams", label: "Team" },
];

export function ClassificaView({
  overall,
  singles,
  doubles,
  teams,
}: {
  overall: RankRow[];
  singles: RankRow[];
  doubles: RankRow[];
  teams: TeamRow[];
}) {
  const [tab, setTab] = useState<Tab>("overall");
  const rows = tab === "singles" ? singles : tab === "doubles" ? doubles : overall;
  const players = rows.filter((r) => r.played > 0);

  return (
    <div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-center text-sm font-semibold transition",
              tab === t.key
                ? "bg-brand text-white shadow-[var(--shadow-brand)]"
                : "text-muted hover:bg-surface-2",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "teams" ? (
        teams.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title="Nessun team"
            description="Crea dei team (coppie con alias) per vedere la classifica a squadre."
          />
        ) : (
          <div className="space-y-2 animate-fade-up">
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
        )
      ) : players.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title="Classifica vuota"
          description="Servono partite giocate per popolare il ranking."
        />
      ) : (
        <div className="space-y-2 animate-fade-up">
          {players.map((row, i) => (
            <Link
              key={row.player.id}
              href={`/giocatori/${row.player.slug}`}
              className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
            >
              <RankBadge rank={i + 1} />
              <Avatar name={row.player.name} colorIndex={row.player.avatarColor} imageUrl={row.player.avatarUrl} size="sm" />
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
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = ["🥇", "🥈", "🥉"][rank - 1];
  if (medal) return <span className="w-8 text-center text-xl">{medal}</span>;
  return (
    <span className="w-8 text-center font-display text-sm font-bold text-muted">
      {rank}
    </span>
  );
}
