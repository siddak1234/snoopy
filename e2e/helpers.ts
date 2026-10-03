import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";

/**
 * What the authenticated fixture specs share. The fixture Edge
 * (`e2e/fixtures/public-edge.ts`) listens on 3443 with a certificate the test
 * runner trusts through `NODE_EXTRA_CA_CERTS`, which
 * `scripts/run-browser-fixtures.mjs` sets.
 */

const FIXTURE_EDGE = "https://127.0.0.1:3443";

// Requests of one shape, observed as they leave the page.
export function observe(
  page: Page,
  matches: (request: Request) => boolean,
): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (matches(request)) seen.push(request.url());
  });
  return seen;
}

// WCAG 2.2 AA on whatever the page shows now — an open dialog included. On a
// settled document: a server action's re-render replaces the head, and a scan
// that lands in that instant finds no <title> that is there before and after.
// A title that never arrives still fails, here, by name.
export async function expectNoAxeViolations(page: Page) {
  await expect(page).toHaveTitle(/\S/u);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

// An automation's card on the automations page, found by its heading.
export function automationCard(page: Page, name: string) {
  return page.getByRole("heading", { name }).locator("xpath=../../..");
}

// A provider's card under "Available connections", found by its name.
export function providerCard(page: Page, name: string) {
  return page.getByText(name, { exact: true }).locator("xpath=../..");
}

// The fixture's own controls, never the published API.
export async function fixtureControl(name: string) {
  const answer = await fetch(`${FIXTURE_EDGE}/__fixture/${name}`, {
    method: "POST",
  });
  expect(answer.status).toBe(204);
}

// What the fixture recorded, read at the fixture — for an outcome no page shows.
export async function fixtureRead<T>(name: string): Promise<T> {
  const answer = await fetch(`${FIXTURE_EDGE}/__fixture/${name}`);
  expect(answer.status).toBe(200);
  return (await answer.json()) as T;
}

// Switches the fixture session this browser presents, mid-page — the platform
// starting to refuse a person who is already looking at a form, or a session
// the fixture ends on a schedule.
export async function presentSession(page: Page, value: string) {
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}

// A server action as the page sends it: a POST to its own URL, named by header.
export const isServerAction = (request: Request) =>
  request.method() === "POST" && request.headers()["next-action"] !== undefined;

// Holds the first request to `url` that `matches` until `release()` — the
// moment a person can act while the page waits on it: press Escape, click
// away, leave. `arrived` settles once it is held. A request the page gave up
// on meanwhile is let go quietly.
export async function holdRequest(
  page: Page,
  url: string,
  matches: (request: Request) => boolean = () => true,
) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrive = () => {};
  const arrived = new Promise<void>((resolve) => {
    arrive = resolve;
  });
  let taken = false;
  await page.route(url, async (route) => {
    if (taken || !matches(route.request())) return route.fallback();
    taken = true;
    arrive();
    await released;
    await route.continue().catch(() => undefined);
  });
  return { arrived, release };
}

/**
 * Waits for every finite animation and transition on the page to finish — a
 * stored theme applied on load fades each colour in, and a colour read mid-fade
 * is neither theme's. An endless animation (a marquee) is not waited for.
 */
export function settledPage(page: Page) {
  return page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getTiming().iterations !==
            Number.POSITIVE_INFINITY,
        )
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/** Waits for an element's transitions to finish, so a state is read settled. */
export function settledAnimations(locator: Locator) {
  // A transition cancelled by the next state rejects `finished`; that is settled too.
  return locator.evaluate((element) =>
    Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

/*
 * The worst contrast of an element's text against the ground it is drawn on,
 * read from pixels (register F64, and F-1 of Round 15's change audit): the text
 * made transparent, the text's own box sampled, the worst pixel taken. axe
 * answers "incomplete" on a gradient or tinted ground, so this is the one
 * measure both suites use (register F71).
 */
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

export async function worstContrast(
  page: Page,
  button: Locator,
): Promise<number> {
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
  // Taking the hiding rule away gives the transition back, and the text fades
  // in from transparent. Whatever reads the page next — axe, in the F64 test —
  // must see it settled, not half-faded: read mid-fade, the archive button
  // ("Remove flow" then, "Archive flow" now) pressed measured 2.33:1
  // (BUILD-PLAN 24.11.11).
  await settledAnimations(button);
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
      // Only the part of the text's box the screenshot holds. A box wholly
      // outside it is a mismeasure, never a pass: getImageData would answer
      // transparent black, which light text reads as a perfect ground (F71).
      const x0 = Math.max(0, Math.floor(area.x));
      const y0 = Math.max(0, Math.floor(area.y));
      const x1 = Math.min(image.width, Math.ceil(area.x + area.w));
      const y1 = Math.min(image.height, Math.ceil(area.y + area.h));
      if (x1 <= x0 || y1 <= y0) return null;
      const data = context.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const pixels: number[][] = [];
      for (let i = 0; i < data.length; i += 4) {
        pixels.push([data[i]!, data[i + 1]!, data[i + 2]!]);
      }
      return pixels;
    },
    [png.toString("base64"), box] as const,
  );
  if (!ground) {
    throw new Error("the text's box lies outside the element's screenshot");
  }
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
