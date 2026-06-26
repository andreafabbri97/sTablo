"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, Users, UserCheck } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AdminBadge } from "@/components/player/admin-badge";
import { ScopeTabs, type FriendScope } from "@/components/scope-tabs";

/** A player the viewer can start a conversation with. */
export type MessageablePerson = {
  userId: string;
  name: string;
  username: string | null;
  slug: string;
  avatarColor: number;
  avatarUrl: string | null;
  isAdmin: boolean;
  isFriend: boolean;
};

/**
 * Searchable list of players to start a new conversation with. Tapping one
 * opens the thread at `/chat/[slug]` (creating the conversation on first send).
 * Fills the detail pane; on mobile a back arrow returns to the list.
 *
 * Friends are split from the rest via a Tutti/Amici/Altri filter (shown only
 * when there's actually a mix), and each row marks friends and admins so you
 * can tell at a glance who you already know.
 */
export function NewChatPicker({ people }: { people: MessageablePerson[] }) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<FriendScope>("all");

  const friendCount = useMemo(
    () => people.filter((p) => p.isFriend).length,
    [people],
  );
  // The filter only earns its space when both groups are non-empty.
  const showTabs = friendCount > 0 && friendCount < people.length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const activeTab = showTabs ? tab : "all";
    const byTab = people.filter((p) =>
      activeTab === "friends"
        ? p.isFriend
        : activeTab === "others"
          ? !p.isFriend
          : true,
    );
    const byQuery = q
      ? byTab.filter((p) =>
          [p.name, p.username]
            .filter(Boolean)
            .some((s) => (s as string).toLowerCase().includes(q)),
        )
      : byTab;
    // In the combined view, surface friends first so the split stays visible
    // (sort is stable, so names keep their alphabetical order within a group).
    return [...byQuery].sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
  }, [people, query, tab, showTabs]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <Link
          href="/chat"
          aria-label="Torna ai messaggi"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="min-w-0 flex-1 truncate px-1 font-semibold">Nuova chat</h2>
      </div>

      <div className="relative border-b border-border p-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome o username…"
          aria-label="Cerca un giocatore"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand"
        />
      </div>

      {showTabs && (
        <div className="border-b border-border p-2">
          <ScopeTabs
            options={[
              { key: "all", label: "Tutti" },
              { key: "friends", label: "Amici" },
              { key: "others", label: "Altri" },
            ]}
            value={tab}
            onChange={setTab}
            ariaLabel="Filtra giocatori"
          />
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted">
            <Users className="h-6 w-6" />
            <p>
              {people.length === 0
                ? "Nessun altro giocatore con un account a cui scrivere."
                : "Nessun giocatore trovato."}
            </p>
          </div>
        ) : (
          filtered.map((p) => (
            <Link
              key={p.userId}
              href={`/chat/${p.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition hover:bg-surface-2"
            >
              <Avatar
                name={p.name}
                colorIndex={p.avatarColor}
                imageUrl={p.avatarUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{p.name}</span>
                  {p.isAdmin && <AdminBadge className="shrink-0" />}
                </div>
                {p.username && (
                  <span className="block truncate text-xs text-muted">
                    @{p.username}
                  </span>
                )}
              </div>
              <Badge
                tone={p.isFriend ? "sea" : "muted"}
                className="shrink-0"
              >
                {p.isFriend ? (
                  <>
                    <UserCheck className="h-3 w-3" />
                    Amico
                  </>
                ) : (
                  "Non amico"
                )}
              </Badge>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
