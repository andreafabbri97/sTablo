"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus } from "lucide-react";

import { removeFriend } from "@/lib/actions/friend-actions";

/** Inline two-step "rimuovi amico" control (avoids accidental removals). */
export function RemoveFriendButton({ targetUserId }: { targetUserId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Rimuovi amico"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-loss"
      >
        <UserMinus className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await removeFriend(targetUserId);
            router.refresh();
          })
        }
        className="rounded-lg bg-loss px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
      >
        {pending ? "…" : "Rimuovi"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs font-bold text-muted"
      >
        Annulla
      </button>
    </div>
  );
}
