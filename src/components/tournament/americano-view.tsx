"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordAmericanoMatch } from "@/lib/actions/tournament-actions";
import type {
  AmericanoView as AmericanoData,
  AmericanoMatchView,
} from "@/lib/tournament/queries";
import type { AmericanoStandingRow } from "@/lib/tournament/standings";

export function AmericanoView({
  data,
  canManage,
  completed,
}: {
  data: AmericanoData;
  /** Admin or organizer may record the court results. */
  canManage: boolean;
  /** Whether the tournament is over (crowns the leader). */
  completed: boolean;
}) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading>Classifica individuale</SectionHeading>
        <AmericanoLeaderboard rows={data.standings} completed={completed} />
      </section>

      <section>
        <SectionHeading>Turni</SectionHeading>
        <div className="space-y-4">
          {data.rounds.map((r) => (
            <div key={r.round}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                Turno {r.round}
              </p>
              <div className="space-y-2">
                {r.matches.map((m) => (
                  <AmericanoCourt key={m.id} match={m} canManage={canManage} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold">
      <Swords className="h-4 w-4 text-brand" />
      {children}
    </h2>
  );
}

function AmericanoLeaderboard({
  rows,
  completed,
}: {
  rows: AmericanoStandingRow[];
  completed: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="card-surface overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">Giocatore</th>
            <th className="px-2 py-2 text-center font-semibold">G</th>
            <th className="px-2 py-2 text-center font-semibold">V</th>
            <th className="px-2 py-2 text-center font-semibold">DP</th>
            <th className="px-3 py-2 text-center font-semibold">Punti</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.playerId}
              className={cn(
                "border-b border-border last:border-0",
                i === 0 &&
                  "bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]",
              )}
            >
              <td className="px-3 py-2.5 font-bold text-muted">
                {completed && i === 0 ? "🏆" : i + 1}
              </td>
              <td className="px-2 py-2.5 font-semibold break-words">{r.name}</td>
              <td className="px-2 py-2.5 text-center text-muted">{r.played}</td>
              <td className="px-2 py-2.5 text-center text-win">{r.won}</td>
              <td className="px-2 py-2.5 text-center text-muted">
                {r.diff >= 0 ? "+" : ""}
                {r.diff}
              </td>
              <td className="px-3 py-2.5 text-center font-mono font-extrabold text-brand">
                {r.pointsFor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AmericanoCourt({
  match,
  canManage,
}: {
  match: AmericanoMatchView;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const completed = match.status === "completed";
  const aWon = match.winner === "A";
  const bWon = match.winner === "B";
  const aLabel = match.aNames.join(" & ") || "—";
  const bLabel = match.bNames.join(" & ") || "—";

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await recordAmericanoMatch(match.id, a, b);
      if (!res.ok) setError(res.error);
      else setEditing(false);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex-1 truncate text-sm font-semibold",
            completed && !aWon && "text-muted",
          )}
        >
          {aLabel}
        </span>

        {editing ? (
          <div className="flex items-center gap-1">
            <ScoreInput value={a} onChange={setA} />
            <span className="text-muted">-</span>
            <ScoreInput value={b} onChange={setB} />
          </div>
        ) : completed ? (
          <span className="flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums">
            <span className={aWon ? "text-foreground" : "text-muted"}>
              {match.scoreA}
            </span>
            <span className="text-muted/50">-</span>
            <span className={bWon ? "text-foreground" : "text-muted"}>
              {match.scoreB}
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium text-muted">vs</span>
        )}

        <span
          className={cn(
            "flex-1 truncate text-right text-sm font-semibold",
            completed && !bWon && "text-muted",
          )}
        >
          {bLabel}
        </span>

        {canManage && !completed && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="ml-1 grid h-7 w-7 place-items-center rounded-lg bg-brand text-white"
            aria-label="Inserisci risultato"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {editing && (
          <button
            onClick={save}
            disabled={pending}
            className="ml-1 grid h-7 w-7 place-items-center rounded-lg bg-win text-white disabled:opacity-50"
            aria-label="Salva"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-center text-xs text-loss">{error}</p>}
    </div>
  );
}

function ScoreInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={99}
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        onChange(Number.isNaN(n) ? 0 : Math.max(0, Math.min(99, n)));
      }}
      aria-label="Punteggio"
      className="h-9 w-12 rounded-lg border border-border bg-card text-center font-mono text-base font-bold"
    />
  );
}
