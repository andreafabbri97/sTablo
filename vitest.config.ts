import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest covers the pure logic modules (tournament generators, standings, Elo)
 * in a plain node environment, plus a few component tests that opt into a DOM
 * via a `// @vitest-environment jsdom` pragma at the top of the file. The Next
 * build is never involved.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
