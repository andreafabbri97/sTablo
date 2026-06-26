import { NextResponse } from "next/server";
import { bustDataCache } from "@/lib/cache";
import { autoConfirmExpired } from "@/lib/match-engine";


/**
 * Scheduled backstop that confirms pending results past their 24h deadline.
 * Wired to a Vercel Cron (see vercel.json). The opportunistic confirm in the
 * notification bell still handles the active-user case; this guarantees results
 * between two inactive players eventually settle.
 *
 * Auth: Vercel attaches `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET
 * is configured. We enforce it only when set, so the endpoint also works on a
 * fresh deploy without extra config (the operation is idempotent and harmless).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const confirmed = await autoConfirmExpired();
    if (confirmed > 0) bustDataCache();
    return NextResponse.json({ ok: true, confirmed });
  } catch (error) {
    console.error("[cron/auto-confirm]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
