import { expect, test } from "@playwright/test";

// Marketing is intentionally static and design-owned. These snapshots protect
// its layout and visual language while Round 5 changes only application data
// boundaries behind the product surface.
for (const [route, snapshot] of [
  ["/", "home.png"],
  ["/solutions", "solutions.png"],
  ["/contact", "contact.png"],
  ["/automation-builder", "automation-builder.png"],
] as const) {
  test(`marketing design remains unchanged at ${route}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await expect(page).toHaveScreenshot(snapshot, {
      animations: "disabled",
      fullPage: true,
    });
  });
}
