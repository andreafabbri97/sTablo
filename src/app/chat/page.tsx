import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getInbox } from "@/lib/chat";
import { safe } from "@/lib/safe";
import { cn, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messaggi" };

export default async function ChatInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/chat");

  const inbox = await safe(() => getInbox(user.id), []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<MessageCircle className="h-6 w-6" />}
        title="Messaggi"
        subtitle="Le tue conversazioni con gli altri giocatori"
        help="chat"
      />

      {inbox.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Nessun messaggio"
          description="Apri il profilo di un giocatore e tocca «Messaggio» per iniziare a chattare."
        />
      ) : (
        <ul className="space-y-2">
          {inbox.map((it) => {
            const preview = it.lastMessageBody
              ? `${it.lastFromMe ? "Tu: " : ""}${it.lastMessageBody}`
              : "Conversazione iniziata";
            const row = (
              <div
                className={cn(
                  "card-surface flex items-center gap-3 p-3 transition hover:opacity-90",
                  it.unread && "ring-1 ring-brand/40",
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
                        it.unread ? "font-semibold text-foreground" : "text-muted",
                      )}
                    >
                      {preview}
                    </p>
                    {it.unread && (
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand"
                        aria-label="Non letto"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={it.partner.userId}>
                {it.partner.slug ? (
                  <Link href={`/chat/${it.partner.slug}`} className="block">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
