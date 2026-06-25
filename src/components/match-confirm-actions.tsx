"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { confirmMatch, rejectMatch } from "@/lib/actions/match-actions";
import { useToast } from "@/components/ui/toast";

export function MatchConfirmActions({
  matchId,
  canReject = true,
}: {
  matchId: string;
  canReject?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
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

  function reject() {
    startTransition(async () => {
      setError(null);
      const res = await rejectMatch(matchId);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.info("Proposta rifiutata");
        router.refresh();
      }
    });
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
        {canReject &&
          (confirming ? (
            <button
              onClick={reject}
              disabled={pending}
              className="flex items-center gap-1.5 rounded-xl bg-loss px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Confermi il rifiuto?
            </button>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted hover:text-loss"
            >
              <X className="h-4 w-4" /> Rifiuta
            </button>
          ))}
      </div>
      {error && <p className="text-center text-xs text-loss">{error}</p>}
    </div>
  );
}
