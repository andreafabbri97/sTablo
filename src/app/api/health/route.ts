import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Diagnostics — exposes only booleans, never the secret values.
 * Visit /api/health to verify the deployment sees the required env vars.
 */
export function GET() {
  const authSecret = !!(process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
  const db = !!(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);

  // Push (Web Push / VAPID). Only booleans are exposed, never the key values.
  // NOTE: the server can see NEXT_PUBLIC_VAPID_PUBLIC_KEY at runtime, but the
  // browser only gets it if a BUILD ran after the var was set — so `push: true`
  // here means "env vars present"; a redeploy is still required client-side.
  const vapidPublic = !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivate = !!process.env.VAPID_PRIVATE_KEY;
  const push = vapidPublic && vapidPrivate;

  return NextResponse.json({
    ok: authSecret && db,
    authSecret,
    db,
    push,
    vapidPublic,
    vapidPrivate,
    pushHint: push
      ? "Chiavi VAPID presenti ✓ — se il banner non si attiva, fai un Redeploy (il client le riceve solo a build avvenuta)."
      : "Chiavi VAPID mancanti o incomplete — imposta NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY su Vercel (Production) e fai Redeploy.",
    hint: authSecret
      ? "AUTH_SECRET presente ✓"
      : "AUTH_SECRET MANCANTE — aggiungila su Vercel (Production) e fai Redeploy.",
  });
}
