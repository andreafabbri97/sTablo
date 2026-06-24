"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateNextSwissRound } from "@/lib/actions/tournament-actions";

export function SwissControls({
  tournamentId,
  disabled,
}: {
  tournamentId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await generateNextSwissRound(tournamentId);
            if (!res.ok) setError(res.error);
            else router.refresh();
          })
        }
      >
        <Shuffle className="h-4 w-4" />
        {pending ? "Generazione…" : "Genera turno successivo"}
      </Button>
      {error && <p className="text-xs text-loss">{error}</p>}
    </div>
  );
}
