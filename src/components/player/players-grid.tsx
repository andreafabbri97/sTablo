"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/page";
import { getPlayStyle } from "@/lib/gamification";

export type PlayerCardData = {
  id: string;
  name: string;
  nickname: string | null;
  slug: string;
  avatarColor: number;
  avatarUrl: string | null;
  playStyle: string | null;
  played: number;
  elo: number;
  level: number;
  won: number;
  lost: number;
};

/** Accent- and case-insensitive normalization so "andrè" matches "andre". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function PlayersGrid({ players }: { players: PlayerCardData[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return players;
    return players.filter((p) => {
      const hay = normalize(`${p.name} ${p.nickname ?? ""}`);
      return hay.includes(q);
    });
  }, [players, query]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca giocatore…"
          aria-label="Cerca giocatore"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Azzera ricerca"
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nessun giocatore trovato"
          description="Prova con un altro nome."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const style = getPlayStyle(p.playStyle);
            return (
              <Link
                key={p.id}
                href={`/giocatori/${p.slug}`}
                className="card-surface group flex items-center gap-3 p-4 transition hover:-translate-y-0.5"
              >
                <Avatar
                  name={p.name}
                  colorIndex={p.avatarColor}
                  imageUrl={p.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:text-brand">
                    {p.name}
                  </p>
                  {style ? (
                    <p className="truncate text-xs text-muted">
                      {style.emoji} {style.name}
                    </p>
                  ) : (
                    <p className="text-xs text-muted">{p.played} partite</p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone="brand">{p.elo} Elo</Badge>
                    <Badge tone="ball">Lv {p.level}</Badge>
                    <span className="text-xs text-muted">
                      {p.won}V·{p.lost}S
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
