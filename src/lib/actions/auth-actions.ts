"use server";

import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, players } from "@/lib/db/schema";
import { registerSchema } from "@/lib/validation";
import { slugify, colorFromString } from "@/lib/utils";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; field?: string };

async function uniqueSlug(base: string): Promise<string> {
  const root = base || "giocatore";
  let candidate = root;
  let i = 1;
  // Small friend group: a short loop is fine.
  while (
    await db.query.players.findFirst({ where: eq(players.slug, candidate) })
  ) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

export async function registerUser(
  input: unknown,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const { name, username, password } = parsed.data;

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existing) {
      return { ok: false, error: "Username già in uso", field: "username" };
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    const role = count === 0 ? "admin" : "player";

    const passwordHash = await hash(password, 10);
    const slug = await uniqueSlug(slugify(username) || slugify(name));

    await db.transaction(async (tx) => {
      const [player] = await tx
        .insert(players)
        .values({
          name,
          nickname: username,
          slug,
          avatarColor: colorFromString(name),
        })
        .returning();

      await tx.insert(users).values({
        name,
        username,
        passwordHash,
        role,
        playerId: player.id,
      });
    });

    return { ok: true };
  } catch (error) {
    console.error("[registerUser]", error);
    return {
      ok: false,
      error: "Errore durante la registrazione. Riprova.",
    };
  }
}
