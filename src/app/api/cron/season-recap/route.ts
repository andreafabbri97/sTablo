import { NextResponse } from "next/server";
import { sendSeasonRecap } from "@/lib/season-recap";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Monthly recap of the season that just ended (see vercel.json — runs on day 1).
 * Pushes the MVP + season match count to everyone with notifications enabled.
 *
 * Auth mirrors the other crons: enforce CRON_SECRET only when it is set, so the
 * endpoint also works on a fresh deploy (the operation is harmless).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }
  }

  try {
    const result = await sendSeasonRecap();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/season-recap]", error);
    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 },
    );
  }
}
