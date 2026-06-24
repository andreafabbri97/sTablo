"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserPlus, Check, Clock, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendFriendRequest } from "@/lib/actions/friend-actions";
import type { FriendState } from "@/lib/friends";

export function AddFriendButton({
  targetUserId,
  state,
}: {
  targetUserId: string;
  state: FriendState;
}) {
  const [current, setCurrent] = useState<FriendState>(state);
  const [pending, startTransition] = useTransition();

  if (current === "self" || current === "no-account") return null;

  if (current === "friends") {
    return (
      <Button variant="secondary" size="sm" disabled>
        <Check className="h-4 w-4" /> Amici
      </Button>
    );
  }

  if (current === "outgoing") {
    return (
      <Button variant="outline" size="sm" disabled>
        <Clock className="h-4 w-4" /> Richiesta inviata
      </Button>
    );
  }

  if (current === "incoming") {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link href="/amici">
          <Inbox className="h-4 w-4" /> Rispondi
        </Link>
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await sendFriendRequest(targetUserId);
          if (res.ok) setCurrent("outgoing");
        })
      }
    >
      <UserPlus className="h-4 w-4" />
      {pending ? "…" : "Aggiungi amico"}
    </Button>
  );
}
