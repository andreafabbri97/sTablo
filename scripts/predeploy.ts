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
  // Match social — reactions + comments (migration 0012). The match detail page
  // reads/writes both on every view, so guarantee they exist regardless of
  // migrate()'s journal bookkeeping. ON DELETE CASCADE keeps them tidy when a
  // match or user is removed.
  `CREATE TABLE IF NOT EXISTS "match_reactions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE, "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "emoji" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "match_reaction_unique_idx" ON "match_reactions" ("match_id","user_id","emoji");`,
  `CREATE INDEX IF NOT EXISTS "match_reaction_match_idx" ON "match_reactions" ("match_id");`,
  `CREATE TABLE IF NOT EXISTS "match_comments" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "match_id" uuid NOT NULL REFERENCES "matches"("id") ON DELETE CASCADE, "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "body" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL);`,
  `CREATE INDEX IF NOT EXISTS "match_comment_match_idx" ON "match_comments" ("match_id");`,
  // In-app notification center (migration 0013). The bell + /notifiche page read
  // this on every load and notify() writes to it on every gameplay event, so
  // guarantee it exists regardless of migrate()'s journal bookkeeping.
  `CREATE TABLE IF NOT EXISTS "notifications" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "kind" text DEFAULT 'generic' NOT NULL, "title" text NOT NULL, "body" text NOT NULL, "url" text, "read_at" timestamp with time zone, "created_at" timestamp with time zone DEFAULT now() NOT NULL);`,
  `CREATE INDEX IF NOT EXISTS "notification_user_idx" ON "notifications" ("user_id","created_at");`,
  `CREATE INDEX IF NOT EXISTS "notification_unread_idx" ON "notifications" ("user_id","read_at");`,
  // Dispute / "conteso" flow (migration 0014). confirmMatch/disputeMatch and the
  // auto-confirm cron read/write these on the hot result-confirmation path, so
  // guarantee they exist regardless of migrate()'s journal bookkeeping.
  `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "disputed_at" timestamp with time zone;`,
  `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "disputed_by_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;`,
  `ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "dispute_reason" text;`,
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
