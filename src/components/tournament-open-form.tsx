"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createOpenTournament } from "@/lib/actions/tournament-actions";

type Format =
  | "league"
  | "round_robin"
  | "single_elim"
  | "groups_knockout"
  | "swiss"
  | "americano";

const FORMATS: { id: Format; emoji: string; label: string; blurb: string }[] = [
  { id: "league",          emoji: "🏆", label: "Campionato",         blurb: "Tutti contro tutti a punti" },
  { id: "round_robin",     emoji: "🔄", label: "Girone all'italiana", blurb: "Round robin a girone unico" },
  { id: "single_elim",     emoji: "⚔️", label: "Eliminazione diretta", blurb: "Tabellone a eliminazione" },
  { id: "groups_knockout", emoji: "🌍", label: "Gironi + eliminazione", blurb: "Gironi poi tabellone finale" },
  { id: "swiss",           emoji: "🇨🇭", label: "Svizzero",           blurb: "Accoppiamenti per punteggio" },
  { id: "americano",       emoji: "🟡", label: "Americano",          blurb: "Coppie a rotazione, classifica individuale" },
];

export function TournamentOpenForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("single_elim");
  const [ranked, setRanked] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState("");
  const [targetScore, setTargetScore] = useState(15);
  const [americanoRounds, setAmericanoRounds] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isAmericano = format === "americano";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await createOpenTournament({
      name,
      format,
      discipline: "singles",
      ranked,
      description,
      visibility: isPrivate ? "private" : "public",
      ...(isAmericano
        ? {
            targetScore,
            americanoRounds:
              typeof americanoRounds === "number" ? americanoRounds : undefined,
          }
        : {}),
    });
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/tornei/${res.slug}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Nome del torneo</Label>
        <Input
          id="name"
          placeholder="es. Torneo di giugno 2026"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {/* Format picker */}
      <div>
        <Label>Formato</Label>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition",
                format === f.id
                  ? "border-brand bg-brand-soft"
                  : "border-border bg-surface hover:bg-surface-2",
              )}
            >
              <span className="text-xl">{f.emoji}</span>
              <span className="text-sm font-bold">{f.label}</span>
              <span className="text-xs text-muted">{f.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Americano settings */}
      {isAmericano && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            🟡 Impostazioni Americano
          </p>
          <p className="text-xs text-muted">
            Coppie a rotazione: a ogni turno cambi compagno e avversari. La
            classifica è individuale, in base ai punti che segni. Servono almeno
            4 giocatori.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="target">Punti per game</Label>
              <Input
                id="target"
                type="number"
                inputMode="numeric"
                min={1}
                max={99}
                value={targetScore}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setTargetScore(Number.isNaN(n) ? 0 : Math.max(1, Math.min(99, n)));
                }}
              />
            </div>
            <div>
              <Label htmlFor="rounds">Turni (vuoto = auto)</Label>
              <Input
                id="rounds"
                type="number"
                inputMode="numeric"
                min={1}
                max={20}
                placeholder="auto"
                value={americanoRounds}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "") return setAmericanoRounds("");
                  const n = parseInt(v, 10);
                  setAmericanoRounds(Number.isNaN(n) ? "" : Math.max(1, Math.min(20, n)));
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Classificato toggle */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <button
          type="button"
          role="switch"
          aria-checked={ranked}
          onClick={() => setRanked((v) => !v)}
          className={cn(
            "relative h-6 w-11 rounded-full transition",
            ranked ? "bg-brand" : "bg-border",
          )}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", ranked ? "left-5" : "left-0.5")} />
        </button>
        <div>
          <p className="font-semibold">{ranked ? "🏆 Classificato" : "🤝 Amichevole"}</p>
          <p className="text-xs text-muted">{ranked ? "Incide sull'Elo" : "Solo XP, nessun effetto sull'Elo"}</p>
        </div>
      </div>

      {/* Visibilità toggle */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
        <button
          type="button"
          role="switch"
          aria-checked={isPrivate}
          onClick={() => setIsPrivate((v) => !v)}
          className={cn(
            "relative h-6 w-11 rounded-full transition",
            isPrivate ? "bg-brand" : "bg-border",
          )}
        >
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", isPrivate ? "left-5" : "left-0.5")} />
        </button>
        <div>
          <p className="font-semibold">{isPrivate ? "🔒 Privato" : "🌍 Pubblico"}</p>
          <p className="text-xs text-muted">
            {isPrivate
              ? "Nascosto dalla lista: solo gli invitati possono vederlo e partecipare"
              : "Visibile a tutti nella lista tornei"}
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="desc">Descrizione (opzionale)</Label>
        <Textarea
          id="desc"
          rows={2}
          placeholder="es. Torneo di fine estate sulla spiaggia!"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <Swords className="h-4 w-4" />
        {loading ? "Creazione…" : "Crea torneo e ottieni il link invito"}
      </Button>
      <p className="text-center text-xs text-muted">
        Dopo la creazione riceverai un link/QR da condividere.<br/>
        Il torneo parte quando avvii tu (o un admin).
      </p>
    </form>
  );
}
