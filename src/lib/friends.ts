import { and, eq, or, inArray } from "drizzle-orm";
import { db } from "./db";
import { friendships, users, players } from "./db/schema";

export type FriendProfile = {
  friendshipId: string;
  userId: string;
  name: string;
  slug: string | null;
  avatarColor: number;
};

export type FriendState =
  | "self"
  | "none"
  | "friends"
  | "incoming"
  | "outgoing"
  | "no-account";

async function profilesForUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { name: string; slug: string | null; avatarColor: number }>();
  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      slug: players.slug,
      avatarColor: players.avatarColor,
    })
    .from(users)
    .leftJoin(players, eq(users.playerId, players.id))
    .where(inArray(users.id, userIds));
  return new Map(
    rows.map((r) => [
      r.userId,
      { name: r.userName, slug: r.slug, avatarColor: r.avatarColor ?? 0 },
    ]),
  );
}

export async function getFriends(userId: string): Promise<FriendProfile[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          eq(friendships.requesterId, userId),
          eq(friendships.addresseeId, userId),
        ),
      ),
    );
  const otherIds = rows.map((r) =>
    r.requesterId === userId ? r.addresseeId : r.requesterId,
  );
  const profiles = await profilesForUsers(otherIds);
  return rows.map((r) => {
    const other = r.requesterId === userId ? r.addresseeId : r.requesterId;
    const p = profiles.get(other);
    return {
      friendshipId: r.id,
      userId: other,
      name: p?.name ?? "Giocatore",
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
    };
  });
}

export async function getIncomingRequests(
  userId: string,
): Promise<FriendProfile[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.addresseeId, userId),
        eq(friendships.status, "pending"),
      ),
    );
  const profiles = await profilesForUsers(rows.map((r) => r.requesterId));
  return rows.map((r) => {
    const p = profiles.get(r.requesterId);
    return {
      friendshipId: r.id,
      userId: r.requesterId,
      name: p?.name ?? "Giocatore",
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
    };
  });
}

export async function getOutgoingRequests(
  userId: string,
): Promise<FriendProfile[]> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.requesterId, userId),
        eq(friendships.status, "pending"),
      ),
    );
  const profiles = await profilesForUsers(rows.map((r) => r.addresseeId));
  return rows.map((r) => {
    const p = profiles.get(r.addresseeId);
    return {
      friendshipId: r.id,
      userId: r.addresseeId,
      name: p?.name ?? "Giocatore",
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
    };
  });
}

export async function countIncomingRequests(userId: string): Promise<number> {
  const rows = await getIncomingRequests(userId);
  return rows.length;
}

/** Resolve the account (user id) linked to a player, if any. */
export async function userIdForPlayer(
  playerId: string,
): Promise<string | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.playerId, playerId),
  });
  return row?.id ?? null;
}

export type AccountUser = {
  userId: string;
  name: string;
  slug: string | null;
  avatarColor: number;
};

/** All accounts that have a linked player profile. */
export async function getAccountUsers(): Promise<AccountUser[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      slug: players.slug,
      avatarColor: players.avatarColor,
    })
    .from(users)
    .innerJoin(players, eq(users.playerId, players.id))
    .orderBy(users.name);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    slug: r.slug,
    avatarColor: r.avatarColor ?? 0,
  }));
}

/** Map of otherUserId -> relationship state, for the current user. */
export async function getFriendMap(
  userId: string,
): Promise<Map<string, FriendState>> {
  const rows = await db
    .select()
    .from(friendships)
    .where(
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
    );
  const map = new Map<string, FriendState>();
  for (const r of rows) {
    const other = r.requesterId === userId ? r.addresseeId : r.requesterId;
    if (r.status === "accepted") map.set(other, "friends");
    else if (r.status === "declined") map.set(other, "none");
    else map.set(other, r.requesterId === userId ? "outgoing" : "incoming");
  }
  return map;
}

export async function getFriendState(
  viewerUserId: string,
  targetUserId: string | null,
): Promise<FriendState> {
  if (!targetUserId) return "no-account";
  if (viewerUserId === targetUserId) return "self";
  const row = await db.query.friendships.findFirst({
    where: or(
      and(
        eq(friendships.requesterId, viewerUserId),
        eq(friendships.addresseeId, targetUserId),
      ),
      and(
        eq(friendships.requesterId, targetUserId),
        eq(friendships.addresseeId, viewerUserId),
      ),
    ),
  });
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  if (row.status === "declined") return "none";
  return row.requesterId === viewerUserId ? "outgoing" : "incoming";
}
