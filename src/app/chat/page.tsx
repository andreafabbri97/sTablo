import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Messaggi" };

/**
 * The `/chat` index. The conversation list itself lives in the shell
 * (`ChatShell`), so on mobile this page's content is hidden and the list fills
 * the screen. On desktop it's the right-hand placeholder shown until you pick a
 * conversation.
 */
export default async function ChatIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/chat");

  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-xs">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
          <MessageCircle className="h-6 w-6" />
        </div>
        <h2 className="font-display text-lg font-bold">I tuoi messaggi</h2>
        <p className="mt-1 text-sm text-muted">
          Scegli una conversazione dalla lista oppure tocca «Nuova» per iniziarne
          una.
        </p>
      </div>
    </div>
  );
}
