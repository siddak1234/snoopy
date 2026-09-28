import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  // The visual baselines are Chromium's and keep the names they had before the
  // other engines joined — no project in the name — so they are not re-recorded.
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}",
  // NFR-36: the functional and accessibility suites run in all three engines;
  // the marketing baselines are one engine's pixels, so they stay Chromium's.
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    {
      name: "firefox",
      use: { browserName: "firefox" },
      testIgnore: /marketing\.visual\.spec\.ts/,
    },
    {
      name: "webkit",
      use: { browserName: "webkit" },
      testIgnore: /marketing\.visual\.spec\.ts/,
    },
  ],
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
