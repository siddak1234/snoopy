// No silent skips in the browser suites (Round 21 hardening, W17): after a
// Playwright run under CI (ci.yml's browser job, and
// scripts/run-browser-fixtures.mjs in each fixture leg), the JSON report must
// exist and count 0 skipped. playwright.config.ts collects only what a run
// runs, so a skip here is a test that stopped running, not an expected one.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const report = resolve(
  process.argv[2] ?? "test-results/playwright-report.json",
);
let stats;
try {
  ({ stats } = JSON.parse(readFileSync(report, "utf8")));
} catch (error) {
  console.error(
    `FAIL: no Playwright JSON report at ${report} (${error.message})`,
  );
  process.exit(1);
}
const skipped = stats?.skipped;
if (typeof skipped !== "number") {
  console.error(`FAIL: ${report} carries no stats.skipped`);
  process.exit(1);
}
if (skipped > 0) {
  console.error(
    `FAIL: ${skipped} browser test(s) skipped (${report}); a skip is a test that did not run`,
  );
  process.exit(1);
}
console.log(
  `no skipped browser tests: ${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, 0 skipped`,
);
