"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth-helpers";
import { bustDataCache } from "@/lib/cache";
import { clearDemoMatches, insertDemoMatches } from "@/lib/demo";
import type { ActionResult } from "./auth-actions";

export async function removeDemoMatches(): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  try {
    await clearDemoMatches();
    bustDataCache();
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[removeDemoMatches]", error);
    return { ok: false, error: "Errore nella rimozione delle partite demo" };
  }
}

export async function regenerateDemoMatches(): Promise<ActionResult> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "Azione riservata all'amministratore" };
  }
  try {
    await insertDemoMatches();
    bustDataCache();
    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true };
  } catch (error) {
    console.error("[regenerateDemoMatches]", error);
    return { ok: false, error: "Errore nella generazione delle partite demo" };
  }
}
