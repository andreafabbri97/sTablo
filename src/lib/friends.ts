import { and, eq, or, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  friendships,
  users,
  players,
  tournamentEntrants,
  teams,
} from "./db/schema";

export type FriendProfile = {
  friendshipId: string;
  userId: string;
  name: string;
  /** Account handle, when set. Shown under the name so there's never any omonymy. */
  username: string | null;
  slug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
};

export type FriendState =
  | "self"
  | "none"
  | "friends"
  | "incoming"
  | "outgoing"
  | "no-account";

type ResolvedProfile = {
  name: string;
  username: string | null;
  slug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
};

async function profilesForUsers(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ResolvedProfile>();
  const rows = await db
    .select({
      userId: users.id,
      userName: users.name,
      username: users.username,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
    })
    .from(users)
    .leftJoin(players, eq(users.playerId, players.id))
    .where(inArray(users.id, userIds));
  return new Map<string, ResolvedProfile>(
    rows.map((r) => [
      r.userId,
      {
        name: r.userName,
        username: r.username ?? null,
        slug: r.slug,
        avatarColor: r.avatarColor ?? 0,
        avatarUrl: r.avatarUrl ?? null,
      },
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
      username: p?.username ?? null,
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
      avatarUrl: p?.avatarUrl ?? null,
    };
  });
}

/**
 * Slugs that power the match feed's «Solo amici» filter: every accepted friend
 * plus the viewer themselves (so their own matches stay in their circle).
 * Returns [] when the viewer has no friends yet — the toggle is then pointless
 * and the caller hides it. Players without a public slug are skipped.
 */
export async function getFriendFeedSlugs(userId: string): Promise<string[]> {
  const friends = await getFriends(userId);
  if (friends.length === 0) return [];
  const slugs = new Set<string>();
  for (const f of friends) if (f.slug) slugs.add(f.slug);
  const me = await db
    .select({ slug: players.slug })
    .from(users)
    .innerJoin(players, eq(users.playerId, players.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (me[0]?.slug) slugs.add(me[0].slug);
  return [...slugs];
}

/**
 * Player ids of the viewer's accepted friends that have a linked profile.
 * One round-trip: joins each accepted friendship straight to the friend's user
 * row, so we never fetch the names/avatars/slugs we'd immediately discard.
 */
async function getFriendPlayerIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ playerId: users.playerId })
    .from(friendships)
    .innerJoin(
      users,
      or(
        and(
          eq(friendships.requesterId, userId),
          eq(users.id, friendships.addresseeId),
        ),
        and(
          eq(friendships.addresseeId, userId),
          eq(users.id, friendships.requesterId),
        ),
      ),
    )
    .where(eq(friendships.status, "accepted"));
  return rows
    .map((r) => r.playerId)
    .filter((id): id is string => Boolean(id));
}

/**
 * Tournament ids in which at least one of the viewer's accepted friends took
 * part — as a singles player, an ad-hoc doubles partner, or a member of a
 * registered team. Empty when no friend appears in any tournament (no friends,
 * none with a profile, or none entered) — the UI then hides the «Solo amici»
 * toggle.
 */
export async function getFriendTournamentIds(
  userId: string,
): Promise<Set<string>> {
  const friendPlayerIds = await getFriendPlayerIds(userId);
  if (friendPlayerIds.length === 0) return new Set();

  const [direct, viaTeam] = await Promise.all([
    db
      .selectDistinct({ tournamentId: tournamentEntrants.tournamentId })
      .from(tournamentEntrants)
      .where(
        or(
          inArray(tournamentEntrants.playerId, friendPlayerIds),
          inArray(tournamentEntrants.partnerId, friendPlayerIds),
        ),
      ),
    db
      .selectDistinct({ tournamentId: tournamentEntrants.tournamentId })
      .from(tournamentEntrants)
      .innerJoin(teams, eq(tournamentEntrants.teamId, teams.id))
      .where(
        or(
          inArray(teams.player1Id, friendPlayerIds),
          inArray(teams.player2Id, friendPlayerIds),
        ),
      ),
  ]);

  const ids = new Set<string>();
  for (const r of direct) ids.add(r.tournamentId);
  for (const r of viaTeam) ids.add(r.tournamentId);
  return ids;
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
      username: p?.username ?? null,
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
      avatarUrl: p?.avatarUrl ?? null,
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
      username: p?.username ?? null,
      slug: p?.slug ?? null,
      avatarColor: p?.avatarColor ?? 0,
      avatarUrl: p?.avatarUrl ?? null,
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
  username: string | null;
  slug: string | null;
  avatarColor: number;
  avatarUrl: string | null;
  isAdmin: boolean;
};

/** All accounts that have a linked player profile. */
export async function getAccountUsers(): Promise<AccountUser[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      username: users.username,
      slug: players.slug,
      avatarColor: players.avatarColor,
      avatarUrl: players.avatarUrl,
      role: users.role,
    })
    .from(users)
    .innerJoin(players, eq(users.playerId, players.id))
    .orderBy(users.name);
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    username: r.username ?? null,
    slug: r.slug,
    avatarColor: r.avatarColor ?? 0,
    avatarUrl: r.avatarUrl ?? null,
    isAdmin: r.role === "admin",
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
