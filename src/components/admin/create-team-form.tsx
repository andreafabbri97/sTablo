"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, FieldError } from "@/components/ui/field";
import { createTeam } from "@/lib/actions/player-actions";

type Option = { id: string; name: string };

export function CreateTeamForm({ players }: { players: Option[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        <Select
          value={p1}
          onChange={(e) => setP1(e.target.value)}
          required
          aria-label="Giocatore 1"
        >
          <option value="">Giocatore 1…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <Select
          value={p2}
          onChange={(e) => setP2(e.target.value)}
          required
          aria-label="Giocatore 2"
        >
          <option value="">Giocatore 2…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" size="sm" disabled={pending}>
        <Users className="h-4 w-4" />
        {pending ? "Creazione…" : "Crea team"}
      </Button>
    </form>
  );
}
