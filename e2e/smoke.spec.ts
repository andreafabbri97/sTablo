import { test, expect } from "@playwright/test";

/**
 * Smoke journeys for the critical public flows. All read-only: they navigate,
 * assert layout/redirects, and never write data — safe to run against any test
 * deployment. Run on both the desktop and mobile projects (see playwright.config).
 *
 * NOT yet executed in this repo: there is no local database here, so the app
 * can't boot. Point POSTGRES_URL/AUTH_SECRET at a throwaway DB and run
 * `npm run test:e2e` (see e2e/README.md).
 */

test.describe("public pages load", () => {
  test("home renders the latest-matches section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ultime partite")).toBeVisible();
  });

  test("home has no horizontal overflow (mobile clipping guard)", async ({
    page,
  }) => {
    // Regression guard for the match-card bug that clipped team B on narrow
    // phones. Meaningful once the test DB is seeded so real cards render.
    await page.goto("/");
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("public leaderboard is reachable without logging in", async ({
    page,
  }) => {
    await page.goto("/classifica");
    expect(page.url()).toContain("/classifica");
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});

test.describe("authentication boundaries", () => {
  test("login page shows the credentials form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Accedi" })).toBeVisible();
  });

  test("admin area redirects anonymous users to login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("PWA", () => {
  test("manifest is served", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
  });

  test("home links the web app manifest", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  });
});
