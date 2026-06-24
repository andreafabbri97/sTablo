"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { EmptyState } from "@/components/ui/page";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import type { ShapedMatch } from "@/lib/queries";

type Format = "all" | "singles" | "doubles";

const FORMATS: { key: Format; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "singles", label: "1 vs 1" },
  { key: "doubles", label: "2 vs 2" },
];

export function MatchExplorer({
  matches,
  isAdmin,
}: {
  matches: ShapedMatch[];
  isAdmin: boolean;
}) {
  const [format, setFormat] = useState<Format>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;

    return matches.filter((m) => {
      if (format !== "all" && m.format !== format) return false;

      const ts = new Date(m.playedAt).getTime();
      if (ts < fromTs || ts > toTs) return false;

      if (q) {
        const names = [...m.sideA.players, ...m.sideB.players]
          .flatMap((p) => [p.name, p.slug])
          .concat([m.sideA.teamName ?? "", m.sideB.teamName ?? ""])
          .join(" ")
          .toLowerCase();
        if (!names.includes(q)) return false;
      }
      return true;
    });
  }, [matches, format, query, from, to]);

  const hasFilters = format !== "all" || query || from || to;

  return (
    <div className="space-y-4">
      <div className="card-surface space-y-3 p-3">
        {/* Format segmented */}
        <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1">
          {FORMATS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFormat(f.key)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                format === f.key ? "bg-brand text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca giocatore…"
            className="pl-9"
          />
        </div>

        {/* Dates — always on a single row */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              📅 Dal
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Dal giorno"
              className="w-full"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
              📅 Al
            </label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Al giorno"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-muted">
            {filtered.length} {filtered.length === 1 ? "partita" : "partite"}
          </span>
          {hasFilters && (
            <button
              onClick={() => {
                setFormat("all");
                setQuery("");
                setFrom("");
                setTo("");
              }}
              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Azzera filtri
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nessuna partita trovata" description="Prova a cambiare i filtri." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((m) => (
            <div key={m.id} className="space-y-1">
              <MatchCard match={m} />
              {isAdmin && (
                <div className="flex justify-end px-1">
                  <DeleteMatchButton matchId={m.id} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
