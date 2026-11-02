import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { fixtureControl, presentSession } from "./helpers";

// The authenticated accessibility baselines, against the fixture Edge only
// (scripts/run-browser-fixtures.mjs). Out of e2e/accessibility.spec.ts so the
// browser job, with no backend, does not collect them: it collected and
// skipped them (Round 21 hardening, W14). playwright.config.ts leaves this
// file out unless E2E_PUBLIC_EDGE_FIXTURE=1, so the skip below never fires in
// a run, and a run that did skip would fail (scripts/no-skipped-browser-tests.mjs).
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);
test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });

// Every page behind sign-in (register F37) — eighteen, found by
// `find app/account app/onboarding -name page.tsx` — with the run page read
// four times: a run that saved details, one of three receipts (Build 21),
// and the platform's v7 and v2 bodies as its block fixtures hold them. The
// ones with an id read the fixture's team, runs and flow — its page, its Set
// up, its Connect integration and who gets its email (Build 22) — and the
// onboarding pages are read as the fixture's requester (a person with no
// organization). `fixture` marks a page that names the fixture's own records.
const authenticatedRoutes: ReadonlyArray<{
  path: string;
  fixture?: { session?: "requester" };
}> = [
  { path: "/account" },
  { path: "/account/approvals" },
  { path: "/account/flows" },
  { path: "/account/billing" },
  { path: "/account/connections" },
  { path: "/account/organization" },
  {
    path: "/account/teams/33333333-3333-4333-8333-333333333333",
    fixture: {},
  },
  { path: "/account/runs" },
  { path: "/account/runs/fixture-run-ok", fixture: {} },
  // A run of three receipts, each on its own card (Build 21, spec A7), and
  // its details page — its steps and facts (build 28, item 9).
  { path: "/account/runs/fixture-run-invoice", fixture: {} },
  { path: "/account/runs/fixture-run-invoice/details", fixture: {} },
  // The platform's own page bodies (backend ADR-0048, its block fixtures):
  // Invoice Processing v7's run of three invoices, and v2's run with details.
  { path: "/account/runs/blocks-v7-recorded", fixture: {} },
  { path: "/account/runs/blocks-v2-details", fixture: {} },
  // Invoice Processing's own pages (Build 21, spec A2, A6; the owner's AM4;
  // Build 22, P1–P5): its page, its Set up, its Connect integration page for
  // its step 2, and who gets its email.
  {
    path: "/account/flows/f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1",
    fixture: {},
  },
  {
    path: "/account/flows/f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1/setup",
    fixture: {},
  },
  {
    path: "/account/flows/f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1/vendor?field=vendor",
    fixture: {},
  },
  {
    path: "/account/flows/f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1/email",
    fixture: {},
  },
  { path: "/account/settings" },
  { path: "/account/support" },
  { path: "/account/teams" },
  { path: "/onboarding/setup-org", fixture: { session: "requester" } },
  {
    path: "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111",
    fixture: { session: "requester" },
  },
];

test.describe("authenticated product accessibility baseline", () => {
  // From the fixture's first state, as the fixture suite starts.
  test.beforeEach(async () => {
    await fixtureControl("reset");
  });

  for (const { path, fixture } of authenticatedRoutes) {
    test(`authenticated accessibility baseline: ${path}`, async ({ page }) => {
      const session = fixture?.session;
      if (session) await presentSession(page, session);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const response = await page.goto(path);
      // Still on the page asked for — not sent to sign-in or elsewhere.
      await expect(page).toHaveURL(
        (url) => `${url.pathname}${url.search}` === path,
      );
      // …and the page itself, not a not-found page under the same address. That
      // page keeps the address and renders its text only once hydrated, so its
      // status is what tells, not its text.
      expect(response?.status()).toBe(200);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
