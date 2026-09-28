import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/solutions",
  "/contact",
  "/automation-builder",
  "/login",
  "/privacy",
  "/terms",
] as const;

// Every page behind sign-in (register F37) — sixteen, found by
// `find app/account app/onboarding -name page.tsx`. The three with an id read
// the fixture's project, run and team; the onboarding pages are for a person
// with no organization, so they are read as the fixture's requester.
const authenticatedRoutes: ReadonlyArray<{
  path: string;
  session?: "requester";
}> = [
  { path: "/account" },
  { path: "/account/approvals" },
  { path: "/account/automations" },
  { path: "/account/billing" },
  { path: "/account/connections" },
  { path: "/account/organization" },
  { path: "/account/projects" },
  { path: "/account/projects/33333333-3333-4333-8333-333333333333" },
  { path: "/account/runs" },
  { path: "/account/runs/fixture-run-ok" },
  { path: "/account/settings" },
  { path: "/account/support" },
  { path: "/account/teams" },
  { path: "/account/teams/abababab-abab-4bab-8bab-abababababab" },
  { path: "/onboarding/setup-org", session: "requester" },
  {
    path: "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111",
    session: "requester",
  },
];

const authenticatedAuditEnabled =
  process.env.E2E_AUTHENTICATED_AUDIT === "1" &&
  Boolean(process.env.PLAYWRIGHT_AUTH_STORAGE_STATE);
const authenticatedStorageState = process.env.PLAYWRIGHT_AUTH_STORAGE_STATE;

for (const route of publicRoutes) {
  test(`public accessibility baseline: ${route}`, async ({ page }) => {
    // Audit the settled interface, not a transitional opacity frame from the
    // decorative scroll-reveal animation.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(results.violations).toEqual([]);
  });
}

test.describe("authenticated product accessibility baseline", () => {
  test.skip(
    !authenticatedAuditEnabled,
    "requires E2E_AUTHENTICATED_AUDIT=1 and PLAYWRIGHT_AUTH_STORAGE_STATE from a non-production authenticated session",
  );
  test.use({ storageState: authenticatedStorageState });

  // Against the fixture, from its first state, as the fixture suite starts.
  test.beforeEach(async () => {
    if (process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1") return;
    const reset = await fetch("https://127.0.0.1:3443/__fixture/reset", {
      method: "POST",
    });
    expect(reset.status).toBe(204);
  });

  for (const { path, session } of authenticatedRoutes) {
    test(`authenticated accessibility baseline: ${path}`, async ({ page }) => {
      if (session) {
        await page.context().addCookies([
          {
            name: "e2e-public-edge-session",
            value: session,
            domain: "127.0.0.1",
            path: "/",
          },
        ]);
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);
      // Still on the page asked for — not sent to sign-in or elsewhere.
      await expect(page).toHaveURL(
        (url) => `${url.pathname}${url.search}` === path,
      );

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
