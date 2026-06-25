"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Minus,
  Plus,
  TrendingUp,
  CheckCircle2,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PlayerCombobox, type PlayerOption } from "@/components/ui/player-combobox";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { proposeMatch, undoMatch } from "@/lib/actions/match-actions";
import { computeElo, sideRating } from "@/lib/elo";

type Option = PlayerOption & {
  eloSingles: number;
  eloDoubles: number;
};

/**
 * Current local wall-clock as the value a <input type="datetime-local"> expects
 * (`YYYY-MM-DDTHH:mm`, no timezone). Computed on the client only — see the mount
 * effect below — so it never causes a server/client hydration mismatch.
 */
function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function MatchForm({
  players,
  isAdmin = false,
  currentPlayerId,
}: {
  players: Option[];
  isAdmin?: boolean;
  currentPlayerId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [format, setFormat] = useState<"singles" | "doubles">("doubles");
  const [ranked, setRanked] = useState(false);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  // "Data e ora" defaults to now. Computed lazily here (runs on both SSR and the
  // client); the resulting server/client time difference on the input is harmless
  // and silenced with suppressHydrationWarning on the field below.
  const [sel, setSel] = useState<Record<string, string>>(() => ({
    playedAt: nowLocalInput(),
    ...(currentPlayerId ? { playerA: currentPlayerId } : {}),
  }));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // After a successful save we keep the user here with an inline "undo" instead
  // of bouncing straight to /partite — gives a short window to fix a mistake.
  const [done, setDone] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [undoError, setUndoError] = useState<string | null>(null);

  const set = (k: string, v: string) => setSel((s) => ({ ...s, [k]: v }));

  // The ids picked in the *other* slots, so a player can't be selected twice in
  // the same match. The current slot keeps its own value selectable.
  const slotKeys =
    format === "singles"
      ? ["playerA", "playerB"]
      : ["playerA", "playerA2", "playerB", "playerB2"];
  const pickedExcept = (slot: string) =>
    new Set(
      slotKeys
        .filter((k) => k !== slot)
        .map((k) => sel[k])
        .filter((id): id is string => Boolean(id)),
    );

  const byId = useMemo(() => {
    const m = new Map<string, Option>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  // Live Elo swing for the currently entered result. Only meaningful for a
  // ranked match with every slot filled and an actual winner.
  const preview = useMemo(() => {
    if (!ranked || scoreA === scoreB) return null;
    const aIds = format === "singles" ? [sel.playerA] : [sel.playerA, sel.playerA2];
    const bIds = format === "singles" ? [sel.playerB] : [sel.playerB, sel.playerB2];
    const aPlayers = aIds.map((id) => (id ? byId.get(id) : undefined));
    const bPlayers = bIds.map((id) => (id ? byId.get(id) : undefined));
    if (aPlayers.some((p) => !p) || bPlayers.some((p) => !p)) return null;
    const rate = (p: Option) =>
      format === "singles" ? p.eloSingles : p.eloDoubles;
    const ratingA = sideRating((aPlayers as Option[]).map(rate));
    const ratingB = sideRating((bPlayers as Option[]).map(rate));
    const { deltaA, deltaB } = computeElo({ ratingA, ratingB, scoreA, scoreB });
    return { deltaA, deltaB };
  }, [
    ranked,
    format,
    sel.playerA,
    sel.playerA2,
    sel.playerB,
    sel.playerB2,
    scoreA,
    scoreB,
    byId,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      format,
      ranked,
      scoreA,
      scoreB,
      note: sel.note ?? "",
      playedAt: sel.playedAt || undefined,
    };

    if (format === "singles") {
      payload.playerA = sel.playerA;
      payload.playerB = sel.playerB;
    } else {
      payload.playerA = sel.playerA;
      payload.playerA2 = sel.playerA2;
      payload.playerB = sel.playerB;
      payload.playerB2 = sel.playerB2;
    }

    const res = await proposeMatch(payload);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setDone(res.matchId);
    router.refresh(); // refresh the feed in the background
  }

  function resetForm() {
    setDone(null);
    setError(null);
    setUndoError(null);
    setScoreA(0);
    setScoreB(0);
    setSel({
      playedAt: nowLocalInput(),
      ...(currentPlayerId ? { playerA: currentPlayerId } : {}),
    });
    router.refresh();
  }

  async function handleUndo() {
    if (!done) return;
    setUndoError(null);
    setUndoing(true);
    const res = await undoMatch(done);
    setUndoing(false);
    if (!res.ok) {
      setUndoError(res.error);
      return;
    }
    toast.info("Inserimento annullato");
    resetForm(); // back to a clean form to re-enter the corrected result
  }

  if (done) {
    return (
      <div className="space-y-5 py-2 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-win/15 text-win">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <div>
          <p className="font-display text-lg font-extrabold">
            {isAdmin ? "Risultato registrato!" : "Proposta inviata!"}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            {isAdmin
              ? "L'Elo è stato aggiornato."
              : "L'avversario riceverà la richiesta di conferma."}
          </p>
        </div>

        {undoError && <FieldError>{undoError}</FieldError>}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            type="button"
            variant="danger"
            onClick={handleUndo}
            disabled={undoing}
          >
            <Undo2 className="h-4 w-4" />
            {undoing ? "Annullamento…" : "Annulla inserimento"}
          </Button>
          <Button type="button" variant="secondary" onClick={resetForm}>
            <Plus className="h-4 w-4" /> Inserisci un&apos;altra
          </Button>
          <Button
            type="button"
            onClick={() => {
              router.push("/partite");
              router.refresh();
            }}
          >
            Vai alle partite <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted">
          Hai dieci minuti per annullare se hai sbagliato qualcosa.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Format switch */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        {(["singles", "doubles"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-bold transition",
              format === f ? "bg-brand text-white shadow-[var(--shadow-brand)]" : "text-muted hover:bg-surface-2",
            )}
          >
            {f === "singles" ? "1 vs 1" : "2 vs 2"}
          </button>
        ))}
      </div>

      {/* Ranked vs friendly */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        {[
          { v: true, label: "🏆 Classificata", hint: "Muove l'Elo" },
          { v: false, label: "🤝 Amichevole", hint: "Solo XP" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setRanked(o.v)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 text-center transition",
              ranked === o.v ? "bg-surface-2 ring-2 ring-brand" : "hover:bg-surface-2",
            )}
          >
            <span className="block text-sm font-bold">{o.label}</span>
            <span className="block text-[11px] text-muted">{o.hint}</span>
          </button>
        ))}
      </div>

      {/* Sides */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <SideColumn tone="brand" label="Squadra A">
          {format === "singles" ? (
            <PlayerSelect players={players} value={sel.playerA} excludeIds={pickedExcept("playerA")} onChange={(v) => set("playerA", v)} />
          ) : (
            <>
              <PlayerSelect players={players} value={sel.playerA} excludeIds={pickedExcept("playerA")} onChange={(v) => set("playerA", v)} />
              <PlayerSelect players={players} value={sel.playerA2} excludeIds={pickedExcept("playerA2")} onChange={(v) => set("playerA2", v)} />
            </>
          )}
          <Stepper value={scoreA} onChange={setScoreA} />
        </SideColumn>

        <div className="self-center pt-8 font-display text-xl font-extrabold text-muted">VS</div>

        <SideColumn tone="sea" label="Squadra B">
          {format === "singles" ? (
            <PlayerSelect players={players} value={sel.playerB} excludeIds={pickedExcept("playerB")} onChange={(v) => set("playerB", v)} />
          ) : (
            <>
              <PlayerSelect players={players} value={sel.playerB} excludeIds={pickedExcept("playerB")} onChange={(v) => set("playerB", v)} />
              <PlayerSelect players={players} value={sel.playerB2} excludeIds={pickedExcept("playerB2")} onChange={(v) => set("playerB2", v)} />
            </>
          )}
          <Stepper value={scoreB} onChange={setScoreB} />
        </SideColumn>
      </div>

      {/* Live Elo preview — shown only for ranked matches. */}
      {ranked && (
        <div className="rounded-2xl border border-border bg-surface p-3">
          {preview ? (
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-bold text-muted">
                <TrendingUp className="h-4 w-4" /> Effetto Elo
              </span>
              <DeltaPill tone="brand" label="A" delta={preview.deltaA} />
              <DeltaPill tone="sea" label="B" delta={preview.deltaB} />
            </div>
          ) : (
            <p className="text-center text-xs text-muted">
              Seleziona i giocatori e imposta un punteggio con un vincitore per
              vedere l&apos;effetto sull&apos;Elo.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="playedAt">Data e ora (opzionale)</Label>
          <Input id="playedAt" type="datetime-local" suppressHydrationWarning value={sel.playedAt ?? ""} onChange={(e) => set("playedAt", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="note">Nota (opzionale)</Label>
          <Input id="note" maxLength={140} value={sel.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="es. vittoria 16-14 ai vantaggi" />
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <Save className="h-4 w-4" />
        {loading
          ? "Salvataggio…"
          : isAdmin
            ? "Registra risultato"
            : "Proponi risultato"}
      </Button>
      {!isAdmin && (
        <p className="text-center text-xs text-muted">
          Il risultato verrà inviato all&apos;avversario per la conferma. Se non
          conferma entro 24h, si conferma da solo.
        </p>
      )}
    </form>
  );
}

function DeltaPill({
  tone,
  label,
  delta,
}: {
  tone: "brand" | "sea";
  label: string;
  delta: number;
}) {
  const positive = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono font-bold tabular-nums",
        positive ? "bg-win/15 text-win" : "bg-loss/15 text-loss",
      )}
    >
      <span
        className={cn(
          "text-[10px] font-extrabold uppercase",
          tone === "brand" ? "text-brand" : "text-sea",
        )}
      >
        {label}
      </span>
      {positive ? `+${delta}` : delta}
    </span>
  );
}

function SideColumn({
  tone,
  label,
  children,
}: {
  tone: "brand" | "sea";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className={cn("text-center text-xs font-bold uppercase tracking-wider", tone === "brand" ? "text-brand" : "text-sea")}>
        {label}
      </p>
      {children}
    </div>
  );
}

function PlayerSelect({
  players,
  value,
  excludeIds,
  onChange,
}: {
  players: Option[];
  value?: string;
  excludeIds?: Set<string>;
  onChange: (v: string) => void;
}) {
  return (
    <PlayerCombobox
      players={players}
      value={value}
      excludeIds={excludeIds}
      onChange={onChange}
    />
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-muted transition hover:text-foreground active:scale-90"
        aria-label="Diminuisci punteggio"
      >
        <Minus className="h-4 w-4" />
      </button>
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
        className="w-14 bg-transparent text-center font-mono text-3xl font-extrabold tabular-nums outline-none [appearance:textfield] focus:text-brand [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Punteggio"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white transition hover:brightness-105 active:scale-90"
        aria-label="Aumenta punteggio"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
