"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { MessageCircle } from "lucide-react";
import { useHeaderData } from "./header-data";

/**
 * Header entry point to the chat. The unread count comes from the shared
 * <HeaderDataProvider> (one combined fetch with the notifications bell) rather
 * than its own poll. The open thread does its own fast (3s) polling, so this
 * badge just needs to feel fresh — the provider refreshes it on navigation, on
 * tab re-focus, and on a light background timer.
 */
export function MessagesButton() {
  const { status } = useSession();
  const { unreadMessages: count } = useHeaderData();

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
