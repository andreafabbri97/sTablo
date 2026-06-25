import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getBaseUrl } from "./base-url";

const KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "VERCEL_PROJECT_PRODUCTION_URL",
  "VERCEL_URL",
] as const;

describe("getBaseUrl", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    for (const k of KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("falls back to localhost when nothing is set", () => {
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("prefers an explicit NEXT_PUBLIC_SITE_URL and trims trailing slashes", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://stablo.app///";
    expect(getBaseUrl()).toBe("https://stablo.app");
  });

  it("uses the stable production domain over the per-deploy URL", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "s-tablo.vercel.app";
    process.env.VERCEL_URL = "s-tablo-git-preview.vercel.app";
    expect(getBaseUrl()).toBe("https://s-tablo.vercel.app");
  });

  it("uses the per-deploy Vercel URL when no production domain is set", () => {
    process.env.VERCEL_URL = "s-tablo-abc123.vercel.app";
    expect(getBaseUrl()).toBe("https://s-tablo-abc123.vercel.app");
  });

  it("lets the explicit override win over the Vercel domains", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://custom.example";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "s-tablo.vercel.app";
    expect(getBaseUrl()).toBe("https://custom.example");
  });
});
