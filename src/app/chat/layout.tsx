import { ChatShell } from "@/components/chat/chat-shell";

/**
 * Shared shell for every `/chat` route: the conversation list alongside the
 * routed page — a two-column layout on desktop, one pane at a time on mobile.
 *
 * The layout is intentionally static so the shell chrome paints instantly under
 * Cache Components (no server `await` blocking navigation into /chat). The inbox
 * is loaded — and kept fresh — entirely client-side by ChatShell, which fetches
 * it on mount and polls; so we seed it empty here. Auth is enforced by the
 * individual pages (which keep their precise `callbackUrl`).
 */
export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatShell initialInbox={[]}>{children}</ChatShell>;
}
