"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil, MessageCircle, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddFriendButton } from "@/components/friends/add-friend-button";
import { ShareButton } from "@/components/share-button";
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
 * message / head-to-head / share). Loaded on the client so the profile body can
 * render from cached data without waiting on the auth→friendship chain.
 * `isOwner` is known on the server (cheap) and passed in; everything else
 * streams in here. Share is always available (no auth needed) and shows
 * immediately; the friendship-dependent buttons appear once `info` resolves.
 * All buttons sit on a single wrapping row.
 */
export function PlayerProfileActions({
  playerId,
  playerSlug,
  playerName,
  isOwner,
}: {
  playerId: string;
  playerSlug: string;
  playerName: string;
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

  // Absolute URL for native share / clipboard. Resolved on the client; the SSR
  // fallback is a relative path (never used — sharing only happens on click).
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/giocatori/${playerSlug}`
      : `/giocatori/${playerSlug}`;

  const share = (
    <ShareButton
      url={shareUrl}
      title={isOwner ? "Il mio profilo su sTablo" : `${playerName} su sTablo`}
      text={
        isOwner
          ? "Aggiungimi su sTablo 🏓"
          : `Guarda il profilo di ${playerName} su sTablo 🏓`
      }
      label="Condividi profilo"
    />
  );

  const canInteract = !isOwner && info?.canInteract && info.targetUserId;

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
      {isOwner && (
        <Button asChild variant="secondary" size="sm">
          <Link href="/profilo">
            <Pencil className="h-4 w-4" /> Modifica
          </Link>
        </Button>
      )}

      {canInteract && (
        <>
          <AddFriendButton
            targetUserId={info!.targetUserId!}
            state={info!.friendState}
          />
          <Button asChild variant="outline" size="sm">
            <Link href={`/chat/${playerSlug}`}>
              <MessageCircle className="h-4 w-4" /> Messaggio
            </Link>
          </Button>
          {info!.viewerSlug && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/giocatori/${info!.viewerSlug}/vs/${playerSlug}`}>
                <Swords className="h-4 w-4" /> Testa a testa
              </Link>
            </Button>
          )}
        </>
      )}

      {share}
    </div>
  );
}
