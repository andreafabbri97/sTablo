import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { ChatThread } from "@/components/chat/chat-thread";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getThread, partnerBySlug } from "@/lib/chat";
import { safe } from "@/lib/safe";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const partner = await safe(() => partnerBySlug(slug), null);
  return { title: partner ? `Chat con ${partner.name}` : "Messaggi" };
}

export default function ChatThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<ChatThreadSkeleton />}>
      <ChatThreadContent params={params} />
    </Suspense>
  );
}

async function ChatThreadContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=/chat/${slug}`);

  const thread = await safe(() => getThread(user.id, slug), null);

  if (!thread) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <EmptyState
          icon={<MessageCircle className="h-6 w-6" />}
          title="Conversazione non disponibile"
          description="Questo giocatore non ha un account a cui scrivere, oppure il link non è valido."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/chat">Torna ai messaggi</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ChatThread
      meId={user.id}
      partner={thread.partner}
      otherSlug={slug}
      initialMessages={thread.messages}
      initialBlock={thread.block}
    />
  );
}

function ChatThreadSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3" aria-hidden>
      <div className="h-12 rounded-xl skeleton" />
      <div className="flex-1 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={i % 2 ? "ml-auto h-10 w-2/3 rounded-2xl skeleton" : "h-10 w-1/2 rounded-2xl skeleton"}
          />
        ))}
      </div>
      <div className="h-12 rounded-xl skeleton" />
    </div>
  );
}
