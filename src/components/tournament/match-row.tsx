"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordTournamentMatch } from "@/lib/actions/tournament-actions";
import type { TournamentMatchView } from "@/lib/tournament/queries";

export function MatchRow({
  match,
  canManage,
}: {
  match: TournamentMatchView;
  /** Admin or the tournament organizer may record results. */
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(0);
  const [b, setB] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = !!match.aId && !!match.bId;
  const completed = match.status === "completed";
  const aWon = match.winner === "A";
  const bWon = match.winner === "B";

  // Bye / "Riposo": odd-count player sitting out this round with a free win.
  if (match.label === "Riposo") {
    return (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-border bg-surface px-3 py-2.5">
        <span className="truncate text-sm font-semibold">{match.aName}</span>
        <span className="shrink-0 text-xs font-medium text-muted">🛌 Riposo</span>
      </div>
    );
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await recordTournamentMatch(match.id, a, b);
      if (!res.ok) setError(res.error);
      else setEditing(false);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className={cn("flex min-w-0 flex-1 flex-col", completed && !aWon && "text-muted")}>
          <span className="truncate text-sm font-semibold">{match.aName}</span>
          {match.aUsername && (
            <span className="truncate text-[11px] font-medium leading-tight text-muted">
              @{match.aUsername}
            </span>
          )}
        </div>

        {editing ? (
          <div className="flex items-center gap-1">
            <ScoreInput value={a} onChange={setA} />
            <span className="text-muted">-</span>
            <ScoreInput value={b} onChange={setB} />
          </div>
        ) : completed ? (
          <span className="flex items-center gap-1.5 font-mono text-lg font-bold tabular-nums">
            <span className={aWon ? "text-foreground" : "text-muted"}>{match.scoreA}</span>
            <span className="text-muted/50">-</span>
            <span className={bWon ? "text-foreground" : "text-muted"}>{match.scoreB}</span>
          </span>
        ) : (
          <span className="text-xs font-medium text-muted">vs</span>
        )}

        <div className={cn("flex min-w-0 flex-1 flex-col text-right", completed && !bWon && "text-muted")}>
          <span className="truncate text-sm font-semibold">{match.bName}</span>
          {match.bUsername && (
            <span className="truncate text-[11px] font-medium leading-tight text-muted">
              @{match.bUsername}
            </span>
          )}
        </div>

        {canManage && !completed && ready && !editing && (
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
        {!editing && ready && (
          <Link
            href={`/partite/${match.id}`}
            aria-label="Apri dettaglio e commenti della partita"
            title="Dettaglio e commenti"
            className="ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-border text-muted transition hover:border-brand/40 hover:text-brand"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      {match.label && !completed && (
        <p className="mt-1 text-center text-[10px] uppercase tracking-wide text-muted">{match.label}</p>
      )}
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
