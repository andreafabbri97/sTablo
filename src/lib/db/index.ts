import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single shared connection. Vercel Postgres (Neon) exposes a pooled URL via
 * POSTGRES_URL; we fall back to DATABASE_URL for local/other setups.
 */
const connectionString =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";

if (!connectionString) {
  // Surfaced at call time rather than crashing the build on import.
  console.warn(
    "[db] No POSTGRES_URL / DATABASE_URL set — database calls will fail.",
  );
}

// Reuse the client across hot reloads / lambda invocations.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    // A small pool (not 1) so the independent queries a page fires together via
    // Promise.all actually run in parallel instead of queueing on one socket.
    // POSTGRES_URL is Neon's pooled (pgBouncer) endpoint, so a handful of
    // connections per warm instance is safe; prepare:false is required for it.
    max: 5,
    idle_timeout: 20,
    ssl: connectionString.includes("sslmode=require") ? "require" : undefined,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
export { schema };
