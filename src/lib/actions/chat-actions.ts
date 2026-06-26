"use server";

import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { conversations, directMessages, userBlocks } from "@/lib/db/schema";
import { messageSchema, voiceMessageSchema } from "@/lib/validation";
import { assertAuth } from "@/lib/auth-helpers";
import { rateLimit, retryAfterSeconds, RATE_LIMITS } from "@/lib/rate-limit";
import { sendPushToUser } from "@/lib/push";
import { getPlayerSlugById } from "@/lib/queries";
import {
  canonicalPair,
  type ChatMessageView,
  type BlockState,
  type InboxItem,
} from "@/lib/chat-core";
import {
  partnerBySlug,
  getBlockState,
  findConversation,
  unreadMessageCount,
  getInbox,
} from "@/lib/chat";
import type { ActionResult } from "./auth-actions";

/**
 * 1:1 chat mutations. All return small, explicit result objects (no thrown
 * errors across the server-action boundary) so the client can show a friendly
 * message. The conversation is keyed by a canonical user pair (userAId <
 * userBId), so "A → B" and "B → A" always resolve to the same row.
 */

/** Result of sending a message — carries the persisted row for optimistic UI. */
export type SendResult =
  | { ok: true; message: ChatMessageView; conversationId: string }
  | { ok: false; error: string };

/** Result of a poll — new messages, block state, and the partner's read marker
 *  (so the "Consegnato / Letto" receipt updates as they read). */
export type PollResult =
  | {
      ok: true;
      messages: ChatMessageView[];
      block: BlockState;
      partnerLastReadAt: Date | null;
    }
  | { ok: false; error: string };

/** Push body preview cap — keep notifications short and tidy. */
const PUSH_BODY_MAX = 140;

/** uuid guard — a malformed literal against a uuid column throws, so gate first. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send a direct message to the player behind `otherSlug`. Validates, rate-limits
 * (generous, ~1/s), refuses if either side has blocked the other, finds-or-
 * creates the conversation, persists the message, refreshes the denormalized
 * preview, and best-effort pushes the recipient. Returns the saved message so
 * the client can reconcile its optimistic bubble.
 */
