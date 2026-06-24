"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { assertAdmin } from "@/lib/auth-helpers";
import type { ActionResult } from "./auth-actions";

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
