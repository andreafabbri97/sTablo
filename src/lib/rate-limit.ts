import { sql } from "drizzle-orm";
import { rateLimits } from "@/lib/db/schema";

/**
 * Rate limiter — GLOBAL across all serverless instances.
 *
 * The source of truth is a tiny Postgres table (`rate_limits`) updated with a
 * single atomic upsert, so the limit is consistent no matter how many instances
 * Vercel spins up. If the database is briefly unavailable the limiter falls back
 * to a per-instance in-memory counter and, as a last resort, FAILS OPEN — a
 * throttle must never lock everyone out of login just because the DB hiccuped.
 *
 * The in-memory core stays pure and time-injectable (`opts.now`) so it remains
 * unit-testable without a database.
 */

export type RateLimitResult = {
  /** false → the caller is over the limit and should be rejected. */
  ok: boolean;
  /** Remaining allowance in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
};

export type RateLimitOptions = { limit: number; windowMs: number };

/* ----------------------------------------------------------------------------
   Global backend (Postgres) — the primary path.
---------------------------------------------------------------------------- */

/**
 * Atomically record one hit and return the post-update state. The whole
 * window-roll + increment happens in ONE statement, so concurrent requests
 * across instances can't race: either the window is expired (reset to 1) or the
 * counter is bumped, decided against `now()` inside the database.
 */
async function rateLimitDb(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  // Bind the window as a text interval to avoid any parameter-type ambiguity.
  const interval = `${Math.max(1, Math.ceil(windowMs))} milliseconds`;
  const expired = sql`${rateLimits.resetAt} <= now()`;

  // db is imported lazily so this module stays free of a DB dependency for the
  // pure unit tests (which only exercise the in-memory fallback).
  const { db } = await import("@/lib/db");
  const rows = await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`now() + ${interval}::interval` })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimits.count} + 1 end`,
        resetAt: sql`case when ${expired} then now() + ${interval}::interval else ${rateLimits.resetAt} end`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  const row = rows[0];
  if (!row) return { ok: true, remaining: limit - 1, retryAfterMs: 0 };

  const count = Number(row.count);
  // Defensive: never block on a value we can't trust — only on a clear over-limit.
  if (!Number.isFinite(count)) {
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  const resetMs =
    row.resetAt instanceof Date
      ? row.resetAt.getTime()
      : Date.parse(String(row.resetAt));
  const ok = count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - count),
    retryAfterMs:
      ok || !Number.isFinite(resetMs) ? 0 : Math.max(0, resetMs - Date.now()),
  };
}

/* ----------------------------------------------------------------------------
   In-memory fallback (per-instance) — used only when the DB backend fails.
---------------------------------------------------------------------------- */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Safety cap so a flood of unique keys can't grow the map unbounded. */
const MAX_BUCKETS = 10_000;

function sweepExpired(now: number) {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * Pure, synchronous fixed-window check against the in-process map. Exported for
 * unit tests and used as the fallback when the global backend is unavailable.
 */
export function rateLimitMemory(
  key: string,
  { limit, windowMs, now }: RateLimitOptions & { now?: number },
): RateLimitResult {
  const t = now ?? Date.now();

  if (buckets.size >= MAX_BUCKETS) sweepExpired(t);

  const existing = buckets.get(key);
  if (!existing || t >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: t + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - t };
  }
  existing.count += 1;
  return { ok: true, remaining: limit - existing.count, retryAfterMs: 0 };
}

/** Test-only: wipe the in-memory buckets so cases don't bleed into each other. */
export function __resetRateLimiter() {
  buckets.clear();
}

/* ----------------------------------------------------------------------------
   Public API.
---------------------------------------------------------------------------- */

/**
 * Record one hit against `key` and report whether it's allowed. Uses the global
 * Postgres backend; on any backend error, degrades to the per-instance fallback
 * (and that, in turn, only ever blocks on a clear over-limit — never on error).
 */
export async function rateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  try {
    return await rateLimitDb(key, opts);
  } catch (err) {
    console.error(
      "[rateLimit] backend DB non disponibile, uso il fallback in memoria:",
      err,
    );
    return rateLimitMemory(key, opts);
  }
}

/**
 * Named presets for the sensitive entry points. Tuned generously — they only
 * trip on clearly abnormal bursts, never on a human using the app normally.
 */
export const RATE_LIMITS = {
  /** Login attempts per client IP. Throttles password brute-forcing. */
  login: { limit: 15, windowMs: 60_000 },
  /** New account creations per client IP. Stops sign-up spam. */
  register: { limit: 5, windowMs: 10 * 60_000 },
  /** Match proposals per user. Guards against a stuck client / spam. */
  proposeMatch: { limit: 40, windowMs: 60_000 },
  /** Match comments per user. Keeps the feed civil without blocking banter. */
  comment: { limit: 20, windowMs: 60_000 },
  /** Client error reports per IP. Caps log spam from a misbehaving browser. */
  clientLog: { limit: 30, windowMs: 60_000 },
  /** Admin password resets per admin. A sane ceiling on a powerful action. */
  adminReset: { limit: 20, windowMs: 60_000 },
} as const;

/**
 * Derive a stable client key from request headers (best-effort client IP).
 * Pure: takes a standard Web `Headers`, so it works both inside NextAuth's
 * `authorize(_, request)` and in server actions via `await headers()`.
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    // First hop is the original client; the rest are proxies (Vercel appends).
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Whole seconds for a user-facing "retry after" message (min 1s). */
export function retryAfterSeconds(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000));
}
