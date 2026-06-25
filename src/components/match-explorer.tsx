"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, X, Loader2, ChevronDown, Users } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { DeleteMatchButton } from "@/components/admin/delete-match-button";
import { EmptyState } from "@/components/ui/page";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { loadMoreMatches } from "@/lib/actions/match-feed-actions";
import { matchInvolvesAnySlug } from "@/lib/match-filter";
import type { ShapedMatch } from "@/lib/queries";

const PAGE_SIZE = 200;

function dedupeById(list: ShapedMatch[]): ShapedMatch[] {
  const seen = new Set<string>();
  const out: ShapedMatch[] = [];
  for (const m of list) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

type Format = "all" | "singles" | "doubles";

const FORMATS: { key: Format; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "singles", label: "1 vs 1" },
  { key: "doubles", label: "2 vs 2" },
];

export function MatchExplorer({
  matches,
  isAdmin,
  totalCount,
  friendSlugs,
}: {
  matches: ShapedMatch[];
  isAdmin: boolean;
  /** Total completed matches in the DB; when it exceeds the loaded window we
   *  show a note so the count discrepancy is never confusing. */
  totalCount?: number;
  /** The viewer's circle (themselves + accepted friends) as player slugs. When
   *  present and non-empty, the «Solo amici» toggle is shown. Undefined for
   *  signed-out visitors or users with no friends yet. */
  friendSlugs?: string[];
}) {
  const [format, setFormat] = useState<Format>("all");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [friendsOnly, setFriendsOnly] = useState(false);
  const canFilterFriends = !!friendSlugs && friendSlugs.length > 0;
  const friendSet = useMemo(() => new Set(friendSlugs ?? []), [friendSlugs]);
  // Older pages fetched via "carica altre". Kept separate from the `matches`
  // prop so that when the page refreshes (e.g. after a new match) the freshest
  // window always wins and the extra history we already pulled isn't lost.
  const [extra, setExtra] = useState<ShapedMatch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, startLoading] = useTransition();

  const all = useMemo(
    () => dedupeById([...matches, ...extra]),
    [matches, extra],
  );

  const hasMore =
    typeof totalCount === "number" && all.length < totalCount;

  function handleLoadMore() {
    setLoadError(null);
    startLoading(async () => {
      try {
        const next = await loadMoreMatches(all.length, PAGE_SIZE);
        if (next.length === 0) return;
        setExtra((prev) => dedupeById([...prev, ...next]));
      } catch {
        setLoadError("Impossibile caricare altre partite. Riprova.");
      }
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;

    return all.filter((m) => {
      if (format !== "all" && m.format !== format) return false;

      if (friendsOnly && canFilterFriends && !matchInvolvesAnySlug(m, friendSet))
        return false;

      const ts = new Date(m.playedAt).getTime();
      if (ts < fromTs || ts > toTs) return false;

      if (q) {
        const names = [...m.sideA.players, ...m.sideB.players]
          .flatMap((p) => [p.name, p.slug, p.username ?? ""])
          .concat([
            m.sideA.teamName ?? "",
            m.sideB.teamName ?? "",
            m.tournamentName ?? "",
          ])
          .join(" ")
          .toLowerCase();
        if (!names.includes(q)) return false;
      }
      return true;
    });
  }, [all, format, query, from, to, friendsOnly, canFilterFriends, friendSet]);

  const hasFilters = format !== "all" || query || from || to || friendsOnly;

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

        {/* Friends-only scope — only when the viewer has friends to filter by */}
        {canFilterFriends && (
          <button
            type="button"
            onClick={() => setFriendsOnly((v) => !v)}
            aria-pressed={friendsOnly}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition",
              friendsOnly
                ? "border-transparent bg-brand text-white"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Users className="h-4 w-4" />
            Solo amici
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca nome, username o torneo…"
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
                setFriendsOnly(false);
              }}
              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Azzera filtri
            </button>
          )}
        </div>
      </div>

      {typeof totalCount === "number" && totalCount > all.length && (
        <p className="px-1 text-xs text-muted">
          Caricate {all.length} partite su {totalCount}. Usa «Carica altre» per
          vedere lo storico più vecchio.
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title="Nessuna partita trovata"
          description={
            friendsOnly
              ? "Nessuna partita tra i tuoi amici qui. Disattiva «Solo amici» o usa «Carica altre» per cercare più indietro."
              : "Prova a cambiare i filtri."
          }
        />
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

      {hasMore && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-2 disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {loadingMore ? "Caricamento…" : "Carica altre"}
          </button>
          {loadError && <p className="text-xs text-loss">{loadError}</p>}
        </div>
      )}
    </div>
  );
}
