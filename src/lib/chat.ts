/**
 * Server-side reads for the 1:1 chat. Pure helpers and shared view types live
 * in `lib/chat-core.ts` (client-safe); the mutations live in
 * `lib/actions/chat-actions.ts`. Keep this module server-only — it imports the
 * database.
 *
 * The inbox and the unread badge deliberately never touch `direct_messages`:
 * the last message is denormalized onto the conversation row, so both are a
 * single index-friendly query. A conversation is "unread" for me when the last
 * message isn't mine and is newer than my own read marker.
 */
import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import {
  conversations,
  directMessages,
  userBlocks,
  users,
  players,
  type Conversation,
} from "./db/schema";
import {
  canonicalPair,
  type ChatPartner,
  type ChatMessageView,
  type BlockState,
  type InboxItem,
  type ThreadData,
} from "./chat-core";

/** Newest messages loaded into a thread on first render / full refresh. */
const THREAD_WINDOW = 500;

/* ----------------------------------------------------------------------------
   Profile resolution
---------------------------------------------------------------------------- */

/**
 * Resolve the chat partner for a player slug. Goes slug → player → linked
 * account; returns null when the slug is unknown OR the player has no account
 * to message (an inner join on `users.playerId`). Display name comes from the
 * player so it matches the rest of the app.
 */
export async function partnerBySlug(slug: string): Promise<ChatPartner | null> {
  const rows = await db
    .select({
      userId: users.id,
      name: players.name,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
    })
    .from(players)
    .innerJoin(users, eq(users.playerId, players.id))
    .where(eq(players.slug, slug))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    userId: r.userId,
    name: r.name,
    slug: r.slug,
    avatarColor: r.avatarColor ?? 0,
    avatarUrl: r.avatarUrl ?? null,
  };
}

/** Resolve display profiles for a batch of user ids (for the inbox previews). */
async function partnersForUsers(
  userIds: string[],
): Promise<Map<string, ChatPartner>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      playerName: players.name,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
    })
    .from(users)
    .leftJoin(players, eq(users.playerId, players.id))
    .where(inArray(users.id, userIds));
  return new Map<string, ChatPartner>(
    rows.map((r) => [
      r.userId,
      {
        userId: r.userId,
        name: r.playerName ?? r.userName,
        slug: r.slug ?? null,
        avatarColor: r.avatarColor ?? 0,
        avatarUrl: r.avatarUrl ?? null,
      },
    ]),
  );
}

/* ----------------------------------------------------------------------------
   Blocks & conversation lookup
---------------------------------------------------------------------------- */

/**
 * Directional block state between the viewer and the other user. A block in
 * EITHER direction forbids messaging both ways; the two flags let the UI say
 * which side it is ("you blocked them" vs "they blocked you").
 */
export async function getBlockState(
  viewerId: string,
  otherId: string,
): Promise<BlockState> {
  const rows = await db
    .select({ blockerId: userBlocks.blockerId })
    .from(userBlocks)
    .where(
      or(
        and(
          eq(userBlocks.blockerId, viewerId),
          eq(userBlocks.blockedId, otherId),
        ),
        and(
          eq(userBlocks.blockerId, otherId),
          eq(userBlocks.blockedId, viewerId),
        ),
      ),
    );
  let iBlocked = false;
  let blockedMe = false;
  for (const r of rows) {
    if (r.blockerId === viewerId) iBlocked = true;
    if (r.blockerId === otherId) blockedMe = true;
  }
  return { iBlocked, blockedMe };
}

