import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config — smoke journeys for the critical public flows.
 *
 * Requires a running app backed by a **test** database (never production: the
 * journeys are read-only today, but point this at a throwaway Postgres anyway).
 * See e2e/README.md for setup. The webServer below builds and starts the app;
 * provide POSTGRES_URL and AUTH_SECRET in the environment first.
 *
 * A "mobile" project is included on purpose: a real layout bug (match cards
 * clipped on narrow screens) shipped to phones, so we keep a 360px-wide guard.
 */
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
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] }, // 393px-wide viewport
    },
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
