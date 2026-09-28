import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, type Request } from "@playwright/test";

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
