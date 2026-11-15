import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { securityHeaders } from "../lib/security-headers";
import { fixtureControl, presentSession } from "./helpers";

// The authenticated accessibility baselines, against the fixture Edge only
// (scripts/run-browser-fixtures.mjs). Out of e2e/accessibility.spec.ts so the
// browser job, with no backend, does not collect them: it collected and
// skipped them (Round 21 hardening, W14). playwright.config.ts leaves this
// file out unless E2E_PUBLIC_EDGE_FIXTURE=1, so the skip below never fires in
// a run, and a run that did skip would fail (scripts/no-skipped-browser-tests.mjs).
// Below them, the report-only content security policy's evidence (the
// security plan's item 7): every public page and every page here, read in
// Chromium, breaks it nowhere — and the headers every path sends.
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);
test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });

// Every page behind sign-in (register F37), found by
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
  // A signed document's copy (Round 21, Stage 2): the one the organization starts with.
  {
    path: "/account/organization/documents/d0c0d0c0-d0c0-4d0c-8d0c-d0c0d0c0d0c0",
    fixture: {},
  },
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

// The public pages (e2e/accessibility.spec.ts's, and the page a deleted
// account lands on), and the pages that show a file from an object URL — a run
// package's PDF, a run's entry file and a flow item's file — beside every page
// above. Signed in, as the fixture's owner: a public page reads the session too.
// `control` is the fixture's state a page needs (e2e/flow-items.spec.ts's flow
// with items).
const policyRoutes: ReadonlyArray<{
  path: string;
  fixture?: { session?: "requester"; control?: string };
}> = [
  { path: "/" },
  { path: "/solutions" },
  { path: "/contact" },
  { path: "/automation-builder" },
  { path: "/login" },
  { path: "/privacy" },
  { path: "/terms" },
  { path: "/account-deleted" },
  ...authenticatedRoutes,
  { path: "/account/runs/fixture-run-invoice/package" },
  {
    path: "/account/runs/c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1/files/d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2",
    fixture: { control: "items-flow" },
  },
  {
    path: "/account/flows/b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1/items/b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2/file",
    fixture: { control: "items-flow" },
  },
];

/**
 * Every report the policy makes on `page`, from now on: the browser's console
 * line ("[Report Only] Refused to …") and the document's
 * `securitypolicyviolation` event, by directive and what was blocked.
 */
async function policyReports(page: Page): Promise<string[]> {
  const reports: string[] = [];
  page.on("console", (message) => {
    if (/Content[- ]Security[- ]Policy/iu.test(message.text()))
      reports.push(`console: ${message.text()}`);
  });
  await page.exposeBinding("reportPolicyViolation", (_source, line: string) => {
    reports.push(line);
  });
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      (
        window as unknown as { reportPolicyViolation: (line: string) => void }
      ).reportPolicyViolation(
        `${event.disposition} ${event.effectiveDirective}: ${event.blockedURI || "inline"} (${event.sourceFile}:${event.lineNumber})`,
      );
    });
  });
  return reports;
}

// Chromium alone: its console names each report-only violation, which is the
// evidence a later round reads before it enforces the policy. Left out of the
// other engines by project (@chromium-only, playwright.config.ts).
test.describe("the content security policy, report-only", () => {
  test.beforeEach(async () => {
    await fixtureControl("reset");
  });

  for (const { path, fixture } of policyRoutes) {
    test(
      `no page breaks the content security policy: ${path}`,
      { tag: "@chromium-only" },
      async ({ page }) => {
        if (fixture?.control) await fixtureControl(fixture.control);
        if (fixture?.session) await presentSession(page, fixture.session);
        const reports = await policyReports(page);
        const response = await page.goto(path);
        expect(response?.status()).toBe(200);
        // Whatever the page reads after it loads — the file it frames from
        // an object URL, the run it polls — has been read.
        await page.waitForLoadState("networkidle");
        expect(reports).toEqual([]);
      },
    );
  }

  test(
    "every path sends the five security headers, and a file route keeps its own policy",
    { tag: "@chromium-only" },
    async ({ page }) => {
      const sent = securityHeaders();
      expect(sent.map(({ key }) => key)).toEqual([
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-Frame-Options",
        "Content-Security-Policy-Report-Only",
      ]);
      // Each header once, with its value: duplicates would be two values.
      const expectSent = (
        headers: Array<{ name: string; value: string }>,
        where: string,
      ) => {
        for (const { key, value } of sent)
          expect(
            headers
              .filter(({ name }) => name.toLowerCase() === key.toLowerCase())
              .map((header) => header.value),
            `${where} ${key}`,
          ).toEqual([value]);
      };
      for (const path of ["/", "/terms", "/account", "/api/health"]) {
        const response = await page.request.get(path);
        expect(response.status(), path).toBe(200);
        expectSent(response.headersArray(), path);
        // Not enforced yet: the report-only policy is the only one sent.
        expect(response.headers()["content-security-policy"], path).toBe(
          undefined,
        );
      }
      // A file route, as the package page reads it (it answers this site's
      // pages alone): the five, and its own enforced policy, which frames it
      // on this site alone.
      const read = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
          "/account/runs/fixture-run-invoice/package/file",
      );
      await page.goto("/account/runs/fixture-run-invoice/package");
      const file = await read;
      expect(file.status()).toBe(200);
      const headers = await file.headersArray();
      expectSent(headers, "the package's file route");
      expect(
        headers
          .filter(
            ({ name }) => name.toLowerCase() === "content-security-policy",
          )
          .map(({ value }) => value),
      ).toEqual(["frame-ancestors 'self'"]);
    },
  );
});
