"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, FieldError } from "@/components/ui/field";
import { createPlayer } from "@/lib/actions/player-actions";

export function CreatePlayerForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      setError(null);
      const res = await createPlayer({
        name: String(form.get("name")),
        nickname: String(form.get("nickname") ?? ""),
      });
      if (!res.ok) setError(res.error);
      else {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="name" required placeholder="Nome e cognome" />
        <Input name="nickname" placeholder="Soprannome (opzionale)" />
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" size="sm" disabled={pending}>
        <UserPlus className="h-4 w-4" />
        {pending ? "Creazione…" : "Aggiungi giocatore"}
      </Button>
    </form>
  );
}
