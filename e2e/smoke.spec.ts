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
    // The heading is rendered twice (responsive desktop/mobile variants, one
    // hidden); assert the visible one to avoid a strict-mode violation.
    await expect(
      page
        .getByRole("heading", { name: "Ultime partite" })
        .filter({ visible: true }),
    ).toBeVisible();
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

  test("register page renders the sign-up form", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByText("Entra in campo")).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Crea profilo" }),
    ).toBeVisible();
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

  test("new-match page redirects anonymous users to login", async ({
    page,
  }) => {
    await page.goto("/partite/nuova");
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong credentials are rejected with an error", async ({ page }) => {
    // Exercises the real auth path (Credentials → authorize) end to end. Uses a
    // schema-valid username that can't exist, so it's a read-only failed login:
    // no data written, well under the per-IP rate limit.
    await page.goto("/login");
    await page.getByLabel("Username").fill("e2e_no_such_user");
    await page.getByLabel("Password").fill("definitely-wrong-pw");
    await page.getByRole("button", { name: "Accedi" }).click();
    await expect(
      page.getByText("Username o password non corretti"),
    ).toBeVisible();
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
