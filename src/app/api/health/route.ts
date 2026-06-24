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
  return NextResponse.json({
    ok: authSecret && db,
    authSecret,
    db,
    hint: authSecret
      ? "AUTH_SECRET presente ✓"
      : "AUTH_SECRET MANCANTE — aggiungila su Vercel (Production) e fai Redeploy.",
  });
}
