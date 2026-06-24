import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest is scoped to the pure logic modules (tournament generators, standings,
 * Elo). These have no Next.js / DB dependencies, so a plain node environment is
 * enough and the Next build is never involved.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
