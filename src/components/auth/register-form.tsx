"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/field";
import { registerUser } from "@/lib/actions/auth-actions";

export function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name")),
      username: String(form.get("username")).trim().toLowerCase(),
      password: String(form.get("password")),
      confirm: String(form.get("confirm")),
    };

    const res = await registerUser(payload);
    if (!res.ok) {
      setErrors({ [res.field ?? "form"]: res.error });
      setLoading(false);
      return;
    }

    await signIn("credentials", {
      username: payload.username,
      password: payload.password,
      redirect: false,
    });
    router.push("/profilo");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome</Label>
        <Input id="name" name="name" required placeholder="Andrea Rossi" autoComplete="name" />
        <FieldError>{errors.name}</FieldError>
      </div>
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" required placeholder="es. mesh" autoComplete="username" minLength={3} maxLength={20} />
        <FieldError>{errors.username}</FieldError>
        <p className="mt-1 text-xs text-muted">
          3-20 caratteri: lettere minuscole, numeri o underscore. Lo potrai cambiare dal profilo.
        </p>
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required placeholder="Almeno 8 caratteri" autoComplete="new-password" />
        <FieldError>{errors.password}</FieldError>
      </div>
      <div>
        <Label htmlFor="confirm">Conferma password</Label>
        <Input id="confirm" name="confirm" type="password" required placeholder="Ripeti la password" autoComplete="new-password" />
        <FieldError>{errors.confirm}</FieldError>
      </div>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <UserPlus className="h-4 w-4" />
        {loading ? "Creazione…" : "Crea profilo"}
      </Button>
      <p className="text-center text-sm text-muted">
        Hai già un account?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Accedi
        </Link>
      </p>
    </form>
  );
}
