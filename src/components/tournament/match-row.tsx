"use client";

import { useState, useTransition } from "react";
import { Check, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordTournamentMatch } from "@/lib/actions/tournament-actions";
import type { TournamentMatchView } from "@/lib/tournament/queries";

export function MatchRow({
  match,
  isAdmin,
}: {
  match: TournamentMatchView;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [a, setA] = useState(15);
  const [b, setB] = useState(11);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = !!match.aId && !!match.bId;
  const completed = match.status === "completed";
  const aWon = match.winner === "A";
  const bWon = match.winner === "B";

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
        <span className={cn("flex-1 truncate text-sm font-semibold", completed && !aWon && "text-muted")}>
          {match.aName}
        </span>

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

        <span className={cn("flex-1 truncate text-right text-sm font-semibold", completed && !bWon && "text-muted")}>
          {match.bName}
        </span>

        {isAdmin && !completed && ready && !editing && (
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
      min={0}
      max={99}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-9 w-12 rounded-lg border border-border bg-card text-center font-mono text-base font-bold"
    />
  );
}
