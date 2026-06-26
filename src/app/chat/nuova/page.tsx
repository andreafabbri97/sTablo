import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAccountUsers, getFriends } from "@/lib/friends";
import { safe } from "@/lib/safe";
import {
  NewChatPicker,
  type MessageablePerson,
} from "@/components/chat/new-chat-picker";

export const metadata: Metadata = { title: "Nuova chat" };

export default function NewChatPage() {
  return (
    <Suspense fallback={<NewChatSkeleton />}>
      <NewChatContent />
    </Suspense>
  );
}

async function NewChatContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/chat/nuova");

  const [all, friends] = await Promise.all([
    safe(() => getAccountUsers(), []),
    safe(() => getFriends(user.id), []),
  ]);
  const friendIds = new Set(friends.map((f) => f.userId));
  // Everyone with a linked player (so they have a slug to message), minus me.
  const people: MessageablePerson[] = all
    .filter((u) => u.userId !== user.id && u.slug)
    .map((u) => ({
      userId: u.userId,
      name: u.name,
      username: u.username,
      slug: u.slug as string,
      avatarColor: u.avatarColor,
      avatarUrl: u.avatarUrl,
      isAdmin: u.isAdmin,
      isFriend: friendIds.has(u.userId),
    }));

  return <NewChatPicker people={people} />;
}

function NewChatSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2" aria-hidden>
      <div className="h-10 rounded-xl skeleton" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-2xl skeleton" />
      ))}
    </div>
  );
}
