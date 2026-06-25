import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

/**
 * Set of player IDs whose linked account has the admin role. Used to flag the
 * community's admins with a badge wherever players are listed.
 */
export async function getAdminPlayerIds(): Promise<Set<string>> {
  const rows = await db
    .select({ playerId: users.playerId })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.playerId)));
  const ids = new Set<string>();
  for (const r of rows) if (r.playerId) ids.add(r.playerId);
  return ids;
}

/** Whether a single player's linked account has the admin role. */
export async function isPlayerAdmin(playerId: string): Promise<boolean> {
  const row = await db.query.users.findFirst({
    where: and(eq(users.playerId, playerId), eq(users.role, "admin")),
    columns: { id: true },
  });
  return Boolean(row);
}
