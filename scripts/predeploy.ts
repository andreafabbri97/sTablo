/**
 * Runs at build time (see package.json "build"). When a database URL is
 * present (e.g. on Vercel once Postgres is connected) it:
 *   1. applies pending migrations  — best-effort
 *   2. ensures critical columns exist — idempotent safety net
 *   3. seeds players/admin/teams    — best-effort
 * Nothing here can fail the build: a DB problem must never block the deploy,
 * or Vercel keeps serving the previous (broken) version.
 */
import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL ??
  "";

/**
 * Columns the running code hard-depends on. drizzle's migrate() decides what to
 * apply purely from the journal timestamp ordering, so a migration stamped with
 * an out-of-order `when` is silently skipped — which once shipped code that read
 * a column the DB never got, taking the whole app down. These idempotent guards
 * run every deploy and cost nothing, guaranteeing the schema the code needs is
 * present regardless of migration bookkeeping.
 */
const ENSURE_SCHEMA_SQL = [
  `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "avatar_url" text;`,
  // Hot-path index for the most common match reads/filters. Idempotent and
  // independent of migrate()'s journal bookkeeping, so the DB stays fast even
  // if migration 0009 is ever skipped.
  `CREATE INDEX IF NOT EXISTS "matches_status_played_idx" ON "matches" ("status","played_at");`,
  // Global rate-limit store (migration 0010). The running code reads/writes it
  // on login/register/propose/reset, so guarantee it exists regardless of
  // migrate()'s journal bookkeeping — same belt-and-suspenders as above.
  `CREATE TABLE IF NOT EXISTS "rate_limits" ("key" text PRIMARY KEY NOT NULL, "count" integer NOT NULL, "reset_at" timestamp with time zone NOT NULL);`,
  // Housekeeping: drop windows that closed over a day ago so the table can't
  // grow unbounded from one-off client IPs. Safe — expired rows are inert.
  `DELETE FROM "rate_limits" WHERE "reset_at" < now() - interval '1 day';`,
  // Player-chosen card attribute overrides (migration 0011). The profile page
  // and stats layer read this column, so guarantee it exists regardless of
  // migrate()'s journal bookkeeping.
  `ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "custom_attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;`,
];

async function main() {
  if (!url) {
    console.log("[predeploy] Nessun database collegato — salto migrazione/seed.");
    return;
  }

  console.log("[predeploy] Applico le migrazioni…");
  const client = postgres(url, {
    max: 1,
    ssl: url.includes("sslmode=require") ? "require" : undefined,
  });
  // Migrations are best-effort: a DB hiccup must NEVER block the deploy,
  // otherwise Vercel keeps serving the previous (broken) version.
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[predeploy] Migrazioni applicate ✅");
  } catch (err) {
    console.error("[predeploy] Migrazione saltata (continuo il build):", err);
  }

  // Idempotent schema safety net — independent of migrate()'s bookkeeping.
  try {
    for (const stmt of ENSURE_SCHEMA_SQL) {
      await client.unsafe(stmt);
    }
    console.log("[predeploy] Schema verificato ✅");
  } catch (err) {
    console.error("[predeploy] Verifica schema saltata (continuo il build):", err);
  } finally {
    await client.end({ timeout: 5 }).catch(() => {});
  }

  // Seed is best-effort too.
  try {
    const { seed } = await import("../src/lib/db/seed");
    await seed();
  } catch (err) {
    console.warn("[predeploy] Seed saltato:", (err as Error).message);
  }
}

// Always exit 0 — the build (next build) must proceed no matter what.
main()
  .catch((err) => console.error("[predeploy] Errore non fatale:", err))
  .finally(() => process.exit(0));
