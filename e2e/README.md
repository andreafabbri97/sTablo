# E2E (Playwright)

Two layers:

1. **Public smoke** (`smoke.spec.ts`, projects `desktop` + `mobile`) — read-only
   journeys over the critical public flows: home renders the latest-matches
   section, public leaderboard is reachable, register/login forms are present,
   the admin and new-match areas redirect anonymous users to login, wrong
   credentials are rejected, and the PWA manifest is served. **No writes**, so
   they're safe against any deployment.

   ✅ **Executed and green** against the live deployment
   (`https://s-tablo.vercel.app`): 20/20 across desktop + mobile.

2. **Authenticated** (`*.auth.spec.ts`, opt-in via `E2E_AUTH`) — the auth
   boundary from the inside: a logged-in account reaches the protected pages
   (new-match form, profile) that anonymous users are redirected away from.
   Requires a **seeded throwaway** database — never production.

## One-time setup

```bash
npm install
npx playwright install chromium   # downloads the browser (~150 MB)
```

## Run the public smoke

The fastest, zero-DB way is to point at an already-running deployment:

```bash
# PowerShell
$env:E2E_BASE_URL="https://s-tablo.vercel.app"   # or a Vercel preview URL
npm run test:e2e
```

```bash
# bash
E2E_BASE_URL="https://your-preview.vercel.app" npm run test:e2e
```

Or let Playwright build & start the app locally (needs a **test** database):

```bash
# PowerShell
$env:POSTGRES_URL="postgres://user:pass@host/test_db?sslmode=require"
$env:AUTH_SECRET="any-long-random-string"
npm run db:seed          # makes the card-overflow guard meaningful
npm run test:e2e
```

## Run the authenticated journeys (opt-in)

These write nothing today but exercise a real session, so use a **throwaway**
seeded DB. Set `E2E_AUTH` to enable the `setup` + `authenticated` projects and
pass the credentials of a seeded account:

```bash
# PowerShell
$env:E2E_AUTH="1"
$env:E2E_USERNAME="fabbro"        # a username that exists in the seeded DB
$env:E2E_PASSWORD="<that account's password>"
npm run test:e2e
```

The `setup` project logs in once and saves the session to `e2e/.auth/user.json`
(git-ignored); the `authenticated` project reuses it via `storageState`.

## Projects

- **desktop** — Desktop Chrome viewport (public smoke)
- **mobile** — Pixel 5 (393 px wide); keeps a guard against the narrow-screen
  layout bug that once clipped match cards on phones (public smoke)
- **setup** / **authenticated** — opt-in (`E2E_AUTH`), reuse a logged-in session

## Extending to write flows

The natural next step is a create-result journey: as a logged-in player, open
`/partite/nuova`, fill a score, submit, assert the success panel, then **Annulla
inserimento** (undo) and assert it's gone. That writes data — keep it on a
disposable DB only, and reset/reseed between runs so it stays deterministic.
Reuse the same `storageState` fixture from `auth.setup.ts`.
