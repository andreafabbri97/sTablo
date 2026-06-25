import { test, expect } from "@playwright/test";

/**
 * Authenticated journeys — the auth boundary seen from the INSIDE. They reuse a
 * logged-in session (storageState from auth.setup.ts) and assert a real account
 * can reach the protected pages that anonymous users are redirected away from.
 *
 * Opt-in: only the "authenticated" project (E2E_AUTH set) runs these, against a
 * SEEDED THROWAWAY database. See e2e/README.md.
 *
 * These journeys are read-only by design. The next extension — proposing a
 * result and undoing it — writes data, so keep it on a disposable DB; see the
 * README for the recommended shape.
 */

test.describe("authenticated access", () => {
  test("reaches the new-match form (no redirect to login)", async ({
    page,
  }) => {
    await page.goto("/partite/nuova");
    await expect(page).toHaveURL(/\/partite\/nuova/);
    await expect(
      page.getByRole("heading", { name: "Nuova partita" }).first(),
    ).toBeVisible();
  });

  test("reaches their own profile (no redirect to login)", async ({ page }) => {
    await page.goto("/profilo");
    await expect(page).toHaveURL(/\/profilo/);
    await expect(page.getByRole("heading").first()).toBeVisible();
  });
});
