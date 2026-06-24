import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { RegisterForm } from "@/components/auth/register-form";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Registrati" };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/profilo");

  return (
    <div className="mx-auto flex max-w-md flex-col items-center pt-6">
      <Logo withWordmark className="mb-6 scale-110" />
      <div className="w-full card-surface p-6 sm:p-8 animate-scale-in">
        <h1 className="mb-1 font-display text-2xl font-extrabold">
          Entra in campo
        </h1>
        <p className="mb-6 text-sm text-muted">
          Crea il tuo profilo giocatore e inizia a scalare la classifica.
        </p>
        <RegisterForm />
      </div>
    </div>
  );
}
