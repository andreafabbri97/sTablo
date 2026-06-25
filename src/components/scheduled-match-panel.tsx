"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  recordScheduledResult,
  cancelScheduledMatch,
} from "@/lib/actions/match-actions";

export function ScheduledMatchPanel({
  matchId,
  labelA,
  labelB,
  canRecord,
  canCancel,
  isAdmin,
}: {
  matchId: string;
  labelA: string;
  labelB: string;
  canRecord: boolean;
  canCancel: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await recordScheduledResult(matchId, { scoreA, scoreB, note });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.info(
      isAdmin ? "Risultato registrato!" : "Risultato inviato: ora tocca all'avversario confermare",
    );
    router.push("/partite");
    router.refresh();
  }

  async function onCancel() {
    setError(null);
    setCancelling(true);
    const res = await cancelScheduledMatch(matchId);
    setCancelling(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.info("Sfida annullata");
    router.push("/partite");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canRecord && (
        <form onSubmit={onSave} className="space-y-4">
          <p className="text-sm font-semibold text-muted">Hai giocato? Inserisci il risultato:</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <ScoreColumn tone="brand" label={labelA} value={scoreA} onChange={setScoreA} />
            <span className="self-center font-display text-lg font-extrabold text-muted">–</span>
            <ScoreColumn tone="sea" label={labelB} value={scoreB} onChange={setScoreB} />
          </div>
          <div>
            <Label htmlFor="note">Nota (opzionale)</Label>
            <Input
              id="note"
              maxLength={140}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="es. che battaglia ai vantaggi"
            />
          </div>
          <FieldError>{error}</FieldError>
          <Button type="submit" className="w-full" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving
              ? "Salvataggio…"
              : isAdmin
                ? "Registra risultato"
                : "Invia risultato"}
          </Button>
          {!isAdmin && (
            <p className="text-center text-xs text-muted">
              L&apos;avversario dovrà confermare il punteggio.
            </p>
          )}
        </form>
      )}

      {canCancel && (
        <div className={cn(canRecord && "border-t border-border pt-4")}>
          {!canRecord && error && <FieldError>{error}</FieldError>}
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={onCancel}
            disabled={cancelling}
          >
            <Trash2 className="h-4 w-4" />
            {cancelling ? "Annullamento…" : "Annulla sfida"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ScoreColumn({
  tone,
  label,
  value,
  onChange,
}: {
  tone: "brand" | "sea";
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p
        className={cn(
          "truncate text-center text-xs font-bold uppercase tracking-wider",
          tone === "brand" ? "text-brand" : "text-sea",
        )}
      >
        {label}
      </p>
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
          className="w-12 bg-transparent text-center font-mono text-2xl font-extrabold tabular-nums outline-none [appearance:textfield] focus:text-brand [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          aria-label={`Punteggio ${label}`}
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
    </div>
  );
}
