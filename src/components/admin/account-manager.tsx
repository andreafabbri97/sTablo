"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  resetUserPasswordToTemp,
  setUserRole,
} from "@/lib/actions/account-actions";

export type Account = {
  userId: string;
  name: string | null;
  username: string | null;
  role: "admin" | "player";
  slug: string | null;
  avatarColor: number | null;
  avatarUrl: string | null;
};

export function AccountManager({
  accounts,
  currentUserId,
}: {
  accounts: Account[];
  currentUserId: string;
}) {
  if (accounts.length === 0) {
    return <p className="text-sm text-muted">Nessun account registrato.</p>;
  }
  return (
    <ul className="space-y-2">
      {accounts.map((a) => (
        <AccountRow key={a.userId} account={a} isSelf={a.userId === currentUserId} />
      ))}
    </ul>
  );
}

function AccountRow({ account, isSelf }: { account: Account; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [temp, setTemp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const label = account.name?.trim() || account.username?.trim() || "Account";

  function onReset() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await resetUserPasswordToTemp(account.userId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTemp(res.password);
    });
  }

  function onToggleRole() {
    setError(null);
    startTransition(async () => {
      const res = await setUserRole(account.userId, account.role !== "admin");
      if (!res.ok) setError(res.error);
    });
  }

  async function copy() {
    if (!temp) return;
    try {
      await navigator.clipboard.writeText(temp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be blocked — the password is shown anyway */
    }
  }

  return (
    <li className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <Avatar
          name={label}
          colorIndex={account.avatarColor ?? 0}
          imageUrl={account.avatarUrl}
          size="xs"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{label}</p>
          {account.username && (
            <p className="truncate text-xs text-muted">@{account.username}</p>
          )}
        </div>
        <span
          className={
            account.role === "admin"
              ? "rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand"
              : "rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted"
          }
        >
          {account.role === "admin" ? "Admin" : "Giocatore"}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onReset}
          disabled={pending}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <KeyRound className="h-3.5 w-3.5" />
          )}
          Reset password
        </Button>
        {!isSelf && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleRole}
            disabled={pending}
          >
            {account.role === "admin" ? (
              <>
                <ShieldOff className="h-3.5 w-3.5" /> Rendi giocatore
              </>
            ) : (
              <>
                <ShieldCheck className="h-3.5 w-3.5" /> Rendi admin
              </>
            )}
          </Button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-loss">{error}</p>}

      {temp && (
        <div className="mt-2 rounded-lg border border-brand bg-brand-soft p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Password temporanea — comunicala a {label}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 select-all rounded bg-surface px-2 py-1 font-mono text-sm font-bold">
              {temp}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs font-semibold transition hover:bg-surface-2"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-win" /> Copiato
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copia
                </>
              )}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Dovrà cambiarla dal proprio profilo, sezione Sicurezza.
          </p>
        </div>
      )}
    </li>
  );
}
