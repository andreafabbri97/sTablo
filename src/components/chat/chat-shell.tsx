"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenSquare, Search } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { HelpButton } from "@/components/help/help-button";
import { cn, timeAgo } from "@/lib/utils";
import type { InboxItem } from "@/lib/chat-core";
import { fetchInbox } from "@/lib/actions/chat-actions";

/** How often the conversation list refreshes itself while the tab is visible. */
const INBOX_POLL_MS = 20000;

/**
 * Track the on-screen keyboard height via the VisualViewport API, as a pixel
 * number (0 when closed or unsupported). We deliberately keep the layout
 * viewport at its default and shrink the thread ourselves: this behaves
 * predictably across iOS Safari and Android Chrome, where `100dvh` alone does
 * not react to the keyboard. The result is published as the `--kb` custom
 * property so CSS can subtract it from the panel height.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const next = Math.max(
        0,
        Math.round(window.innerHeight - vv.height - vv.offsetTop),
      );
      // Ignore a few px of rounding noise so we don't re-render on every tick.
      setInset((prev) => (Math.abs(prev - next) > 8 ? next : prev));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

type Props = {
  initialInbox: InboxItem[];
  children: React.ReactNode;
};

/**
 * Responsive shell for the whole `/chat` area. On desktop it's a two-column
 * layout — the conversation list on the left, the active thread (or the new-chat
 * picker / a placeholder) on the right. On mobile it shows one pane at a time:
 * the list on `/chat`, the thread/picker on the deeper routes. The list pane
 * carries the search box and the "Nuova" button and keeps itself fresh by
 * polling the inbox; the right pane simply renders the routed page.
 */
export function ChatShell({ initialInbox, children }: Props) {
  const pathname = usePathname();
  const isIndex = pathname === "/chat";
  // The active conversation's slug, or null on the index / new-chat picker.
  // `/chat/nuova` is the picker route, not a partner slug, so it highlights
  // nothing.
  const activeSlug =
    pathname.startsWith("/chat/") && pathname !== "/chat/nuova"
      ? decodeURIComponent(pathname.slice("/chat/".length).split("/")[0] ?? "")
      : null;

  const [inbox, setInbox] = useState<InboxItem[]>(initialInbox);
  const [query, setQuery] = useState("");
  const kb = useKeyboardInset();

  // Keep the conversation list fresh without a full navigation: poll while the
  // tab is visible, refresh when it regains focus, and — because the effect
  // re-runs on every route change — refresh right after switching conversation,
  // so a row you just opened drops its unread mark promptly. `load` awaits the
  // server action before it ever setStates (no cascading render), and a cancel
  // flag drops any in-flight result once the effect tears down.
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const load = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const next = await fetchInbox();
        if (!cancelled) setInbox(next);
      } catch {
        // a dropped refresh is harmless — the next tick recovers
      } finally {
        busy = false;
      }
    };
    void load();
    const id = window.setInterval(load, INBOX_POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [pathname]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((it) => it.partner.name.toLowerCase().includes(q));
  }, [inbox, query]);

  return (
    <div
      className="lg:-mx-4 lg:flex lg:h-[calc(100dvh_-_8.5rem)] lg:gap-4"
      style={{ "--kb": `${kb}px` } as CSSProperties}
    >
      {/* List pane — full width on mobile `/chat`, a fixed sidebar on desktop. */}
      <aside
        className={cn(
          "min-h-0 flex-col",
          isIndex ? "flex" : "hidden lg:flex",
          "lg:h-full lg:w-80 lg:shrink-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card",
        )}
      >
        <div className="flex items-center gap-2 lg:px-3 lg:pt-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight lg:text-xl">
            Messaggi
          </h1>
          <HelpButton topic="chat" className="shrink-0" />
          <Link
            href="/chat/nuova"
            className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white shadow-[var(--shadow-brand)] transition hover:brightness-105"
          >
            <PenSquare className="h-4 w-4" />
            <span>Nuova</span>
          </Link>
        </div>

        <div className="relative mt-3 lg:px-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted lg:left-6" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca una conversazione…"
            aria-label="Cerca una conversazione"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand"
          />
        </div>

        <div className="mt-3 space-y-1.5 lg:flex-1 lg:overflow-y-auto lg:px-3 lg:pb-3">
          {filtered.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-muted">
              {inbox.length === 0
                ? "Nessuna conversazione. Tocca «Nuova» per scrivere a qualcuno."
                : "Nessun risultato."}
            </p>
          ) : (
            filtered.map((it) => {
              const preview = it.lastMessageBody
                ? `${it.lastFromMe ? "Tu: " : ""}${it.lastMessageBody}`
                : "Conversazione iniziata";
              const active =
                activeSlug != null && it.partner.slug === activeSlug;
              const content = (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border p-3 transition",
                    active
                      ? "border-brand/40 bg-brand-soft"
                      : "border-border bg-card hover:bg-surface-2",
                    it.unread && !active && "ring-1 ring-brand/40",
                  )}
                >
                  <Avatar
                    name={it.partner.name}
                    colorIndex={it.partner.avatarColor}
                    imageUrl={it.partner.avatarUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold">
                        {it.partner.name}
                      </p>
                      <span className="shrink-0 text-xs text-muted">
                        {timeAgo(it.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          it.unread
                            ? "font-semibold text-foreground"
                            : "text-muted",
                        )}
                      >
                        {preview}
                      </p>
                      {it.unread && !active && (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
                          aria-label="Non letto"
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
              return it.partner.slug ? (
                <Link
                  key={it.partner.userId}
                  href={`/chat/${it.partner.slug}`}
                  className="block"
                >
                  {content}
                </Link>
              ) : (
                <div key={it.partner.userId}>{content}</div>
              );
            })
          )}
        </div>
      </aside>

      {/* Detail pane — the routed page (thread / picker / placeholder). On mobile
          it fills the screen below the header, minus any open keyboard (`--kb`). */}
      <section
        className={cn(
          "min-h-0 flex-col bg-card",
          isIndex ? "hidden lg:flex" : "flex",
          // Break out of <main>'s padding so the pane is full-bleed below the
          // header. The bottom cancel must match main's bottom padding, which
          // differs by breakpoint (pb-28 on phones, pb-12 from md up — the
          // mobile bottom-nav is gone by then), or the composer floats off the
          // bottom edge.
          "max-lg:-mx-4 max-lg:-mt-6 max-md:-mb-28 md:max-lg:-mb-12",
          "max-lg:h-[calc(100dvh_-_4rem_-_env(safe-area-inset-top)_-_var(--kb))]",
          "lg:h-full lg:min-w-0 lg:flex-1 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border",
        )}
      >
        {children}
      </section>
    </div>
  );
}
