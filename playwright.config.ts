import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config.
 *
 * Two layers:
 *  - PUBLIC smoke (desktop + mobile): read-only journeys over the public flows.
 *    Safe against any deployment — they never write data. Run as-is, or point at
 *    a running URL with E2E_BASE_URL (e.g. a Vercel preview / the live site).
 *  - AUTHENTICATED (opt-in via E2E_AUTH): a "setup" project logs in once and
 *    saves a session, then the "authenticated" project reuses it. These need a
 *    SEEDED THROWAWAY database (E2E_USERNAME / E2E_PASSWORD) — never production.
 *
 * A "mobile" project is included on purpose: a real layout bug (match cards
 * clipped on narrow screens) shipped to phones, so we keep a ~390px-wide guard.
 */
const STORAGE_STATE = "e2e/.auth/user.json";

// Authenticated journeys are gated behind E2E_AUTH so the default run stays
// public-only and works against any deployment without a database.
const authProjects = process.env.E2E_AUTH
  ? [
      { name: "setup", testMatch: /auth\.setup\.ts/ },
      {
        name: "authenticated",
        testMatch: /\.auth\.spec\.ts/,
        dependencies: ["setup"],
        use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
      },
    ]
  : [];

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices["Pixel 5"] }, // 393px-wide viewport
    },
    ...authProjects,
  ],
  // Reuse a server you already started locally; otherwise build + start one.
  // Skip entirely when E2E_BASE_URL points at an already-running deployment.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
