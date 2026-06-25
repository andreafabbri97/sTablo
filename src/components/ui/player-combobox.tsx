"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

/**
 * Single-select player picker with keyboard search. Built to scale to hundreds
 * (or thousands) of players: a native <select> listing them all is unusable at
 * that size, so the list opens in a panel with a search box and only the first
 * matches are rendered.
 *
 * `excludeIds` hides players already chosen elsewhere in the same form (e.g. the
 * other slots of a match) so you can't pick the same person twice.
 */
export function PlayerCombobox({
  players,
  value,
  onChange,
  excludeIds,
  placeholder = "Giocatore…",
}: {
  players: Option[];
  value?: string;
  onChange: (id: string) => void;
  excludeIds?: Set<string>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedName = players.find((p) => p.id === value)?.name ?? "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = players.filter(
      (p) =>
        // keep the current selection visible even if filtered out elsewhere
        p.id === value || !excludeIds?.has(p.id),
    );
    const matched = q
      ? list.filter((p) => p.name.toLowerCase().includes(q))
      : list;
    return matched.slice(0, 60);
  }, [players, query, value, excludeIds]);

  // Close on outside click.
  useEffect(() => {
    function onDocPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocPointer);
    return () => document.removeEventListener("mousedown", onDocPointer);
  }, []);

  // Focus the search box when the panel opens (programmatic, not autoFocus, to
  // avoid the a11y warning and to keep it scoped to the open transition).
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) choose(filtered[0].id);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3.5 text-left text-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]",
          selectedName ? "text-foreground" : "text-muted",
        )}
      >
        <span className="truncate">{selectedName || placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-lg)]">
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Cerca…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-2.5 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-xs text-muted">
                Nessun giocatore trovato
              </p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  className={cn(
                    "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2",
                    p.id === value && "bg-brand-soft font-semibold",
                  )}
                >
                  <span className="truncate">{p.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
