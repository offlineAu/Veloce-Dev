import "dotenv/config";
import { defineConfig } from "@playwright/test";

const base = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1, // shares one database and its rate-limit counters
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "tablet", use: { browserName: "chromium", viewport: { width: 820, height: 1180 } } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  // Reuses a running server; otherwise builds and starts a production server.
  webServer: {
    command: "npm run build && npm run start",
    url: base,
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
