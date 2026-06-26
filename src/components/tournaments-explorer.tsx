"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Swords, Trophy, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { ScopeTabs, type FriendScope } from "@/components/scope-tabs";
import { viewerTournaments } from "@/lib/actions/tournament-feed-actions";

const FRIEND_SCOPES: { key: FriendScope; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "friends", label: "Amici" },
  { key: "others", label: "Altri" },
];

/** Everything a tournament card needs, pre-computed on the server so this
 *  client component never imports the tournament query module (which pulls in
 *  the DB). */
export type TournamentCardData = {
  id: string;
  slug: string;
  name: string;
  formatEmoji: string;
  formatLabel: string;
  disciplineLabel: string;
  entrantCount: number;
  statusLabel: string;
  statusTone: "win" | "brand" | "muted" | "ball";
  isPrivate: boolean;
  showWinner: boolean;
  /** True when one of the viewer's friends took part in this tournament. */
  hasFriend: boolean;
};

/**
 * Tournament grid with the app-wide «Tutti / Amici / Altri» scope, mirroring the
 * matches explorer: «Amici» keeps the tournaments a friend took part in, «Altri»
 * the rest. The selector appears only when both groups are present.
 */
export function TournamentsExplorer({
  tournaments,
}: {
  /** PUBLIC tournaments, from the cached static shell. The viewer's private
   *  (accessible) tournaments and «Amici» flags are loaded client-side. */
  tournaments: TournamentCardData[];
}) {
  const [friendScope, setFriendScope] = useState<FriendScope>("all");
  // Per-viewer overlay: private tournaments this user may see + the set of
  // tournament ids a friend took part in. Loaded client-side so the page stays
  // a cached shell (and private tournaments never enter the shared cache).
  const [privateCards, setPrivateCards] = useState<TournamentCardData[]>([]);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let active = true;
    viewerTournaments()
      .then((info) => {
        if (!active) return;
        setPrivateCards(info.privateCards);
        setFriendIds(new Set(info.friendIds));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Public (shell) + private (client), deduped, with friend flags applied.
  const all = useMemo(() => {
    const seen = new Set<string>();
    const out: TournamentCardData[] = [];
    for (const t of [...tournaments, ...privateCards]) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      out.push({ ...t, hasFriend: friendIds.has(t.id) });
    }
    return out;
  }, [tournaments, privateCards, friendIds]);

  // Show the «Amici» scope only when friends' tournaments and others actually
  // coexist — otherwise the split would leave a tab permanently empty.
  const friendCount = useMemo(
    () => all.filter((t) => t.hasFriend).length,
    [all],
  );
  const canFilterFriends = friendCount > 0 && friendCount < all.length;
  const activeScope: FriendScope = canFilterFriends ? friendScope : "all";

  const filtered = useMemo(() => {
    if (activeScope === "all") return all;
    return all.filter((t) =>
      activeScope === "friends" ? t.hasFriend : !t.hasFriend,
    );
  }, [all, activeScope]);

  return (
    <div className="space-y-4">
      {canFilterFriends && (
        <ScopeTabs
          options={FRIEND_SCOPES}
          value={friendScope}
          onChange={setFriendScope}
          ariaLabel="Filtra per amici"
        />
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title={
            activeScope === "friends"
              ? "Nessun torneo con i tuoi amici"
              : activeScope === "others"
                ? "Nessun altro torneo"
                : "Nessun torneo"
          }
          description="Scegli «Tutti» per vedere tutti i tornei."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/tornei/${t.slug}`}
              className="card-surface group p-5 transition hover:-translate-y-0.5"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-3xl">{t.formatEmoji}</span>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {t.isPrivate && <Badge tone="muted">🔒 Privato</Badge>}
                  {t.hasFriend && (
                    <Badge tone="sea">
                      <UserCheck className="h-3 w-3" />
                      Amici
                    </Badge>
                  )}
                  <Badge tone={t.statusTone}>{t.statusLabel}</Badge>
                </div>
              </div>
              <h3 className="font-display text-lg font-extrabold group-hover:text-brand">
                {t.name}
              </h3>
              <p className="text-sm text-muted">
                {t.formatLabel} · {t.disciplineLabel} · {t.entrantCount} iscritti
              </p>
              {t.showWinner && (
                <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-[var(--gold)]">
                  <Trophy className="h-4 w-4" /> Vincitore decretato
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
