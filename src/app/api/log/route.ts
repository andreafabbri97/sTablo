import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import {
  rateLimit,
  RATE_LIMITS,
  clientKeyFromHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Client-side error sink. The error boundaries (and the global error listener)
 * POST a compact report here; we log it server-side so it lands in the Vercel
 * runtime logs — a zero-dependency "error tracking" without an external SaaS.
 *
 * It only ever logs: there's no database write, no echo of the payload, and the
 * response is a bare `{ ok: true }`. Fields are length-capped and the endpoint
 * is rate-limited per IP so a stuck browser can't flood the logs.
 */

const MAX = { message: 1000, stack: 4000, url: 500, source: 200 } as const;

const reportSchema = z.object({
  message: z.string().trim().min(1).max(MAX.message),
  stack: z.string().max(MAX.stack).optional(),
  digest: z.string().max(200).optional(),
  url: z.string().max(MAX.url).optional(),
  source: z.string().max(MAX.source).optional(),
});

export async function POST(request: Request) {
  const h = await headers();
  const ip = clientKeyFromHeaders(h);

  const limit = await rateLimit(`client-log:${ip}`, RATE_LIMITS.clientLog);
  if (!limit.ok) {
    // Quietly accept — the client doesn't care, and we don't want retries.
    return NextResponse.json({ ok: true });
  }

  let parsed: z.infer<typeof reportSchema>;
  try {
    const body: unknown = await request.json();
    const result = reportSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.error("[client-error]", {
    source: parsed.source ?? "unknown",
    message: parsed.message,
    digest: parsed.digest,
    url: parsed.url,
    ip,
    userAgent: h.get("user-agent") ?? undefined,
    stack: parsed.stack,
  });

  return NextResponse.json({ ok: true });
}
