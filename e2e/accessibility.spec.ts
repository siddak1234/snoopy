import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { settledAnimations, settledPage, worstContrast } from "./helpers";

const publicRoutes = [
  "/",
  "/solutions",
  "/contact",
  "/automation-builder",
  "/login",
  "/privacy",
  "/terms",
] as const;

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

// Register F64, the Round 15 change audit's F-1 on it, and F69: a ghost
// button's text keeps WCAG AA at rest, hovered and pressed, on every ground it
// sits on, in both themes. axe answers "incomplete" on the marketing band — a
// gradient ground — so the ground is read from pixels (`worstContrast`).
const ghostButtons = [
  ["/", "Talk to our team"],
  ["/automation-builder", "Get a guided demo"],
  ["/automation-builder", "Contact support"],
] as const;

for (const theme of ["dark", "light"] as const) {
  for (const [route, name] of ghostButtons) {
    test(`a ghost button keeps AA contrast at rest, hovered and pressed: "${name}" on ${route}, ${theme} theme (register F64, F69)`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addInitScript((value) => {
        try {
          localStorage.setItem("theme", value);
        } catch {
          /* the page falls back to its default */
        }
      }, theme);
      await page.goto(route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // The nav asks for the session after hydration and the page re-renders
      // on its answer; a button read before it may be replaced (register F50).
      await expect(
        page
          .getByRole("navigation", { name: "Main navigation" })
          .getByRole("link", { name: "Sign in" }),
      ).toBeVisible();
      await settledPage(page);
      const button = page.getByRole("link", { name, exact: true });
      await expect(button).toHaveClass(/btn-ghost/);
      await button.scrollIntoViewIfNeeded();
      await settledPage(page);
      expect(
        await worstContrast(page, button),
        "at rest",
      ).toBeGreaterThanOrEqual(4.5);
      await button.hover();
      await settledAnimations(button);
      expect(
        await worstContrast(page, button),
        "hovered",
      ).toBeGreaterThanOrEqual(4.5);
      await page.mouse.down();
      await settledAnimations(button);
      expect(
        await worstContrast(page, button),
        "pressed",
      ).toBeGreaterThanOrEqual(4.5);
      // Released elsewhere, so the link is not followed.
      await page.mouse.move(0, 0);
      await page.mouse.up();
    });
  }
}
