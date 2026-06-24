"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Swords, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createTournament } from "@/lib/actions/tournament-actions";

type Option = { id: string; name: string };
type Format = "league" | "round_robin" | "single_elim" | "groups_knockout" | "swiss";
type Discipline = "singles" | "doubles" | "teams";

const FORMATS: { id: Format; emoji: string; label: string; blurb: string }[] = [
  { id: "league", emoji: "🏆", label: "Campionato", blurb: "Tutti contro tutti a punti (Serie A)" },
  { id: "round_robin", emoji: "🔄", label: "Girone all'italiana", blurb: "Round robin a girone unico" },
  { id: "single_elim", emoji: "⚔️", label: "Eliminazione diretta", blurb: "Tabellone a eliminazione" },
  { id: "groups_knockout", emoji: "🌍", label: "Gironi + eliminazione", blurb: "Gironi poi tabellone finale" },
  { id: "swiss", emoji: "🇨🇭", label: "Svizzero", blurb: "Accoppiamenti per punteggio" },
];

export function TournamentForm({
  players,
  teams,
}: {
  players: Option[];
  teams: Option[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("league");
  const [discipline, setDiscipline] = useState<Discipline>("doubles");
  const [ranked, setRanked] = useState(false);
  const [doubleRound, setDoubleRound] = useState(false);
  const [thirdPlace, setThirdPlace] = useState(false);
  const [groups, setGroups] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [swissRounds, setSwissRounds] = useState(3);
  const [selected, setSelected] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pool = useMemo(
    () => (discipline === "singles" ? players : teams),
    [discipline, players, teams],
  );

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selected.length < 2) {
      setError("Seleziona almeno 2 partecipanti");
      return;
    }
    setLoading(true);
    const res = await createTournament({
      name,
      format,
      discipline,
      ranked,
      doubleRound,
      thirdPlace,
      groups,
      advancePerGroup,
      swissRounds,
      description,
      entrantIds: selected,
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/tornei/${res.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Nome torneo</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="es. Coppa Estate 2026" />
      </div>

      {/* Format */}
      <div>
        <Label>Formato</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left transition",
                format === f.id ? "border-brand bg-brand-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="text-2xl">{f.emoji}</span>
              <span>
                <span className="block text-sm font-bold">{f.label}</span>
                <span className="block text-xs text-muted">{f.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Discipline */}
      <div>
        <Label>Disciplina</Label>
        <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
          {(["singles", "doubles", "teams"] as Discipline[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDiscipline(d);
                setSelected([]);
              }}
              className={cn(
                "flex-1 rounded-xl py-2 text-sm font-bold transition",
                discipline === d ? "bg-brand text-white" : "text-muted hover:bg-surface-2",
              )}
            >
              {d === "singles" ? "Singolo" : d === "doubles" ? "Doppio" : "Team"}
            </button>
          ))}
        </div>
        {discipline !== "singles" && teams.length === 0 && (
          <p className="mt-2 text-xs text-loss">
            Nessun team registrato. Crea prima dei team nel pannello admin.
          </p>
        )}
      </div>

      {/* Ranked */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        {[
          { v: true, label: "🏆 Classificato", hint: "Muove l'Elo" },
          { v: false, label: "🤝 Amichevole", hint: "Solo XP" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setRanked(o.v)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 transition",
              ranked === o.v ? "bg-surface-2 ring-2 ring-brand" : "hover:bg-surface-2",
            )}
          >
            <span className="block text-sm font-bold">{o.label}</span>
            <span className="block text-[11px] text-muted">{o.hint}</span>
          </button>
        ))}
      </div>

      {/* Conditional config */}
      {format === "league" && (
        <Toggle checked={doubleRound} onChange={setDoubleRound} label="Andata e ritorno" hint="Ogni sfida si gioca due volte" />
      )}
      {(format === "single_elim" || format === "groups_knockout") && (
        <Toggle checked={thirdPlace} onChange={setThirdPlace} label="Finale 3°/4° posto" hint="Aggiungi la finalina" />
      )}
      {format === "groups_knockout" && (
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Numero gironi" value={groups} setValue={setGroups} min={2} max={8} />
          <NumberField label="Qualificate per girone" value={advancePerGroup} setValue={setAdvancePerGroup} min={1} max={4} />
        </div>
      )}
      {format === "swiss" && (
        <NumberField label="Numero turni" value={swissRounds} setValue={setSwissRounds} min={2} max={9} />
      )}

      {/* Entrants */}
      <div>
        <Label>Partecipanti ({selected.length} selezionati)</Label>
        <p className="mb-2 text-xs text-muted">L&apos;ordine di selezione determina le teste di serie.</p>
        {pool.length === 0 ? (
          <p className="text-sm text-muted">Nessun partecipante disponibile.</p>
        ) : (
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-border p-2 sm:grid-cols-3">
            {pool.map((o) => {
              const idx = selected.indexOf(o.id);
              const isSel = idx >= 0;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition",
                    isSel ? "bg-brand text-white" : "bg-surface-2 text-foreground hover:bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      isSel ? "bg-white/25" : "bg-border",
                    )}
                  >
                    {isSel ? idx + 1 : ""}
                  </span>
                  <span className="truncate">{o.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="desc">Descrizione (opzionale)</Label>
        <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={280} />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <Swords className="h-4 w-4" />
        {loading ? "Creazione…" : "Crea torneo"}
      </Button>
    </form>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition",
        checked ? "border-brand bg-brand-soft" : "border-border",
      )}
    >
      <span className={cn("grid h-6 w-6 place-items-center rounded-md", checked ? "bg-brand text-white" : "bg-surface-2")}>
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </button>
  );
}

function NumberField({
  label,
  value,
  setValue,
  min,
  max,
}: {
  label: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setValue(Math.max(min, value - 1))} className="grid h-10 w-10 place-items-center rounded-lg bg-surface-2 font-bold">
          −
        </button>
        <span className="w-10 text-center font-mono text-xl font-bold">{value}</span>
        <button type="button" onClick={() => setValue(Math.min(max, value + 1))} className="grid h-10 w-10 place-items-center rounded-lg bg-brand font-bold text-white">
          +
        </button>
      </div>
    </div>
  );
}
