import { describe, it, expect, beforeEach } from "vitest";
import {
  rateLimitMemory,
  clientKeyFromHeaders,
  retryAfterSeconds,
  __resetRateLimiter,
} from "./rate-limit";

// The in-memory core is the fallback used when the Postgres backend is down;
// it's also the unit-testable heart of the windowing logic. The global DB path
// (rateLimitDb) is covered end-to-end against a real database, not here.
describe("rateLimitMemory", () => {
  beforeEach(() => __resetRateLimiter());

  it("allows up to the limit, then blocks", () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };
    expect(rateLimitMemory("k", opts).ok).toBe(true); // 1
    expect(rateLimitMemory("k", opts).ok).toBe(true); // 2
    expect(rateLimitMemory("k", opts).ok).toBe(true); // 3
    const blocked = rateLimitMemory("k", opts); // 4 → over
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("reports remaining allowance correctly", () => {
    const opts = { limit: 2, windowMs: 1000, now: 0 };
    expect(rateLimitMemory("k", opts).remaining).toBe(1);
    expect(rateLimitMemory("k", opts).remaining).toBe(0);
  });

  it("resets after the window elapses", () => {
    const base = { limit: 1, windowMs: 1000 };
    expect(rateLimitMemory("k", { ...base, now: 0 }).ok).toBe(true);
    expect(rateLimitMemory("k", { ...base, now: 500 }).ok).toBe(false); // still in window
    expect(rateLimitMemory("k", { ...base, now: 1000 }).ok).toBe(true); // window rolled
  });

  it("reports retryAfterMs until the window resets", () => {
    const base = { limit: 1, windowMs: 1000 };
    rateLimitMemory("k", { ...base, now: 0 }); // opens window [0, 1000)
    const blocked = rateLimitMemory("k", { ...base, now: 200 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
  });

  it("keeps separate keys independent", () => {
    const opts = { limit: 1, windowMs: 1000, now: 0 };
    expect(rateLimitMemory("a", opts).ok).toBe(true);
    expect(rateLimitMemory("b", opts).ok).toBe(true); // different key, own bucket
    expect(rateLimitMemory("a", opts).ok).toBe(false);
  });
});

describe("clientKeyFromHeaders", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("takes the first hop of x-forwarded-for", () => {
    expect(
      clientKeyFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" })),
    ).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKeyFromHeaders(h({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("returns 'unknown' when no client headers are present", () => {
    expect(clientKeyFromHeaders(h({}))).toBe("unknown");
  });
});

describe("retryAfterSeconds", () => {
  it("rounds up to whole seconds, minimum 1", () => {
    expect(retryAfterSeconds(0)).toBe(1);
    expect(retryAfterSeconds(1)).toBe(1);
    expect(retryAfterSeconds(1001)).toBe(2);
    expect(retryAfterSeconds(2500)).toBe(3);
  });
});
