/**
 * Pure chat helpers and shared view types — NO database or server imports, so
 * this module is safe to import from both server reads and "use client"
 * components. The DB-bound reads live in `lib/chat.ts`, the mutations in
 * `lib/actions/chat-actions.ts`.
 */

/** Hard cap on a single chat message (matches the DB `text` + the schema). */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * Canonical ordering of a user pair for a 1:1 conversation. A conversation is
 * stored once per unordered pair with the invariant `userAId < userBId`, so
 * both "A messages B" and "B messages A" resolve to the same row. Comparison is
 * a plain lexicographic string compare (uuids are stable text).
 */
export function canonicalPair(
  user1: string,
  user2: string,
): { userAId: string; userBId: string } {
  return user1 < user2
    ? { userAId: user1, userBId: user2 }
    : { userAId: user2, userBId: user1 };
}

/** The other participant of a conversation, resolved for display. */
export type ChatPartner = {
  userId: string;
  name: string;
  /** The partner's account handle (@username), null when not set. */
  username: string | null;
  slug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
  /**
   * Whether the partner's account is an admin. Populated only where the thread
   * header needs it (so the viewer knows they're talking to an admin); left
   * undefined in lighter contexts (inbox previews, message pushes).
   */
  isAdmin?: boolean;
  /**
   * Whether the partner is an accepted friend of the viewer. Drives the
   * Amico / non-amico badge in the inbox picker and the thread header.
   */
  isFriend?: boolean;
  /** The partner's current level, when resolved for the thread header. */
  level?: number | null;
};

/** A single message as shown in a thread. `senderId` lets the client mark "mine". */
export type ChatMessageView = {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

/** Directional block state between the viewer and the other participant. */
export type BlockState = {
  /** the viewer has blocked the other person */
  iBlocked: boolean;
  /** the other person has blocked the viewer */
  blockedMe: boolean;
};

/** One row of the chat inbox (a conversation preview). */
export type InboxItem = {
  partner: ChatPartner;
  lastMessageBody: string | null;
  lastMessageAt: Date;
  /** the last message was sent by the viewer */
  lastFromMe: boolean;
  /** there is an unread incoming message for the viewer */
  unread: boolean;
};

/** Everything the thread page needs for its initial render. */
export type ThreadData = {
  partner: ChatPartner;
  /** null until the first message creates the conversation */
  conversationId: string | null;
  messages: ChatMessageView[];
  block: BlockState;
  /**
   * The partner's read marker (their `*LastReadAt`), or null if they've never
   * opened the thread. Drives the "Consegnato / Letto" receipt under my last
   * sent message: it's "Letto" once this is ≥ that message's timestamp.
   */
  partnerLastReadAt: Date | null;
};
