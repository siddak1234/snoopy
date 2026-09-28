import { expect, test } from "@playwright/test";

// Marketing is intentionally static and design-owned. These snapshots protect
// its layout and visual language while Round 5 changes only application data
// boundaries behind the product surface.
for (const [route, snapshot] of [
  ["/", "home.png"],
  ["/solutions", "solutions.png"],
  ["/contact", "contact.png"],
  ["/automation-builder", "automation-builder.png"],
  ["/privacy", "privacy.png"],
  ["/terms", "terms.png"],
] as const) {
  test(`marketing design remains unchanged at ${route}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    // The nav asks for the session after hydration and shows "…" until it has
    // an answer; the baselines hold the answer, so wait for it (register F50).
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(snapshot, {
      animations: "disabled",
      fullPage: true,
    });
  });
}
