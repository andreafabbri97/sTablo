"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  fetchHeaderState,
  type HeaderState,
} from "@/lib/actions/header-actions";
import type { Notifications } from "@/lib/actions/notification-actions";

const EMPTY: HeaderState = {
  notifications: {
    friendRequests: [],
    pendingMatches: [],
    tournamentInvites: [],
    feedUnread: 0,
  },
  unreadMessages: 0,
};

type HeaderDataValue = {
  notifications: Notifications;
  unreadMessages: number;
  /** Force an immediate refetch (e.g. when the bell dropdown opens). */
  refresh: () => void;
  /** Optimistically patch the notifications slice (e.g. after answering a request). */
  patchNotifications: (update: (n: Notifications) => Notifications) => void;
};

const HeaderDataContext = createContext<HeaderDataValue>({
  notifications: EMPTY.notifications,
  unreadMessages: EMPTY.unreadMessages,
  refresh: () => {},
  patchNotifications: () => {},
});

/**
 * Single source of truth for the header badges. The notifications bell and the
 * messages button used to each fire their own server action — and their own
 * auth check — on every navigation and on their own poll timers. This provider
 * fetches both in one round-trip (see fetchHeaderState) and shares the result,
 * so a navigation costs one request instead of two and the blocked-account
 * lookup runs once per request, not once per badge.
 */
export function HeaderDataProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const pathname = usePathname();
  const [state, setState] = useState<HeaderState>(EMPTY);

  const refresh = useCallback(() => {
    fetchHeaderState()
      .then(setState)
      .catch(() => {});
  }, []);

  const patchNotifications = useCallback(
    (update: (n: Notifications) => Notifications) =>
      setState((s) => ({ ...s, notifications: update(s.notifications) })),
    [],
  );

  // Refetch on sign-in and on every route change, so a badge never goes stale
  // after you act elsewhere (confirm a match, read a chat, …).
  useEffect(() => {
    if (status === "authenticated") refresh();
  }, [status, refresh, pathname]);

  // Keep fresh while the tab is open: one light combined poll, plus an instant
  // refresh whenever the tab regains focus. Only while actually visible.
  useEffect(() => {
    if (status !== "authenticated") return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(onVisible, 45_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [status, refresh]);

  return (
    <HeaderDataContext.Provider
      value={{
        notifications: state.notifications,
        unreadMessages: state.unreadMessages,
        refresh,
        patchNotifications,
      }}
    >
      {children}
    </HeaderDataContext.Provider>
  );
}

export function useHeaderData() {
  return useContext(HeaderDataContext);
}
