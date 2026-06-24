"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startTournament } from "@/lib/actions/tournament-actions";

export function StartTournamentButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setError(null);
    const res = await startTournament(tournamentId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button onClick={onClick} disabled={loading} size="lg" className="w-full">
        <Play className="h-4 w-4" />
        {loading ? "Avvio in corso…" : "🚀 Avvia il torneo"}
      </Button>
      {error && <p className="text-center text-xs text-loss">{error}</p>}
    </div>
  );
}
