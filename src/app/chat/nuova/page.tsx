import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAccountUsers } from "@/lib/friends";
import { safe } from "@/lib/safe";
import {
  NewChatPicker,
  type MessageablePerson,
} from "@/components/chat/new-chat-picker";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nuova chat" };

export default async function NewChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/chat/nuova");

  const all = await safe(() => getAccountUsers(), []);
  // Everyone with a linked player (so they have a slug to message), minus me.
  const people: MessageablePerson[] = all
    .filter((u) => u.userId !== user.id && u.slug)
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      slug: u.slug as string,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl,
    }));

  return <NewChatPicker people={people} />;
}
