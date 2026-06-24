"use client";

import { useRef, useState } from "react";
import { KeyRound, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { changePassword } from "@/lib/actions/player-actions";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await changePassword({
      currentPassword: String(form.get("currentPassword")),
      newPassword: String(form.get("newPassword")),
      confirm: String(form.get("confirm")),
    });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setSaved(true);
    formRef.current?.reset();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="currentPassword">Password attuale</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="newPassword">Nuova password</Label>
          <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" placeholder="Almeno 8 caratteri" />
        </div>
        <div>
          <Label htmlFor="confirm">Conferma</Label>
          <Input id="confirm" name="confirm" type="password" required autoComplete="new-password" placeholder="Ripeti" />
        </div>
      </div>
      <FieldError>{error}</FieldError>
      <Button type="submit" variant="secondary" disabled={loading}>
        {saved ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        {saved ? "Password aggiornata!" : loading ? "Aggiornamento…" : "Cambia password"}
      </Button>
    </form>
  );
}
