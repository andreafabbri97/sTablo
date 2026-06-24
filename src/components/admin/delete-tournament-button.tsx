"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteTournament } from "@/lib/actions/tournament-actions";

export function DeleteTournamentButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Eliminare il torneo?</span>
        <button
          onClick={() =>
            startTransition(async () => {
              await deleteTournament(tournamentId);
              router.push("/tornei");
              router.refresh();
            })
          }
          disabled={pending}
          className="font-semibold text-loss hover:underline disabled:opacity-50"
        >
          {pending ? "…" : "Sì, elimina"}
        </button>
        <button onClick={() => setConfirming(false)} className="font-semibold text-muted">
          Annulla
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1 text-sm font-medium text-muted transition hover:text-loss"
    >
      <Trash2 className="h-4 w-4" /> Elimina torneo
    </button>
  );
}
