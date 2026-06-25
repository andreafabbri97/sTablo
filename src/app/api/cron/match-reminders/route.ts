import { NextResponse } from "next/server";
import { sendScheduledReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Daily reminder for upcoming scheduled challenges (see vercel.json). Sends a
 * push to the players of every match planned in the next 24h.
 *
 * Auth mirrors the auto-confirm cron: enforce CRON_SECRET only when it is set,
 * so the endpoint also works on a fresh deploy (the operation is harmless).
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
    const sent = await sendScheduledReminders();
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("[cron/match-reminders]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
