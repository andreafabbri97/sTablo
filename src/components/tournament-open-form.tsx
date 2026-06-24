"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { createOpenTournament } from "@/lib/actions/tournament-actions";

type Format = "league" | "round_robin" | "single_elim" | "groups_knockout" | "swiss";

const FORMATS: { id: Format; emoji: string; label: string; blurb: string }[] = [
  { id: "league",          emoji: "🏆", label: "Campionato",         blurb: "Tutti contro tutti a punti" },
  { id: "round_robin",     emoji: "🔄", label: "Girone all'italiana", blurb: "Round robin a girone unico" },
  { id: "single_elim",     emoji: "⚔️", label: "Eliminazione diretta", blurb: "Tabellone a eliminazione" },
  { id: "groups_knockout", emoji: "🌍", label: "Gironi + eliminazione", blurb: "Gironi poi tabellone finale" },
  { id: "swiss",           emoji: "🇨🇭", label: "Svizzero",           blurb: "Accoppiamenti per punteggio" },
];

export function TournamentOpenForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [format, setFormat] = useState<Format>("single_elim");
  const [ranked, setRanked] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
