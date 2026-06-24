"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { respondFriendRequest } from "@/lib/actions/friend-actions";

export function RequestActions({ friendshipId }: { friendshipId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function respond(accept: boolean) {
    startTransition(async () => {
      await respondFriendRequest(friendshipId, accept);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => respond(true)}
        disabled={pending}
        className="flex items-center gap-1 rounded-lg bg-win px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" /> Accetta
      </button>
      <button
        onClick={() => respond(false)}
        disabled={pending}
        className="flex items-center gap-1 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-bold text-muted disabled:opacity-50"
      >
        <X className="h-3.5 w-3.5" /> Rifiuta
      </button>
    </div>
  );
}
