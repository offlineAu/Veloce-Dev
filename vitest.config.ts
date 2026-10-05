import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": r("./src"),
      "server-only": r("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    fileParallelism: false, // integration tests share one database
    testTimeout: 20_000,
  },
});