export async function sendMessage(
  otherSlug: string,
  input: unknown,
): Promise<SendResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per scrivere" };
  }

  const limit = await rateLimit(`message:${user.id}`, RATE_LIMITS.message);
  if (!limit.ok) {
    return {
      ok: false,
      error: `Stai scrivendo troppo in fretta. Aspetta ${retryAfterSeconds(
        limit.retryAfterMs,
      )} secondi.`,
    };
  }

  // A message is either text ({ body }) or a voice note ({ audio, duration }).
  const isVoice =
    typeof input === "object" && input !== null && "audio" in input;
  let body: string;
  let audioUrl: string | null = null;
  let audioDuration: number | null = null;
  let preview: string;
  if (isVoice) {
    const parsed = voiceMessageSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Vocale non valido",
      };
    }
    body = "";
    audioUrl = parsed.data.audio;
    audioDuration = parsed.data.duration;
    preview = "🎤 Messaggio vocale";
  } else {
    const parsed = messageSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Messaggio non valido",
      };
    }
    body = parsed.data.body;
    preview = body;
  }

  const partner = await partnerBySlug(otherSlug);
  if (!partner) {
    return { ok: false, error: "Questo giocatore non ha un account a cui scrivere" };
  }
  if (partner.userId === user.id) {
    return { ok: false, error: "Non puoi scrivere a te stesso" };
  }

  const block = await getBlockState(user.id, partner.userId);
  if (block.iBlocked) {
    return { ok: false, error: "Hai bloccato questa persona. Sbloccala per scriverle." };
  }
  if (block.blockedMe) {
    return { ok: false, error: "Non puoi scrivere a questa persona." };
  }

  const { userAId, userBId } = canonicalPair(user.id, partner.userId);

  try {
    // Find-or-create the conversation. The unique pair index makes the create
    // race-safe: a concurrent insert hits onConflictDoNothing, and we re-read.
    let convoId: string;
    const existing = await findConversation(user.id, partner.userId);
    if (existing) {
      convoId = existing.id;
    } else {
      // Create just the container here; the denormalized preview is set in the
      // transaction below alongside the first message. (Setting it here would be
      // redundant on the happy path and would leave a "ghost" preview with no
      // message if the insert below failed.)
      const inserted = await db
        .insert(conversations)
        .values({ userAId, userBId })
        .onConflictDoNothing({
          target: [conversations.userAId, conversations.userBId],
        })
        .returning({ id: conversations.id });
      if (inserted[0]) {
        convoId = inserted[0].id;
      } else {
        const again = await findConversation(user.id, partner.userId);
        if (!again) {
          return { ok: false, error: "Non è stato possibile aprire la conversazione" };
        }
        convoId = again.id;
      }
    }

    // Persist the message and refresh the denormalized preview atomically, so
    // the inbox/badge can never disagree with the actual messages (e.g. a
    // message that saved but whose preview update failed). Also advance my own
    // read marker — I've obviously read my own message — using the message's
    // exact timestamp so the unread maths stay consistent.
    const isA = userAId === user.id;
    const message = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(directMessages)
        .values({
          conversationId: convoId,
          senderId: user.id,
          body,
          audioUrl,
          audioDuration,
        })
        .returning({
          id: directMessages.id,
          senderId: directMessages.senderId,
          body: directMessages.body,
          createdAt: directMessages.createdAt,
          audioDuration: directMessages.audioDuration,
        });
      const msg = inserted[0];
      await tx
        .update(conversations)
        .set({
          lastMessageAt: msg.createdAt,
          lastMessageBody: preview,
          lastMessageSenderId: user.id,
          ...(isA
            ? { aLastReadAt: msg.createdAt }
            : { bLastReadAt: msg.createdAt }),
        })
        .where(eq(conversations.id, convoId));
      return msg;
    });

    // Best-effort push to the recipient, deep-linking to the thread with me.
    try {
      const mySlug = user.playerId
        ? await getPlayerSlugById(user.playerId)
        : null;
      await sendPushToUser(partner.userId, {
        title: `💬 ${user.name?.trim() || "Nuovo messaggio"}`,
        body:
          preview.length > PUSH_BODY_MAX
            ? `${preview.slice(0, PUSH_BODY_MAX)}…`
            : preview,
        url: mySlug ? `/chat/${mySlug}` : "/chat",
        tag: `chat:${convoId}`,
      });
    } catch (err) {
      console.error("[sendMessage] push saltato:", err);
    }

    return { ok: true, message, conversationId: convoId };
  } catch (err) {
    console.error("[sendMessage] errore:", err);
    return { ok: false, error: "Non è stato possibile inviare il messaggio" };
  }
}

/**
 * Fetch messages newer than `afterIso` (or the whole window when omitted) plus
 * the current block state. Read-only — the client calls `markConversationRead`
 * separately. Safe to call on a short interval while the thread is open.
 */
export async function pollConversation(
  otherSlug: string,
  afterIso?: string | null,
): Promise<PollResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per continuare" };
  }

  const partner = await partnerBySlug(otherSlug);
  if (!partner || partner.userId === user.id) {
    return { ok: false, error: "Conversazione non trovata" };
  }

  const block = await getBlockState(user.id, partner.userId);
  const convo = await findConversation(user.id, partner.userId);
  if (!convo) {
    return { ok: true, messages: [], block, partnerLastReadAt: null };
  }
  const partnerLastReadAt =
    convo.userAId === partner.userId ? convo.aLastReadAt : convo.bLastReadAt;

  let after: Date | null = null;
  if (afterIso) {
    const d = new Date(afterIso);
    if (!Number.isNaN(d.getTime())) after = d;
  }

  const messages = await db
    .select({
      id: directMessages.id,
      senderId: directMessages.senderId,
      body: directMessages.body,
      createdAt: directMessages.createdAt,
      audioDuration: directMessages.audioDuration,
    })
    .from(directMessages)
    .where(
      after
        ? and(
            eq(directMessages.conversationId, convo.id),
            gt(directMessages.createdAt, after),
          )
        : eq(directMessages.conversationId, convo.id),
    )
    .orderBy(asc(directMessages.createdAt))
    .limit(200);

  return { ok: true, messages, block, partnerLastReadAt };
}

