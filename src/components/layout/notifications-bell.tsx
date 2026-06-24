"use client";

import { useState, useEffect, useRef, useTransition, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, Check, X, Clock, Swords } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { respondFriendRequest } from "@/lib/actions/friend-actions";
import {
  fetchNotifications,
  type Notifications,
} from "@/lib/actions/notification-actions";

export function NotificationsBell() {
  const { status } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Notifications>({
    friendRequests: [],
    pendingMatches: [],
    tournamentInvites: [],
  });
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    fetchNotifications().then(setData).catch(() => {});
  }, []);

  // Refetch on auth and whenever the route changes (e.g. after confirming a
  // match elsewhere), so the badge count never goes stale.
  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load, pathname]);

  // Keep fresh while the tab is open: poll lightly and on tab re-focus,
  // but only when the page is actually visible.
  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(onVisible, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [status, load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  if (status !== "authenticated") return null;

  const count =
    data.friendRequests.length +
    data.pendingMatches.length +
    data.tournamentInvites.length;

  function respond(id: string, accept: boolean) {
    startTransition(async () => {
      await respondFriendRequest(id, accept);
      setData((d) => ({
        ...d,
        friendRequests: d.friendRequests.filter((i) => i.friendshipId !== id),
      }));
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
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-72 animate-scale-in rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-lg)]">
          {data.pendingMatches.length > 0 && (
            <>
              <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Risultati da confermare
              </p>
              <ul className="space-y-1">
                {data.pendingMatches.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/partite/${m.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-surface-2"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Clock className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{m.label}</span>
                      <span className="text-xs font-semibold text-brand">Conferma</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {data.friendRequests.length > 0 && (
            <>
              <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Richieste di amicizia
              </p>
              <ul className="space-y-1">
                {data.friendRequests.map((it) => (
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
            </>
          )}

          {data.tournamentInvites.length > 0 && (
            <>
              <p className="px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                Inviti ai tornei
              </p>
              <ul className="space-y-1">
                {data.tournamentInvites.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.token ? `/tornei/invito/${t.token}` : `/tornei/${t.slug}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm hover:bg-surface-2"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                        <Swords className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.name}</span>
                      <span className="text-xs font-semibold text-brand">Unisciti</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {count === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted">
              Nessuna notifica
            </p>
          )}

          <Link href="/amici" onClick={() => setOpen(false)} className="mt-1 block rounded-xl px-2 py-2 text-center text-sm font-semibold text-brand hover:bg-surface-2">
            Vedi amici
          </Link>
        </div>
      )}
    </div>
  );
}
