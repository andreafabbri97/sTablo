import { test as setup, expect } from "@playwright/test";
import path from "path";

/**
 * Auth setup — logs in once via the real UI and saves the session as a
 * Playwright storage state, so the authenticated specs reuse it instead of
 * logging in on every test. Runs only when E2E_AUTH is set (see the opt-in
 * "setup" project in playwright.config.ts).
 *
 * Point it at a SEEDED THROWAWAY database. Provide the credentials of a real
 * account in that DB via env (the seed creates an admin you can reuse):
 *   E2E_USERNAME / E2E_PASSWORD
 */
export const STORAGE_STATE = path.join(__dirname, ".auth", "user.json");

const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

setup("authenticate", async ({ page }) => {
  expect(
    USERNAME,
    "Set E2E_USERNAME to a seeded account's username",
  ).not.toBe("");
  expect(
    PASSWORD,
    "Set E2E_PASSWORD to that account's password",
  ).not.toBe("");

  await page.goto("/login");
  await page.getByLabel("Username").fill(USERNAME);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Accedi" }).click();

  // A successful login leaves the /login page; wait for the redirect to settle.
  await expect(page).not.toHaveURL(/\/login/);

  await page.context().storageState({ path: STORAGE_STATE });
});
