"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/field";
import { PlayerCombobox, type PlayerOption } from "@/components/ui/player-combobox";
import { createTeam } from "@/lib/actions/player-actions";

type Option = PlayerOption;

export function CreateTeamForm({ players }: { players: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!p1 || !p2) {
      setError("Scegli entrambi i giocatori");
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await createTeam({ name, player1Id: p1, player2Id: p2 });
      if (!res.ok) setError(res.error);
      else {
        setName("");
        setP1("");
        setP2("");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        aria-label="Nome team (alias)"
        placeholder="Nome team (alias)"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <PlayerCombobox
          players={players}
          value={p1}
          excludeIds={p2 ? new Set([p2]) : undefined}
          placeholder="Giocatore 1…"
          onChange={setP1}
        />
        <PlayerCombobox
          players={players}
          value={p2}
          excludeIds={p1 ? new Set([p1]) : undefined}
          placeholder="Giocatore 2…"
          onChange={setP2}
        />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" size="sm" disabled={pending}>
        <Users className="h-4 w-4" />
        {pending ? "Creazione…" : "Crea team"}
      </Button>
    </form>
  );
}
