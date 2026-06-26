"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, MessageCircle, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { playerInteractions } from "@/lib/actions/friend-actions";
import type { FriendState } from "@/lib/friends";

type Info = {
  canInteract: boolean;
  targetUserId: string | null;
  friendState: FriendState;
  viewerSlug: string | null;
};

/**
 * Viewer-specific actions on a player's public profile (edit / add friend /
 * message / head-to-head). Loaded on the client so the profile body can render
 * from cached data without waiting on the auth→friendship chain. `isOwner` is
 * known on the server (cheap) and passed in; everything else streams in here.
 */
export function PlayerProfileActions({
  playerId,
  playerSlug,
  isOwner,
}: {
  playerId: string;
  playerSlug: string;
  isOwner: boolean;
}) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    if (isOwner) return;
    let active = true;
    playerInteractions(playerId)
      .then((i) => active && setInfo(i))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [playerId, isOwner]);

  if (isOwner) {
    return (
      <Button asChild variant="secondary" size="sm">
        <Link href="/profilo">
          <Pencil className="h-4 w-4" /> Modifica
        </Link>
      </Button>
    );
  }

  if (!info?.canInteract || !info.targetUserId) return null;

  return (
    <div className="flex flex-col gap-2">
      <AddFriendButton targetUserId={info.targetUserId} state={info.friendState} />
      <Button asChild variant="outline" size="sm">
        <Link href={`/chat/${playerSlug}`}>
          <MessageCircle className="h-4 w-4" /> Messaggio
        </Link>
      </Button>
      {info.viewerSlug && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/giocatori/${info.viewerSlug}/vs/${playerSlug}`}>
            <Swords className="h-4 w-4" /> Testa a testa
          </Link>
        </Button>
      )}
    </div>
  );
}