/** Advance the viewer's read marker to now, clearing the unread badge. */
export async function markConversationRead(otherSlug: string): Promise<void> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return;
  }
  const partner = await partnerBySlug(otherSlug);
  if (!partner) return;
  const convo = await findConversation(user.id, partner.userId);
  if (!convo) return;
  const isA = convo.userAId === user.id;
  // Mark read up to the conversation's last message (the DB-sourced timestamp),
  // NOT wall-clock now: this avoids any App↔DB clock skew that could otherwise
  // leave the unread badge stuck on a conversation you've just opened.
  const readAt = convo.lastMessageAt;
  await db
    .update(conversations)
    .set(isA ? { aLastReadAt: readAt } : { bLastReadAt: readAt })
    .where(eq(conversations.id, convo.id))
    .catch(() => {});
}

/**
 * Fetch a voice note's audio (a data-URL) on demand. The thread/poll reads
 * never carry the audio (it's large), so the player presses play and this
 * returns it. Only a participant of the message's conversation may read it.
 */
export async function getMessageAudio(
  messageId: string,
): Promise<{ ok: true; audio: string } | { ok: false; error: string }> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  if (!UUID_RE.test(messageId)) {
    return { ok: false, error: "Messaggio non valido" };
  }
  const rows = await db
    .select({
      audioUrl: directMessages.audioUrl,
      userAId: conversations.userAId,
      userBId: conversations.userBId,
    })
    .from(directMessages)
    .innerJoin(
      conversations,
      eq(directMessages.conversationId, conversations.id),
    )
    .where(eq(directMessages.id, messageId))
    .limit(1);
  const row = rows[0];
  if (!row || (row.userAId !== user.id && row.userBId !== user.id)) {
    return { ok: false, error: "Vocale non trovato" };
  }
  if (!row.audioUrl) return { ok: false, error: "Nessun audio" };
  return { ok: true, audio: row.audioUrl };
}

/** Block the player behind `otherSlug` — hides them and forbids messaging both ways. */
export async function blockUser(otherSlug: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per continuare" };
  }
  const partner = await partnerBySlug(otherSlug);
  if (!partner) return { ok: false, error: "Utente non trovato" };
  if (partner.userId === user.id) {
    return { ok: false, error: "Non puoi bloccare te stesso" };
  }
  try {
    await db
      .insert(userBlocks)
      .values({ blockerId: user.id, blockedId: partner.userId })
      .onConflictDoNothing({
        target: [userBlocks.blockerId, userBlocks.blockedId],
      });
  } catch (err) {
    console.error("[blockUser] errore:", err);
    return { ok: false, error: "Non è stato possibile bloccare" };
  }
  return { ok: true };
}

/** Remove a block the viewer previously placed on `otherSlug`. */
export async function unblockUser(otherSlug: string): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere per continuare" };
  }
  const partner = await partnerBySlug(otherSlug);
  if (!partner) return { ok: false, error: "Utente non trovato" };
  try {
    await db
      .delete(userBlocks)
      .where(
        and(
          eq(userBlocks.blockerId, user.id),
          eq(userBlocks.blockedId, partner.userId),
        ),
      );
  } catch (err) {
    console.error("[unblockUser] errore:", err);
    return { ok: false, error: "Non è stato possibile sbloccare" };
  }
  return { ok: true };
}

/** Unread-conversation count for the header badge (0 when not logged in). */
export async function fetchUnreadMessageCount(): Promise<number> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return 0;
  }
  return unreadMessageCount(user.id);
}

/**
 * The viewer's inbox, for the chat shell's conversation list to refresh itself
 * (read markers, new previews, ordering) without a full navigation. Returns an
 * empty list when signed out or on error — the list must never throw.
 */
export async function fetchInbox(): Promise<InboxItem[]> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return [];
  }
  try {
    return await getInbox(user.id);
  } catch (err) {
    console.error("[fetchInbox] errore:", err);
    return [];
  }
}
