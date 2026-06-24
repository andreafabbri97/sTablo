import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
