import { cache } from "react";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ACCOUNTS_TAG } from "@/lib/cache";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  username: string | null;
  role: "admin" | "player";
  playerId: string | null;
};

/**
 * Has an admin blocked this account ("blocca profilo")?
 *
 * This runs on every authenticated page, so it was the main reason navigation
 * still woke the (scale-to-zero) DB even on otherwise-cached pages. It's now
 * cached across requests (per user, tag ACCOUNTS_TAG, ~1 min) so most clicks
 * skip the DB entirely; block/unblock busts the tag so a ban still lands
 * promptly. Still deduped per render via React `cache`, and fails OPEN on any DB
 * error so a transient blip never locks the whole group out.
 */
const readBlocked = unstable_cache(
  async (userId: string): Promise<boolean> => {
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
  },
  ["account-blocked"],
  { tags: [ACCOUNTS_TAG], revalidate: 60 },
);

const isAccountBlocked = cache((userId: string) => readBlocked(userId));

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
