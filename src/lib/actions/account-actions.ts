"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "crypto";
import { and, eq, ne } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { assertAdmin } from "@/lib/auth-helpers";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { ActionResult } from "./auth-actions";

/** A user id always comes from our own admin list, but validate it anyway so a
 *  malformed value can't reach Postgres as a bad uuid cast. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  if (!UUID_RE.test(userId)) {
    return { ok: false, error: "ID non valido" };
  }
  try {
    if (makeAdmin) {
      // Never promote a blocked account: it would create an admin who can't log
      // in (getCurrentUser bounces blocked users). The admin must unblock first.
      const target = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { blocked: true },
      });
      if (target?.blocked) {
        return {
          ok: false,
          error: "Sblocca l'account prima di renderlo amministratore",
        };
      }
    }
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

/**
 * Admin blocks/unblocks an account ("blocca / sblocca profilo"). A blocked user
 * can't log in and is bounced from any live session on the next request. Two
 * hard guards, enforced server-side even though the UI hides the button for
 * these rows: you can never block yourself, and admins can't be blocked (so the
 * panel can't be used to lock every admin out of the app).
 */
export async function setUserBlocked(
  userId: string,
  blocked: boolean,
): Promise<ActionResult> {
  let me;
  try {
    me = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  if (!UUID_RE.test(userId)) {
    return { ok: false, error: "ID non valido" };
  }
  if (userId === me.id) {
    return { ok: false, error: "Non puoi bloccare il tuo account" };
  }
  try {
    if (blocked) {
      // Block atomically: the "is not an admin" check lives in the WHERE clause,
      // so an admin can NEVER be locked out — even if the target's role changed
      // between a separate read and this write. 0 rows updated ⇒ the row is an
      // admin (or no longer exists) ⇒ refuse.
      const updated = await db
        .update(users)
        .set({ blocked: true })
        .where(and(eq(users.id, userId), ne(users.role, "admin")))
        .returning({ id: users.id });
      if (updated.length === 0) {
        return { ok: false, error: "Non puoi bloccare un amministratore" };
      }
    } else {
      // Unblocking is always a safe recovery (even for an edge-case admin who
      // ended up blocked), so there's no role guard on this direction.
      await db
        .update(users)
        .set({ blocked: false })
        .where(eq(users.id, userId));
    }
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[setUserBlocked]", error);
    return { ok: false, error: "Errore nel blocco dell'account" };
  }
}

/** Admin resets another account's password to a new value. */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ActionResult> {
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  if (!(await rateLimit(`reset:${admin.id}`, RATE_LIMITS.adminReset)).ok) {
    return { ok: false, error: "Troppi reset di fila. Riprova tra poco." };
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
  let admin;
  try {
    admin = await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  if (!(await rateLimit(`reset:${admin.id}`, RATE_LIMITS.adminReset)).ok) {
    return { ok: false, error: "Troppi reset di fila. Riprova tra poco." };
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
