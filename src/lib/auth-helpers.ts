import { cache } from "react";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  username: string | null;
  role: "admin" | "player";
  playerId: string | null;
};

/**
 * Has an admin blocked this account ("blocca profilo")? One indexed primary-key
 * lookup, deduped per request via React `cache` so the many getCurrentUser()
 * calls in a single render (layout + page + actions) share a single query.
 * Fails OPEN (returns false) on any DB error: a transient DB blip must never
 * lock the whole group out of the app.
 */
const isAccountBlocked = cache(async (userId: string): Promise<boolean> => {
  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { blocked: true },
    });
    return row?.blocked ?? false;
  } catch (error) {
    console.error("[isAccountBlocked]", error);
    return false;
  }
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  const user = session.user as SessionUser;
  // The JWT is stateless, so a session created before the block stays valid
  // until it expires. Re-check on every read to bounce a just-blocked user on
  // their next request — treated exactly like being logged out.
  if (await isAccountBlocked(user.id)) return null;
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/** Throws if the caller is not an admin — use inside server actions. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Azione riservata all'amministratore");
  }
  return user;
}

export async function assertAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Devi accedere per continuare");
  return user;
}
