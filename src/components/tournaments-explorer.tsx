"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Swords, Trophy, Users, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/page";
import { cn } from "@/lib/utils";

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
 * Tournament grid with an optional «Solo amici» scope, mirroring the matches
 * explorer: when the viewer has friends who joined tournaments, a toggle keeps
 * only the tournaments they took part in.
 */
export function TournamentsExplorer({
  tournaments,
  canFilterFriends,
}: {
  tournaments: TournamentCardData[];
  canFilterFriends: boolean;
}) {
  const [friendsOnly, setFriendsOnly] = useState(false);

  const filtered = useMemo(
    () =>
      friendsOnly && canFilterFriends
        ? tournaments.filter((t) => t.hasFriend)
        : tournaments,
    [tournaments, friendsOnly, canFilterFriends],
  );

  return (
    <div className="space-y-4">
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
          Solo con i miei amici
        </button>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title="Nessun torneo con i tuoi amici"
          description="Disattiva «Solo con i miei amici» per vedere tutti i tornei."
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
