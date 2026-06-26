"use client";

import { cn } from "@/lib/utils";

/**
 * The friend-aware scope of a list. Extend with new groups — e.g. "club", once
 * teams become clubs — by adding a key here and one option wherever it's used;
 * the control itself never changes.
 */
export type FriendScope = "all" | "friends" | "others";

export type ScopeOption<T extends string> = { key: T; label: string };

/** The standard «Tutti / Amici / Altri» options, ready to spread into ScopeTabs. */
export const FRIEND_SCOPE_OPTIONS: readonly ScopeOption<FriendScope>[] = [
  { key: "all", label: "Tutti" },
  { key: "friends", label: "Amici" },
  { key: "others", label: "Altri" },
];

/**
 * The split only earns its space when both groups are non-empty — an
 * all-friends or no-friends list would just show a dead control.
 */
export function shouldShowScope(items: readonly { isFriend?: boolean }[]): boolean {
  const friends = items.filter((i) => i.isFriend).length;
  return friends > 0 && friends < items.length;
}

/** Narrow a list to the active friend scope. "all" is a no-op passthrough. */
export function filterByScope<T extends { isFriend?: boolean }>(
  items: T[],
  scope: FriendScope,
): T[] {
  if (scope === "all") return items;
  return items.filter((i) => (scope === "friends" ? !!i.isFriend : !i.isFriend));
}

/**
 * App-wide segmented control behind the «Tutti / Amici / Altri» scope filter,
 * rendered identically on every list (giocatori, nuova chat, partite, tornei).
 * Data-driven on purpose: a future "Club" tab is one extra option, not a new
 * control. Render it only when there's actually a mix to split — an
 * all-or-nothing selector is just noise.
 */
export function ScopeTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly ScopeOption<T>[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1.5 rounded-xl border border-border bg-surface p-1"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
            value === o.key
              ? "bg-brand text-white"
              : "text-muted hover:bg-surface-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
