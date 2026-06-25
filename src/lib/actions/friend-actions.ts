"use server";

import { revalidatePath } from "next/cache";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { friendships } from "@/lib/db/schema";
import { assertAuth } from "@/lib/auth-helpers";
import { getIncomingRequests, type FriendProfile } from "@/lib/friends";
import { notify } from "@/lib/notifications";
import type { ActionResult } from "./auth-actions";

/** Incoming pending requests for the current user (for the notification bell). */
export async function fetchIncomingRequests(): Promise<FriendProfile[]> {
  try {
    const user = await assertAuth();
    return await getIncomingRequests(user.id);
  } catch {
    return [];
  }
}

export async function sendFriendRequest(
  targetUserId: string,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  if (targetUserId === user.id) {
    return { ok: false, error: "Non puoi aggiungere te stesso" };
  }

  try {
    const existing = await db.query.friendships.findFirst({
      where: or(
        and(
          eq(friendships.requesterId, user.id),
          eq(friendships.addresseeId, targetUserId),
        ),
        and(
          eq(friendships.requesterId, targetUserId),
          eq(friendships.addresseeId, user.id),
        ),
      ),
    });

    if (existing) {
      if (existing.status === "accepted") {
        return { ok: false, error: "Siete già amici" };
      }
      // They already requested me → accept it.
      if (existing.addresseeId === user.id && existing.status === "pending") {
        await db
          .update(friendships)
          .set({ status: "accepted", respondedAt: new Date() })
          .where(eq(friendships.id, existing.id));
        revalidatePath("/amici");
        return { ok: true };
      }
      if (existing.status === "pending") {
        return { ok: false, error: "Richiesta già inviata" };
      }
      // declined previously → re-open
      await db
        .update(friendships)
        .set({
          requesterId: user.id,
          addresseeId: targetUserId,
          status: "pending",
          respondedAt: null,
        })
        .where(eq(friendships.id, existing.id));
      revalidatePath("/amici");
      await notifyFriendRequest(targetUserId, user.name);
      return { ok: true };
    }

    await db.insert(friendships).values({
      requesterId: user.id,
      addresseeId: targetUserId,
      status: "pending",
    });
    revalidatePath("/amici");
    await notifyFriendRequest(targetUserId, user.name);
    return { ok: true };
  } catch (error) {
    console.error("[sendFriendRequest]", error);
    return { ok: false, error: "Errore nell'invio della richiesta" };
  }
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  try {
    const row = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });
    if (!row || row.addresseeId !== user.id) {
      return { ok: false, error: "Richiesta non trovata" };
    }
    await db
      .update(friendships)
      .set({
        status: accept ? "accepted" : "declined",
        respondedAt: new Date(),
      })
      .where(eq(friendships.id, friendshipId));
    revalidatePath("/amici");
    return { ok: true };
  } catch (error) {
    console.error("[respondFriendRequest]", error);
    return { ok: false, error: "Errore nella risposta" };
  }
}

/** Best-effort push to the person who received a friend request. */
async function notifyFriendRequest(
  targetUserId: string,
  fromName?: string | null,
) {
  await notify({
    userIds: [targetUserId],
    kind: "friend_request",
    title: "Nuova richiesta di amicizia 👋",
    body: `${fromName?.trim() || "Un giocatore"} vuole aggiungerti agli amici`,
    url: "/amici",
    tag: "friend-request",
  });
}

export async function removeFriend(targetUserId: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  try {
    await db
      .delete(friendships)
      .where(
        or(
          and(
            eq(friendships.requesterId, user.id),
            eq(friendships.addresseeId, targetUserId),
          ),
          and(
            eq(friendships.requesterId, targetUserId),
            eq(friendships.addresseeId, user.id),
          ),
        ),
      );
    revalidatePath("/amici");
    return { ok: true };
  } catch (error) {
    console.error("[removeFriend]", error);
    return { ok: false, error: "Errore nella rimozione" };
  }
}
