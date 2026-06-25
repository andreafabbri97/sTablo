"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteMatch } from "@/lib/actions/match-actions";
import { useToast } from "@/components/ui/toast";

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">Eliminare?</span>
        <button
          onClick={() =>
            startTransition(async () => {
              const res = await deleteMatch(matchId);
              if (res.ok) toast.success("Partita eliminata");
              else toast.error(res.error);
            })
          }
          disabled={pending}
          className="font-semibold text-loss hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "Sì"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="font-semibold text-muted hover:underline"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-loss"
    >
      <Trash2 className="h-3.5 w-3.5" /> Elimina
    </button>
  );
}
