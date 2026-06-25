"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldAlert, X } from "lucide-react";
import { confirmMatch, disputeMatch } from "@/lib/actions/match-actions";
import { DISPUTE_REASON_PRESETS } from "@/lib/dispute-rules";
import { useToast } from "@/components/ui/toast";

/**
 * Opponent-facing actions on a pending result: confirm it, or CONTEST it
 * ("conteso"). Contesting never deletes the match — it flags it for the admin
 * dispute queue and notifies the proposer — so a wrong score, or a fabricated
 * match the opponent never played, can't silently settle into the ranking.
 */
export function MatchConfirmActions({
  matchId,
  disputed = false,
  disputeReason = null,
}: {
  matchId: string;
  disputed?: boolean;
  disputeReason?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "contesting">("idle");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      setError(null);
      const res = await confirmMatch(matchId);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success("Risultato confermato ✅");
        router.refresh();
      }
    });
  }

  function sendDispute() {
    startTransition(async () => {
      setError(null);
      const res = await disputeMatch(matchId, reason);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.info("Contestazione inviata — un admin verificherà");
        setMode("idle");
        setReason("");
        router.refresh();
      }
    });
  }

  // Already contested: show the standing notice; the opponent can still confirm
  // ("we sorted it out"), which clears the dispute.
  if (disputed) {
    return (
      <div className="space-y-2 rounded-xl border border-gold/40 bg-gold/10 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-gold">
          <ShieldAlert className="h-4 w-4" /> Risultato contestato
        </p>
        {disputeReason && (
          <p className="text-xs text-muted">Motivo: «{disputeReason}»</p>
        )}
        <p className="text-xs text-muted">
          In attesa che un admin verifichi. Se vi siete chiariti, potete
          comunque confermare.
        </p>
        <button
          onClick={confirm}
          disabled={pending}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted hover:text-win disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {pending ? "…" : "Conferma comunque"}
        </button>
        {error && <p className="text-center text-xs text-loss">{error}</p>}
      </div>
    );
  }

  if (mode === "contesting") {
    return (
      <div className="space-y-2 rounded-xl border border-border bg-surface/60 p-3">
        <p className="text-sm font-semibold">Perché contesti?</p>
        <div className="flex flex-wrap gap-1.5">
          {DISPUTE_REASON_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setReason(preset)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                reason === preset
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          rows={2}
          placeholder="Aggiungi un dettaglio (facoltativo)…"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex gap-2">
          <button
            onClick={sendDispute}
            disabled={pending || reason.trim().length === 0}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-loss px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <ShieldAlert className="h-4 w-4" /> {pending ? "…" : "Invia contestazione"}
          </button>
          <button
            onClick={() => {
              setMode("idle");
              setReason("");
              setError(null);
            }}
            disabled={pending}
            className="rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted disabled:opacity-50"
          >
            Annulla
          </button>
        </div>
        {error && <p className="text-center text-xs text-loss">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-win px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {pending ? "…" : "Conferma"}
        </button>
        <button
          onClick={() => {
            setMode("contesting");
            setError(null);
          }}
          disabled={pending}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted hover:text-loss disabled:opacity-50"
        >
          <X className="h-4 w-4" /> Contesta
        </button>
      </div>
      {error && <p className="text-center text-xs text-loss">{error}</p>}
    </div>
  );
}
