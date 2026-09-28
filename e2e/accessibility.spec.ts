import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { fixtureControl, presentSession } from "./helpers";

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
// the fixture's project, run and team, and the onboarding pages are read as the
// fixture's requester (a person with no organization): those five exist only
// against the fixture, so they are scanned only there.
const authenticatedRoutes: ReadonlyArray<{
  path: string;
  fixture?: { session?: "requester" };
}> = [
  { path: "/account" },
  { path: "/account/approvals" },
  { path: "/account/automations" },
  { path: "/account/billing" },
  { path: "/account/connections" },
  { path: "/account/organization" },
  { path: "/account/projects" },
  {
    path: "/account/projects/33333333-3333-4333-8333-333333333333",
    fixture: {},
  },
  { path: "/account/runs" },
  { path: "/account/runs/fixture-run-ok", fixture: {} },
  { path: "/account/settings" },
  { path: "/account/support" },
  { path: "/account/teams" },
  { path: "/account/teams/abababab-abab-4bab-8bab-abababababab", fixture: {} },
  { path: "/onboarding/setup-org", fixture: { session: "requester" } },
  {
    path: "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111",
    fixture: { session: "requester" },
  },
];
const againstFixture = process.env.E2E_PUBLIC_EDGE_FIXTURE === "1";

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

// Register F64, and the Round 15 change audit's F-1 on it: a ghost button's
// hovered and pressed text keeps WCAG AA on every ground it sits on, in both
// themes. axe answers "incomplete" on the marketing band — a gradient ground —
// so the ground is read from pixels: the text made transparent, the text's own
// box sampled, and the worst pixel of it taken.
const ghostButtons = [
  ["/", "Talk to our team"],
  ["/automation-builder", "Get a guided demo"],
  ["/automation-builder", "Contact support"],
] as const;

function luminance([red, green, blue]: readonly number[]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(red ?? 0) +
    0.7152 * channel(green ?? 0) +
    0.0722 * channel(blue ?? 0)
  );
}

async function worstContrast(page: Page, button: Locator): Promise<number> {
  const text = (await button.evaluate((el) => getComputedStyle(el).color))
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map(Number);
  const box = await button.evaluate((el) => {
    const outer = el.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(el);
    const inner = range.getBoundingClientRect();
    return {
      x: inner.left - outer.left,
      y: inner.top - outer.top,
      w: inner.width,
      h: inner.height,
    };
  });
  await button.evaluate((el) => el.setAttribute("data-contrast-target", ""));
  const hide = await page.addStyleTag({
    content:
      "[data-contrast-target]{color:transparent !important;text-shadow:none !important;transition:none !important}",
  });
  const png = await button.screenshot();
  await hide.evaluate((node) => (node as Element).remove());
  const ground = await page.evaluate(
    async ([encoded, area]) => {
      const image = new Image();
      image.src = `data:image/png;base64,${encoded}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const x = Math.max(0, Math.floor(area.x));
      const y = Math.max(0, Math.floor(area.y));
      const data = context.getImageData(
        x,
        y,
        Math.max(1, Math.min(image.width - x, Math.ceil(area.w))),
        Math.max(1, Math.min(image.height - y, Math.ceil(area.h))),
      ).data;
      const pixels: number[][] = [];
      for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i]!, data[i + 1]!, data[i + 2]!]);
      }
      return pixels;
    },
    [png.toString("base64"), box] as const,
  );
  const textLuminance = luminance(text);
  let worst = Infinity;
  for (const pixel of ground) {
    const groundLuminance = luminance(pixel);
    const ratio =
      (Math.max(textLuminance, groundLuminance) + 0.05) /
      (Math.min(textLuminance, groundLuminance) + 0.05);
    worst = Math.min(worst, ratio);
  }
  return worst;
}

for (const theme of ["dark", "light"] as const) {
  for (const [route, name] of ghostButtons) {
    test(`a ghost button keeps AA contrast hovered and pressed: "${name}" on ${route}, ${theme} theme (register F64)`, async ({
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
      const button = page.getByRole("link", { name, exact: true });
      await expect(button).toHaveClass(/btn-ghost/);
      await button.scrollIntoViewIfNeeded();
      const settled = () =>
        button.evaluate((el) =>
          Promise.all(
            el.getAnimations().map((animation) => animation.finished),
          ),
        );
      await button.hover();
      await settled();
      expect(
        await worstContrast(page, button),
        "hovered",
      ).toBeGreaterThanOrEqual(4.5);
      await page.mouse.down();
      await settled();
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

test.describe("authenticated product accessibility baseline", () => {
  test.skip(
    !authenticatedAuditEnabled,
    "requires E2E_AUTHENTICATED_AUDIT=1 and PLAYWRIGHT_AUTH_STORAGE_STATE from a non-production authenticated session",
  );
  test.use({ storageState: authenticatedStorageState });

  // Against the fixture, from its first state, as the fixture suite starts.
  test.beforeEach(async () => {
    if (!againstFixture) return;
    await fixtureControl("reset");
  });

  for (const { path, fixture } of authenticatedRoutes) {
    test(`authenticated accessibility baseline: ${path}`, async ({ page }) => {
      test.skip(
        Boolean(fixture) && !againstFixture,
        "names the fixture's own records; scanned against the fixture only",
      );
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
