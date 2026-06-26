"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { PlayerName } from "@/components/player/player-name";
import { EmptyState } from "@/components/ui/page";
import { RowsSkeleton } from "@/components/ui/skeletons";
import { ScopeTabs, type FriendScope } from "@/components/scope-tabs";
import { classificaOverlay } from "@/lib/actions/classifica-actions";
import { cn, pct } from "@/lib/utils";
import type { RankRow } from "@/lib/stats";
import type { SeasonStanding } from "@/lib/seasons";
import { TEAMS_ENABLED } from "@/lib/features";

type TeamRow = {
  id: string;
  name: string;
  avatarColor: number;
  eloDoubles: number;
};

type Tab = "season" | "overall" | "singles" | "doubles" | "teams";

const TABS: { key: Tab; label: string }[] = [
  { key: "season", label: "Stagione" },
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
  const [tab, setTab] = useState<Tab>("season");
  const [scope, setScope] = useState<FriendScope>("all");

  // Season standings (date-dependent) + the viewer's friends load client-side so
  // the rankings (Generale/Singolo/Doppio/Team) stay a cached static shell. In
  // the leaderboard «Amici» includes YOU (selfSlug).
  const [overlay, setOverlay] = useState<{
    season: SeasonStanding[];
    seasonLabel: string;
    friendSlugs: string[];
    selfSlug: string | null;
    loaded: boolean;
  }>({
    season: [],
    seasonLabel: "",
    friendSlugs: [],
    selfSlug: null,
    loaded: false,
  });

  useEffect(() => {
    let active = true;
    classificaOverlay()
      .then((info) => active && setOverlay({ ...info, loaded: true }))
      .catch(() => active && setOverlay((o) => ({ ...o, loaded: true })));
    return () => {
      active = false;
    };
  }, []);

  const { season, seasonLabel, selfSlug } = overlay;
  const friendSet = useMemo(
    () => new Set(overlay.friendSlugs),
    [overlay.friendSlugs],
  );
  const rows = tab === "singles" ? singles : tab === "doubles" ? doubles : overall;
  const players = rows.filter((r) => r.played > 0);

  // Your circle = friends + you. The split is worth showing only when you
  // actually have friends (your own row alone isn't a reason to show it), so
  // `showScope` still keys off the friend count, not the circle.
  const inCircle = (slug: string) => friendSet.has(slug) || slug === selfSlug;

  // The slugs visible in the active player-based tab.
  const activeSlugs =
    tab === "season"
      ? season.map((r) => r.player.slug)
      : tab === "teams"
        ? []
        : players.map((r) => r.player.slug);
  // Show the split whenever you actually have friends and the active board has
  // players. We deliberately DON'T require a friend in this specific tab: in the
  // leaderboard «Amici» = your circle (you + friends), so it's useful even on a
  // tab (e.g. the current Stagione) where no friend has played yet — it just
  // narrows to you. Hidden on Team (no friend concept).
  const showScope =
    tab !== "teams" && friendSet.size > 0 && activeSlugs.length > 0;
  const activeScope = showScope ? scope : "all";

  const keep = (slug: string) =>
    activeScope === "all"
      ? true
      : activeScope === "friends"
        ? inCircle(slug)
        : !inCircle(slug);

  const shownSeason = season.filter((r) => keep(r.player.slug));
  const shownPlayers = players.filter((r) => keep(r.player.slug));

  return (
    <div>
      <div className="mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5">
        {TABS.filter((t) => TEAMS_ENABLED || t.key !== "teams").map((t) => (
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

      {showScope && (
        <div className="mb-4">
          <ScopeTabs
            options={[
              { key: "all", label: "Tutti" },
              { key: "friends", label: "Amici" },
              { key: "others", label: "Altri" },
            ]}
            value={scope}
            onChange={setScope}
            ariaLabel="Filtra classifica"
          />
        </div>
      )}

      {tab === "season" ? (
        !overlay.loaded ? (
          <RowsSkeleton rows={5} />
        ) : (
          <SeasonBoard
            season={shownSeason}
            seasonLabel={seasonLabel}
            filtered={activeScope !== "all"}
          />
        )
      ) : TEAMS_ENABLED && tab === "teams" ? (
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
      ) : shownPlayers.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-6 w-6" />}
          title={activeScope === "friends" ? "Cerchia ancora a secco" : "Classifica vuota"}
          description={
            activeScope === "friends"
              ? "Né tu né i tuoi amici avete ancora giocato partite di classifica."
              : "Servono partite giocate per popolare il ranking."
          }
        />
      ) : (
        <div className="space-y-2 animate-fade-up">
          {shownPlayers.map((row, i) => (
            <Link
              key={row.player.id}
              href={`/giocatori/${row.player.slug}`}
              className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
            >
              <RankBadge rank={i + 1} />
              <Avatar name={row.player.name} colorIndex={row.player.avatarColor} imageUrl={row.player.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <PlayerName
                  name={row.player.name}
                  username={row.username}
                  nameClassName="font-bold"
                />
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

function SeasonBoard({
  season,
  seasonLabel,
  filtered = false,
}: {
  season: SeasonStanding[];
  seasonLabel: string;
  filtered?: boolean;
}) {
  if (season.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="h-6 w-6" />}
        title={filtered ? "Cerchia ancora a secco" : "Stagione ancora a secco"}
        description={
          filtered
            ? `Né tu né i tuoi amici avete giocato partite di classifica a ${seasonLabel}.`
            : `Nessuna partita di classifica giocata a ${seasonLabel}. Scendi in campo!`
        }
      />
    );
  }

  const [mvp, ...rest] = season;

  return (
    <div className="space-y-4 animate-fade-up">
      {/* MVP del mese */}
      <Link
        href={`/giocatori/${mvp.player.slug}`}
        className="block rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 to-transparent p-4 transition hover:-translate-y-0.5"
      >
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
          <Trophy className="h-4 w-4" /> MVP di {seasonLabel}
        </p>
        <div className="flex items-center gap-3">
          <Avatar
            name={mvp.player.name}
            colorIndex={mvp.player.avatarColor}
            imageUrl={mvp.player.avatarUrl}
            size="lg"
            ring
          />
          <div className="min-w-0 flex-1">
            <PlayerName
              name={mvp.player.name}
              username={mvp.username}
              nameClassName="font-display text-lg font-extrabold"
            />
            <p className="text-sm text-muted">
              {mvp.won}V · {mvp.lost}S · {pct(mvp.won, mvp.played)}% win
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-extrabold tabular-nums text-brand">
              {mvp.points}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-muted">punti</p>
          </div>
        </div>
      </Link>

      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((row, i) => (
            <Link
              key={row.player.id}
              href={`/giocatori/${row.player.slug}`}
              className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-0.5"
            >
              <RankBadge rank={i + 2} />
              <Avatar
                name={row.player.name}
                colorIndex={row.player.avatarColor}
                imageUrl={row.player.avatarUrl}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <PlayerName
                  name={row.player.name}
                  username={row.username}
                  nameClassName="font-bold"
                />
                <p className="text-xs text-muted">
                  {row.won}V · {row.lost}S · {pct(row.won, row.played)}%
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono font-extrabold tabular-nums text-brand">
                  {row.points}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-muted">punti</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="px-1 text-center text-xs text-muted">
        Classifica di {seasonLabel} · 3 punti a vittoria, solo partite classificate.
      </p>
    </div>
  );
}
