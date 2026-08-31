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

const authenticatedRoutes = [
  "/account",
  "/account/automations",
  "/account/connections",
  "/account/organization",
  "/account/projects",
  "/account/settings",
] as const;

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

  for (const route of authenticatedRoutes) {
    test(`authenticated accessibility baseline: ${route}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}(?:[/?#]|$)`));

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }
});
