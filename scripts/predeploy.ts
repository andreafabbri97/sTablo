/**
 * Runs at build time (see package.json "build"). When a database URL is
 * present (e.g. on Vercel once Postgres is connected) it:
 *   1. applies pending migrations  — fatal on error
 *   2. seeds players/admin/teams    — non-fatal
 * When no URL is present (local build before setup) it skips cleanly so the
 * build never breaks.
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
  try {
    const db = drizzle(client);
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("[predeploy] Migrazioni applicate ✅");
  } finally {
    await client.end({ timeout: 5 });
  }

  // Seed is best-effort: never block a deploy if it fails.
  try {
    const { seed } = await import("../src/lib/db/seed");
    await seed();
  } catch (err) {
    console.warn("[predeploy] Seed saltato:", (err as Error).message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[predeploy] Migrazione fallita:", err);
    process.exit(1);
  });
