"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "crypto";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { assertAdmin } from "@/lib/auth-helpers";
import type { ActionResult } from "./auth-actions";

/** Admin-mediated password recovery returns the new temp password ONCE so the
 *  admin can read it out to the user (we never email it — no domain to send from). */
export type ResetResult =
  | { ok: true; password: string }
  | { ok: false; error: string };

// Padel/table-tennis flavoured words → a temp password that's easy to dictate
// over chat. Always ≥ 8 chars (shortest word "Ace" + "-" + 4 digits = 8).
const TEMP_WORDS = [
  "Tavolo",
  "Smash",
  "Rally",
  "Dritto",
  "Rovescio",
  "Volee",
  "Pallina",
  "Match",
  "Set",
  "Ace",
];

function makeTempPassword(): string {
  const word = TEMP_WORDS[randomInt(TEMP_WORDS.length)];
  const digits = String(randomInt(1000, 10000)); // always 4 digits
  return `${word}-${digits}`;
}

/** Promote/demote another account. The caller can never change their own role. */
export async function setUserRole(
  userId: string,
  makeAdmin: boolean,
): Promise<ActionResult> {
  let me;
  try {
    me = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  if (userId === me.id) {
    return { ok: false, error: "Non puoi cambiare il tuo ruolo" };
  }
  try {
    await db
      .update(users)
      .set({ role: makeAdmin ? "admin" : "player" })
      .where(eq(users.id, userId));
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[setUserRole]", error);
    return { ok: false, error: "Errore nel cambio ruolo" };
  }
}

/** Admin resets another account's password to a new value. */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, error: "La password deve avere almeno 8 caratteri" };
  }
  try {
    await db
      .update(users)
      .set({ passwordHash: await hash(newPassword, 10) })
      .where(eq(users.id, userId));
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[resetUserPassword]", error);
    return { ok: false, error: "Errore nel reset della password" };
  }
}

/**
 * Admin generates a fresh temporary password for an account and gets it back
 * once, in clear, to hand over to the user (who then changes it from Sicurezza).
 * This is our password-recovery path: simple, no email/SMTP, no custom domain.
 */
export async function resetUserPasswordToTemp(
  userId: string,
): Promise<ResetResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  const password = makeTempPassword();
  try {
    await db
      .update(users)
      .set({ passwordHash: await hash(password, 10) })
      .where(eq(users.id, userId));
    revalidatePath("/admin");
    return { ok: true, password };
  } catch (error) {
    console.error("[resetUserPasswordToTemp]", error);
    return { ok: false, error: "Errore nel reset della password" };
  }
}
