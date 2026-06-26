import { NextResponse } from "next/server";
import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Keep-warm endpoint: a trivial `SELECT 1` that wakes/keeps the Neon database
 * awake. The free tier suspends the compute after a few minutes idle, and the
 * cold wake-up (1–3s) is what makes navigation feel stuck. The client pings this
 * every few minutes while the app is open (see <KeepWarm>); point an external
 * uptime monitor at it too for 24/7 warmth.
 */
export async function GET() {
  await connection(); // run per-request, never prerender/cache this
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
