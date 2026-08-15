import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1440, height: 1000 },
    colorScheme: "dark",
    locale: "en-US",
    timezoneId: "UTC",
  },
  webServer: {
    // The fixture runner copies deployment assets and then exercises the same
    // standalone server bundle as the web image. Snapshot tests use Next's
    // production server directly, which serves its own static assets.
    command:
      process.env.E2E_PUBLIC_EDGE_FIXTURE === "1"
        ? "node .next/standalone/server.js"
        : "npm run start -- --hostname 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    // A contract-fixture run must not inherit a previous local server configured
    // with a different backend origin.
    reuseExistingServer:
      !process.env.CI && process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
    timeout: 120_000,
    env: {
      HOSTNAME: "127.0.0.1",
      PORT: "3001",
      // Public fixtures use a non-routable default. The authenticated audit
      // explicitly supplies its non-production Edge origin at execution time.
      BACKEND_API_ORIGIN:
        process.env.BACKEND_API_ORIGIN ?? "https://backend.invalid",
    },
  },
});
