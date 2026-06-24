# E2E (Playwright)

Smoke journeys for the critical **public** flows: the home page renders, the
public leaderboard is reachable, the login form is present, the admin area
redirects anonymous users, and the PWA manifest is served. Everything here is
**read-only** — no test writes data — so it is safe against any test deployment.

> ⚠️ **Not yet executed.** This repo has no local database, so the app can't
> boot here and these specs have never been run. They are a ready-to-go scaffold.
> Wire up a throwaway Postgres (never production) and run them as below.

## One-time setup

```bash
npm install
npx playwright install chromium   # downloads the browser (~150 MB)
```

## Run

Provide a **test** database and an auth secret, then run. Playwright will build
and start the app for you (see `webServer` in `playwright.config.ts`).

```bash
# PowerShell
$env:POSTGRES_URL="postgres://user:pass@host/test_db?sslmode=require"
$env:AUTH_SECRET="any-long-random-string"
npm run db:seed          # optional but recommended: makes the card-overflow guard meaningful
npm run test:e2e
```

```bash
# bash
POSTGRES_URL="postgres://user:pass@host/test_db?sslmode=require" \
AUTH_SECRET="any-long-random-string" \
npm run test:e2e
```

### Against an already-running deployment

Skip the built-in server and point at a URL (e.g. a Vercel preview):

```bash
E2E_BASE_URL="https://your-preview.vercel.app" npm run test:e2e
```

## Projects

- **desktop** — Desktop Chrome viewport
- **mobile** — Pixel 5 (393 px wide); keeps a guard against the narrow-screen
  layout bug that once clipped match cards on phones.

## Extending to authenticated flows

The current journeys avoid login on purpose (no data writes). To cover
create-match / record-result / tournament flows, add a Playwright
[storage-state](https://playwright.dev/docs/auth) fixture that logs in once
(seed creates `@fabbro` / `@<nickname>` accounts) and reuse it across specs.
Keep those against a throwaway DB only.
