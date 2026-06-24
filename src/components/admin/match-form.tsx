"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Select, Input, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { recordMatch } from "@/lib/actions/match-actions";

type Option = { id: string; name: string };

export function MatchForm({
  players,
  teams,
}: {
  players: Option[];
  teams: Option[];
}) {
  const router = useRouter();
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [ranked, setRanked] = useState(true);
  const [useTeams, setUseTeams] = useState(false);
  const [scoreA, setScoreA] = useState(15);
  const [scoreB, setScoreB] = useState(11);
  const [sel, setSel] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setSel((s) => ({ ...s, [k]: v }));

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
    } else if (useTeams) {
      payload.teamA = sel.teamA;
      payload.teamB = sel.teamB;
    } else {
      payload.playerA = sel.playerA;
      payload.playerA2 = sel.playerA2;
      payload.playerB = sel.playerB;
      payload.playerB2 = sel.playerB2;
    }

    const res = await recordMatch(payload);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/partite");
    router.refresh();
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

      {format === "doubles" && (
        <label className="flex items-center justify-center gap-2 text-sm font-medium text-muted">
          <input
            type="checkbox"
            checked={useTeams}
            onChange={(e) => setUseTeams(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          Usa team registrati ({teams.length})
        </label>
      )}

      {/* Sides */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
        <SideColumn tone="brand" label="Squadra A">
          {format === "singles" ? (
            <PlayerSelect players={players} value={sel.playerA} onChange={(v) => set("playerA", v)} />
          ) : useTeams ? (
            <TeamSelect teams={teams} value={sel.teamA} onChange={(v) => set("teamA", v)} />
          ) : (
            <>
              <PlayerSelect players={players} value={sel.playerA} onChange={(v) => set("playerA", v)} />
              <PlayerSelect players={players} value={sel.playerA2} onChange={(v) => set("playerA2", v)} />
            </>
          )}
          <Stepper value={scoreA} onChange={setScoreA} />
        </SideColumn>

        <div className="self-center pt-8 font-display text-xl font-extrabold text-muted">VS</div>

        <SideColumn tone="sea" label="Squadra B">
          {format === "singles" ? (
            <PlayerSelect players={players} value={sel.playerB} onChange={(v) => set("playerB", v)} />
          ) : useTeams ? (
            <TeamSelect teams={teams} value={sel.teamB} onChange={(v) => set("teamB", v)} />
          ) : (
            <>
              <PlayerSelect players={players} value={sel.playerB} onChange={(v) => set("playerB", v)} />
              <PlayerSelect players={players} value={sel.playerB2} onChange={(v) => set("playerB2", v)} />
            </>
          )}
          <Stepper value={scoreB} onChange={setScoreB} />
        </SideColumn>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="playedAt">Data e ora (opzionale)</Label>
          <Input id="playedAt" type="datetime-local" value={sel.playedAt ?? ""} onChange={(e) => set("playedAt", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="note">Nota (opzionale)</Label>
          <Input id="note" maxLength={140} value={sel.note ?? ""} onChange={(e) => set("note", e.target.value)} placeholder="es. killer point sul 17-17" />
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <Save className="h-4 w-4" />
        {loading ? "Salvataggio…" : "Registra risultato"}
      </Button>
    </form>
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
    <div className="space-y-2">
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
  onChange,
}: {
  players: Option[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Giocatore…</option>
      {players.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </Select>
  );
}

function TeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: Option[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">Team…</option>
      {teams.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </Select>
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
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-12 text-center font-mono text-3xl font-extrabold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(99, value + 1))}
        className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white transition hover:brightness-105 active:scale-90"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
