import { defineConfig, type Project } from "@playwright/test";

// WebKit runs where it passes: on GitHub's Linux runners, in the Playwright
// image ci.yml pins. On the owner's Mac (macOS 26.6.2) Playwright's WebKit
// fails dozens of the fixture suite's tests even on unchanged main — a session
// cookie swapped mid-test (presentSession) and focus given back on Escape —
// while CI's WebKit legs pass them, so no push could earn the change-audit
// marker there. Off GitHub — `npm run test:browser`,
// `npm run test:browser:fixtures`, `npm run verify`, the change audit — a run
// has Chromium and Firefox; CI still runs all three, and all-green still needs
// every leg (the owner's decision of 2026-10-14, register F104). Not `CI`: the
// local gates set CI=1 too, to keep Playwright from reusing a stale server.
// GITHUB_ACTIONS is "true" on every GitHub runner, inside a job's container
// too; AUTOM8X_WEBKIT=1 runs WebKit locally on purpose.
const webkitRuns =
  process.env.GITHUB_ACTIONS === "true" || process.env.AUTOM8X_WEBKIT === "1";
// Said once, by the runner itself — each worker loads this file again, with
// TEST_WORKER_INDEX set — so nobody reads a green local run as WebKit's.
if (!webkitRuns && process.env.TEST_WORKER_INDEX === undefined) {
  console.log(
    "Browser engines here: Chromium and Firefox. WebKit runs in GitHub CI on Linux, where it passes; AUTOM8X_WEBKIT=1 runs it here too.",
  );
}

// No silent skips (Round 21 hardening, W14-W17): a run collects only what it
// runs, so its "skipped" count is 0 and a real skip fails the run
// (scripts/no-skipped-browser-tests.mjs). The specs that need the fixture Edge
// are not collected without it (scripts/run-browser-fixtures.mjs sets
// E2E_PUBLIC_EDGE_FIXTURE=1 and lists them); the owner's keyboard journey is
// collected only with KEYBOARD_JOURNEY=1.
const fixtureOnly =
  process.env.E2E_PUBLIC_EDGE_FIXTURE === "1"
    ? []
    : [
        /public-edge-fixture\.spec\.ts/,
        /account-surfaces\.spec\.ts/,
        /dialogs\.spec\.ts/,
        /flow-items\.spec\.ts/,
        /health-data\.spec\.ts/,
        /accessibility-authenticated\.spec\.ts/,
        /keyboard-journey\.spec\.ts/,
      ];
const notCollected = [
  ...fixtureOnly,
  ...(process.env.KEYBOARD_JOURNEY === "1"
    ? []
    : [/keyboard-journey\.spec\.ts/]),
];

// NFR-36: the functional and accessibility suites run in all three engines in
// CI; the marketing baselines are one engine's pixels, so they stay Chromium's.
// A test tagged @chromium-only needs Chromium's touch emulation, whose primary
// pointer is coarse; the other engines leave it out by project, never by a
// skip decided while the test runs.
const projects: Project[] = [
  {
    name: "chromium",
    use: { browserName: "chromium" },
    testIgnore: notCollected,
  },
  {
    name: "firefox",
    use: { browserName: "firefox" },
    testIgnore: [/marketing\.visual\.spec\.ts/, ...notCollected],
    grepInvert: /@chromium-only/,
  },
  {
    name: "webkit",
    use: { browserName: "webkit" },
    testIgnore: [/marketing\.visual\.spec\.ts/, ...notCollected],
    grepInvert: /@chromium-only/,
  },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // A committed test.only would run the focused tests alone, green.
  forbidOnly: Boolean(process.env.CI),
  // `github` stays: scripts/audit/run-gates.mjs reads its summary line. The
  // JSON report is what scripts/no-skipped-browser-tests.mjs reads; it lives in
  // test-results/, which each run empties first, so a report is never one a
  // run before left behind. A `--list` passes `--reporter=list` and writes none.
  reporter: process.env.CI
    ? [
        ["github"],
        ["json", { outputFile: "test-results/playwright-report.json" }],
      ]
    : "list",
  // The visual baselines are Chromium's and keep the names they had before the
  // other engines joined — no project in the name — so they are not re-recorded.
  snapshotPathTemplate:
    "{snapshotDir}/{testFileDir}/{testFileName}-snapshots/{arg}{-snapshotSuffix}{ext}",
  projects: projects.filter(({ name }) => webkitRuns || name !== "webkit"),
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
