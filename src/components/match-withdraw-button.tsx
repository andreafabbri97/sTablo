"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { rejectMatch } from "@/lib/actions/match-actions";
import { useToast } from "@/components/ui/toast";

/**
 * Lets the proposer withdraw their own pending proposal (e.g. after the opponent
 * contested it) so they can re-enter a correct result. Two-step to avoid an
 * accidental tap.
 */
export function MatchWithdrawButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  const [pending, startTransition] = useTransition();

  function withdraw() {
    startTransition(async () => {
      const res = await rejectMatch(matchId);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.info("Proposta annullata");
        router.refresh();
        router.push("/partite");
      }
    });
  }

  if (!armed) {
    return (
      <button
        onClick={() => setArmed(true)}
        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted hover:text-loss"
      >
        <Trash2 className="h-4 w-4" /> Annulla proposta
      </button>
    );
  }

  return (
    <button
      onClick={withdraw}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-xl bg-loss px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" /> {pending ? "…" : "Confermi l'annullamento?"}
    </button>
  );
}
