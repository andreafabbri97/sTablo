"use client";

import { useState, useTransition } from "react";
import {
  KeyRound,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  Loader2,
  Ban,
  LockOpen,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resetUserPasswordToTemp,
  setUserRole,
  setUserBlocked,
} from "@/lib/actions/account-actions";

export type Account = {
  userId: string;
  name: string | null;
  username: string | null;
  role: "admin" | "player";
  blocked: boolean;
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

  function onToggleBlock() {
    setError(null);
    startTransition(async () => {
      const res = await setUserBlocked(account.userId, !account.blocked);
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
    <li
      className={cn(
        "rounded-xl border p-3",
        account.blocked ? "border-loss/40 bg-loss/5" : "border-border bg-surface",
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(account.blocked && "opacity-60")}>
          <Avatar
            name={label}
            colorIndex={account.avatarColor ?? 0}
            imageUrl={account.avatarUrl}
            size="xs"
          />
        </div>
        <div className={cn("min-w-0 flex-1", account.blocked && "opacity-60")}>
          <p className="truncate text-sm font-semibold">{label}</p>
          {account.username && (
            <p className="truncate text-xs text-muted">@{account.username}</p>
          )}
        </div>
        {account.blocked && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-loss/15 px-2 py-0.5 text-[11px] font-bold text-loss">
            <Ban className="h-3 w-3" /> Bloccato
          </span>
        )}
        <span
          className={
            account.role === "admin"
              ? "shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[11px] font-bold text-brand"
              : "shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted"
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
        {!isSelf && !account.blocked && (
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
        {/* A blocked row shows only Reset + Sblocca: hiding the role toggle keeps
            anyone from promoting a blocked account into an admin who can't log
            in. Unblock is offered for ANY blocked account (even an edge-case
            blocked admin) so nobody can get permanently stuck; Block is offered
            only for a non-admin, not-already-blocked row. */}
        {!isSelf && account.blocked ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onToggleBlock}
            disabled={pending}
          >
            <LockOpen className="h-3.5 w-3.5" /> Sblocca profilo
          </Button>
        ) : (
          !isSelf &&
          account.role !== "admin" && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onToggleBlock}
              disabled={pending}
            >
              <Ban className="h-3.5 w-3.5" /> Blocca profilo
            </Button>
          )
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
