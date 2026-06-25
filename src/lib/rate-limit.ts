/**
 * Best-effort, in-memory rate limiter (fixed window).
 *
 * IMPORTANT — what this is and isn't:
 * The buckets live in the memory of a SINGLE serverless instance. On Vercel each
 * instance has its own map and instances are recycled, so this is a *first* line
 * of defence against accidental floods and naive brute force from one client — it
 * is NOT a hard, globally-consistent guarantee. A determined attacker spreading
 * requests across many cold instances could dilute it. For a small friends'
 * league this is the right trade-off: zero extra infra, and it still stops the
 * obvious abuse (a stuck client loop, someone hammering the login box). If we
 * ever need strict global limits, swap the Map for Redis (e.g. Upstash) behind
 * this same `rateLimit()` signature — callers won't change.
 *
 * The core is pure and time-injectable (`opts.now`) so it can be unit-tested
 * without faking timers.
 */

export type RateLimitResult = {
  /** false → the caller is over the limit and should be rejected. */
  ok: boolean;
  /** Remaining allowance in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
};

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Safety cap so a flood of unique keys (e.g. spoofed IPs) can't grow the map
 * unbounded within one instance. When hit we sweep expired buckets first.
 */
const MAX_BUCKETS = 10_000;

function sweepExpired(now: number) {
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it's allowed.
 *
 * @param key    Stable identity for the actor (IP, user id, or a combination).
 * @param limit  Max allowed hits within the window.
 * @param windowMs Window length in milliseconds.
 * @param now    Injectable clock for tests; defaults to Date.now().
 */
export function rateLimit(
  key: string,
  { limit, windowMs, now }: { limit: number; windowMs: number; now?: number },
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

/** Test-only: wipe all buckets so cases don't bleed into each other. */
export function __resetRateLimiter() {
  buckets.clear();
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
