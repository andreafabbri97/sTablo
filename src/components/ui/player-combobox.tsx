"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Check, Users } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import {
  PlayerOptionLabel,
  type PlayerOption,
} from "@/components/ui/player-option-row";
import {
  ScopeTabs,
  FRIEND_SCOPE_OPTIONS,
  shouldShowScope,
  filterByScope,
  type FriendScope,
} from "@/components/scope-tabs";
import { cn } from "@/lib/utils";

export type { PlayerOption };

/**
 * Single-select player picker. Tapping the field opens a full modal with a
 * search box and avatar/username rows — far easier to scan and search than a
 * cramped dropdown, and it scales to dozens (or hundreds) of players.
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
  players: PlayerOption[];
  value?: string;
  onChange: (id: string) => void;
  excludeIds?: Set<string>;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<FriendScope>("all");

  const selected = players.find((p) => p.id === value);

  // The pool the picker can actually choose from (current selection stays
  // visible even if it's excluded by another slot).
  const selectable = useMemo(
    () => players.filter((p) => p.id === value || !excludeIds?.has(p.id)),
    [players, value, excludeIds],
  );
  const showScope = useMemo(() => shouldShowScope(selectable), [selectable]);
  const activeScope = showScope ? scope : "all";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scoped = filterByScope(selectable, activeScope);
    const matched = q
      ? scoped.filter((p) =>
          [p.name, p.username]
            .filter(Boolean)
            .some((s) => (s as string).toLowerCase().includes(q)),
        )
      : scoped;
    return matched.slice(0, 100);
  }, [selectable, query, activeScope]);

  function choose(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  function close() {
    setQuery("");
    setScope("all");
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 text-left text-sm transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-[var(--brand-soft)]",
          selected ? "text-foreground" : "text-muted",
        )}
      >
        {selected ? (
          <>
            <Avatar
              name={selected.name}
              colorIndex={selected.avatarColor ?? 0}
              imageUrl={selected.avatarUrl}
              size="xs"
            />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <Modal
        open={open}
        onClose={close}
        title="Scegli giocatore"
        icon={<Users className="h-5 w-5 text-brand" />}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca per nome o username…"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
            />
          </div>
          {showScope && (
            <ScopeTabs
              options={FRIEND_SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              ariaLabel="Filtra giocatori"
            />
          )}
          <div className="-mx-1 max-h-[55vh] space-y-1 overflow-y-auto px-1">
            {filtered.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-muted">
                Nessun giocatore trovato
              </p>
            ) : (
              filtered.map((p) => {
                const isSel = p.id === value;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choose(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                      isSel ? "bg-brand-soft" : "hover:bg-surface-2",
                    )}
                  >
                    <PlayerOptionLabel player={p} />
                    {isSel && (
                      <Check className="h-4 w-4 shrink-0 text-brand" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
