"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bell, Check, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  fetchIncomingRequests,
  respondFriendRequest,
} from "@/lib/actions/friend-actions";
import type { FriendProfile } from "@/lib/friends";

export function NotificationsBell() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FriendProfile[]>([]);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchIncomingRequests().then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (status !== "authenticated") return null;

  function respond(id: string, accept: boolean) {
    startTransition(async () => {
      await respondFriendRequest(id, accept);
      setItems((prev) => prev.filter((i) => i.friendshipId !== id));
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((v) => !v);
          load();
        }}
        aria-label="Notifiche"
        className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface/60 text-foreground transition hover:bg-surface"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 animate-scale-in rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-lg)]">
          <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            Richieste di amicizia
          </p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-muted">
              Nessuna nuova richiesta
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((it) => (
                <li key={it.friendshipId} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-2">
                  <Avatar name={it.name} colorIndex={it.avatarColor} size="xs" />
                  <span className="flex-1 truncate text-sm font-medium">{it.name}</span>
                  <button onClick={() => respond(it.friendshipId, true)} className="grid h-7 w-7 place-items-center rounded-lg bg-win text-white" aria-label="Accetta">
                    <Check className="h-4 w-4" />
                  </button>
                  <button onClick={() => respond(it.friendshipId, false)} className="grid h-7 w-7 place-items-center rounded-lg bg-surface-2 text-muted" aria-label="Rifiuta">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/amici" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center text-sm font-semibold text-brand hover:bg-surface-2">
            Vedi tutti gli amici
          </Link>
        </div>
      )}
    </div>
  );
}
