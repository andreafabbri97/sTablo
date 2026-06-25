import { getCurrentUser } from "@/lib/auth-helpers";
import { getInbox } from "@/lib/chat";
import { safe } from "@/lib/safe";
import { ChatShell } from "@/components/chat/chat-shell";

export const dynamic = "force-dynamic";

/**
 * Shared shell for every `/chat` route. It loads the inbox once and hands it to
 * the (client) shell, which renders the conversation list alongside the routed
 * page — a two-column layout on desktop, one pane at a time on mobile. The list
 * keeps itself fresh by polling, so navigating between threads doesn't refetch
 * it here. Auth is enforced by the individual pages (which keep their precise
 * `callbackUrl`); we just skip the inbox query when there's no user.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const inbox = user ? await safe(() => getInbox(user.id), []) : [];
  return <ChatShell initialInbox={inbox}>{children}</ChatShell>;
}