/** The single conversation row for an unordered user pair, if it exists. */
export async function findConversation(
  user1: string,
  user2: string,
): Promise<Conversation | null> {
  const { userAId, userBId } = canonicalPair(user1, user2);
  const rows = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.userAId, userAId),
        eq(conversations.userBId, userBId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/* ----------------------------------------------------------------------------
   Thread & inbox
---------------------------------------------------------------------------- */

/**
 * Everything the thread page needs for its first render: the partner profile,
 * the (possibly null) conversation id, the most recent window of messages in
 * chronological order, and the block state. Returns null when the slug can't be
 * messaged (unknown / no account / yourself).
 */
export async function getThread(
  viewerId: string,
  otherSlug: string,
): Promise<ThreadData | null> {
  const partner = await partnerBySlug(otherSlug);
  if (!partner || partner.userId === viewerId) return null;

  const convo = await findConversation(viewerId, partner.userId);
  let messages: ChatMessageView[] = [];
  if (convo) {
    // Fetch the newest window (desc + limit), then flip to chronological for
    // rendering — top-to-bottom oldest-to-newest like any chat.
    const rows = await db
      .select({
        id: directMessages.id,
        senderId: directMessages.senderId,
        body: directMessages.body,
        createdAt: directMessages.createdAt,
      })
      .from(directMessages)
      .where(eq(directMessages.conversationId, convo.id))
      .orderBy(desc(directMessages.createdAt))
      .limit(THREAD_WINDOW);
    messages = rows.reverse();
  }

  const block = await getBlockState(viewerId, partner.userId);
  return {
    partner,
    conversationId: convo?.id ?? null,
    messages,
    block,
  };
}

/**
 * The viewer's inbox: one row per conversation they're part of, newest first,
 * with the denormalized last-message preview and a computed unread flag.
 */
export async function getInbox(viewerId: string): Promise<InboxItem[]> {
  const rows = await db
    .select({
      userAId: conversations.userAId,
      userBId: conversations.userBId,
      lastMessageAt: conversations.lastMessageAt,
      lastMessageBody: conversations.lastMessageBody,
      lastMessageSenderId: conversations.lastMessageSenderId,
      aLastReadAt: conversations.aLastReadAt,
      bLastReadAt: conversations.bLastReadAt,
    })
    .from(conversations)
    .where(
      or(
        eq(conversations.userAId, viewerId),
        eq(conversations.userBId, viewerId),
      ),
    )
    .orderBy(desc(conversations.lastMessageAt));

  const otherIds = rows.map((r) =>
    r.userAId === viewerId ? r.userBId : r.userAId,
  );
  const profiles = await partnersForUsers(otherIds);

  return rows.map((r) => {
    const otherId = r.userAId === viewerId ? r.userBId : r.userAId;
    const myReadAt = r.userAId === viewerId ? r.aLastReadAt : r.bLastReadAt;
    const lastFromMe = r.lastMessageSenderId === viewerId;
    const unread =
      !lastFromMe &&
      r.lastMessageSenderId != null &&
      (myReadAt == null || r.lastMessageAt > myReadAt);
    const p = profiles.get(otherId);
    return {
      partner: p ?? {
        userId: otherId,
        name: "Giocatore",
        slug: null,
        avatarColor: 0,
        avatarUrl: null,
      },
      lastMessageBody: r.lastMessageBody,
      lastMessageAt: r.lastMessageAt,
      lastFromMe,
      unread,
    };
  });
}

/**
 * How many conversations have an unread incoming message for the viewer. Drives
 * the header badge — counts conversations, not messages, so it's one query over
 * the denormalized columns. Never throws (badge must not break the header).
 */
export async function unreadMessageCount(viewerId: string): Promise<number> {
  try {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(conversations)
      .where(
        or(
          and(
            eq(conversations.userAId, viewerId),
            ne(conversations.lastMessageSenderId, viewerId),
            or(
              isNull(conversations.aLastReadAt),
              gt(conversations.lastMessageAt, conversations.aLastReadAt),
            ),
          ),
          and(
            eq(conversations.userBId, viewerId),
            ne(conversations.lastMessageSenderId, viewerId),
            or(
              isNull(conversations.bLastReadAt),
              gt(conversations.lastMessageAt, conversations.bLastReadAt),
            ),
          ),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[unreadMessageCount] errore:", err);
    return 0;
  }
}
