/**
 * Runs at build time (see package.json "build"). When a database URL is
 * present (e.g. on Vercel once Postgres is connected) it:
 *   1. applies pending migrations  — best-effort
 *   2. seeds players/admin/teams    — best-effort
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
