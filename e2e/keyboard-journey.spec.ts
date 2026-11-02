import { test } from "@playwright/test";

// The owner's NFR-35 keyboard traversal, by hand — not an automated assertion:
// the playbook's Round 5 gate asks for a human keyboard traversal of the core
// journey. This opens the built site against the loopback fixture, signed in
// as the owner, and hands the browser over. Run it alone, headed:
//   KEYBOARD_JOURNEY=1 node scripts/run-browser-fixtures.mjs --headed --grep "keyboard journey"
// Resume in the Playwright Inspector ends it. The route list is in the Round 5
// audit (docs/audits/2026-08-11-round-5-phase-1-status.md). playwright.config.ts
// collects this file only with KEYBOARD_JOURNEY=1 and the fixture Edge
// (E2E_PUBLIC_EDGE_FIXTURE=1), so no other run lists it as skipped (Round 21
// hardening, W15); the skip below never fires in a run.
test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test("keyboard journey — the owner's NFR-35 traversal, by hand", async ({
  page,
}) => {
  test.setTimeout(0);
  await page.goto("/account");
  await page.pause();
});
