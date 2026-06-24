"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, and, ne } from "drizzle-orm";
import { DATA_TAG } from "@/lib/cache";
import { db } from "@/lib/db";
import { players, teams, users } from "@/lib/db/schema";
import { profileSchema, playerCreateSchema, teamSchema } from "@/lib/validation";
import { assertAuth, assertAdmin } from "@/lib/auth-helpers";
import { slugify, colorFromString } from "@/lib/utils";
import type { ActionResult } from "./auth-actions";

const orNull = (v?: string) => (v && v.length > 0 ? v : null);

export async function updateProfile(input: unknown): Promise<ActionResult> {
  let user;
  try {
    user = await assertAuth();
  } catch {
    return { ok: false, error: "Devi accedere" };
  }
  if (!user.playerId) {
    return { ok: false, error: "Nessun profilo giocatore collegato" };
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first.message, field: String(first.path[0]) };
  }
  const d = parsed.data;

  try {
    // username must stay unique
    const clashUser = await db.query.users.findFirst({
      where: and(eq(users.username, d.username), ne(users.id, user.id)),
    });
    if (clashUser) {
      return { ok: false, error: "Username già in uso", field: "username" };
    }
    if (d.email) {
      const clashEmail = await db.query.users.findFirst({
        where: and(eq(users.email, d.email), ne(users.id, user.id)),
      });
      if (clashEmail) {
        return { ok: false, error: "Email già in uso", field: "email" };
      }
    }

    await db
      .update(users)
      .set({ username: d.username, email: orNull(d.email) })
      .where(eq(users.id, user.id));

    await db
      .update(players)
      .set({
        nickname: orNull(d.nickname),
        motto: orNull(d.motto),
        bio: orNull(d.bio),
        preferredFoot: orNull(d.preferredFoot) as
          | "left"
          | "right"
          | "both"
          | null,
        playStyle: orNull(d.playStyle),
        specialMove: orNull(d.specialMove),
        statsPublic: d.statsPublic,
      })
      .where(eq(players.id, user.playerId));

    const updated = await db.query.players.findFirst({
      where: eq(players.id, user.playerId),
    });
    updateTag(DATA_TAG);
    revalidatePath("/profilo");
    if (updated) revalidatePath(`/giocatori/${updated.slug}`);
    return { ok: true };
  } catch (error) {
    console.error("[updateProfile]", error);
    return { ok: false, error: "Errore nel salvataggio del profilo" };
  }
}

export async function createPlayer(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  const parsed = playerCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { name, nickname } = parsed.data;
  try {
    let slug = slugify(name) || "giocatore";
    let i = 1;
    while (await db.query.players.findFirst({ where: eq(players.slug, slug) })) {
      i += 1;
      slug = `${slugify(name)}-${i}`;
    }
    await db.insert(players).values({
      name,
      nickname: orNull(nickname),
      slug,
      avatarColor: colorFromString(name),
    });
    updateTag(DATA_TAG);
    revalidatePath("/giocatori");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[createPlayer]", error);
    return { ok: false, error: "Errore nella creazione del giocatore" };
  }
}

export async function createTeam(input: unknown): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { name, player1Id, player2Id } = parsed.data;
  if (player1Id === player2Id) {
    return { ok: false, error: "Scegli due giocatori diversi" };
  }
  try {
    let slug = slugify(name) || "team";
    let i = 1;
    while (await db.query.teams.findFirst({ where: eq(teams.slug, slug) })) {
      i += 1;
      slug = `${slugify(name)}-${i}`;
    }
    // normalize pair order for the unique index
    const [p1, p2] = [player1Id, player2Id].sort();
    await db.insert(teams).values({
      name,
      slug,
      player1Id: p1,
      player2Id: p2,
      avatarColor: colorFromString(name),
    });
    updateTag(DATA_TAG);
    revalidatePath("/admin");
    revalidatePath("/classifica");
    return { ok: true };
  } catch (error) {
    console.error("[createTeam]", error);
    return { ok: false, error: "Errore nella creazione del team (forse già esistente)" };
  }
}
