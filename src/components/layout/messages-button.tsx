"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { fetchUnreadMessageCount } from "@/lib/actions/chat-actions";

/**
 * Header entry point to the chat. Mirrors <NotificationsBell>: a light unread
 * poll that only runs while authenticated and the tab is visible. The open
 * thread does its own fast (3s) polling, so this badge just needs to feel fresh.
 */
export function MessagesButton() {
  const { status } = useSession();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    fetchUnreadMessageCount().then(setCount).catch(() => {});
  }, []);

  // Refetch on auth and on every route change (so the badge clears right after
  // you read a conversation and navigate away).
  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load, pathname]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(onVisible, 25_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [status, load]);

  if (status !== "authenticated") return null;

  return (
    <Link
      href="/chat"
      aria-label={count > 0 ? `Messaggi (${count} non letti)` : "Messaggi"}
      className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface/60 text-foreground transition hover:bg-surface"
    >
      <MessageCircle className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
