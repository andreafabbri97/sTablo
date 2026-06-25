"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationsRead } from "@/lib/actions/notification-actions";

/**
 * Marks the whole feed read once the /notifiche page is on screen, then nudges
 * the router so the bell's unread pill refreshes. Runs after render, so the
 * "unread" highlights are still visible on this visit and cleared on the next.
 */
export function MarkReadOnView() {
  const router = useRouter();
  useEffect(() => {
    markNotificationsRead()
      .then(() => router.refresh())
      .catch(() => {});
  }, [router]);
  return null;
}
