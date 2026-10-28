import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  test,
  type Download,
  type Locator,
  type Page,
  type Request,
} from "@playwright/test";
import {
  FLOWS,
  automationCard,
  connectionRow,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  holdRequest,
  isServerAction,
  observe,
  presentSession,
  settledAnimations,
  shared,
  standInShareSheet,
} from "./helpers";

/**
 * The surfaces Round 14's change audit probed in a browser and no test asserted
 * (the register's § Round 15 lists them by number), with F60 and F62's
 * run-time path. Each test names its number. Against the loopback fixture Edge,
 * reset before each test, as the main fixture suite runs.
 */

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test.beforeEach(async () => {
  await fixtureControl("reset");
});

// A team is a project in the platform's contract (BUILD-PLAN 24.11.11).
const organizationProject =
  "/account/teams/33333333-3333-4333-8333-333333333333";
const joinLink = "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111";
const workspaceChanged =
  "The active workspace changed in another tab. Reload this page before continuing.";

// Each approval's status at the platform: a decision leaves the page.
async function approvalStatuses() {
  return (await fixtureRead<{ approvalStatuses: string[] }>("counts"))
    .approvalStatuses;
}

// Moves the session's active workspace from another tab, as a person does.
async function switchInAnotherTab(page: Page, to: RegExp) {
  const other = await page.context().newPage();
  try {
    await other.goto("/account");
    const trigger = other.getByRole("button", { name: "Switch workspace" });
    await trigger.click();
    await other.getByRole("button", { name: to }).click();
    await expect(trigger).toContainText(to);
  } finally {
    await other.close();
  }
}

test("1 — the home's recent-run link opens that run's page", async ({
  page,
}) => {
  await page.goto("/account");
  await page
    .getByRole("link", { name: "Run of Manual input automation, failed" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-failed$/);
  await expect(
    page.getByText("input must carry vendor, amount, and reference").first(),
  ).toBeVisible();
});

test("2 — recent activity says when it could not be read, and says when there is none", async ({
  page,
}) => {
  await fixtureControl("runs-failing");
  await page.goto("/account");
  await expect(
    page.getByText("Recent activity could not be read just now."),
  ).toBeVisible();
  // One read failing takes nothing else with it: Today's tiles, and Add a
  // flow and Flows (Build 22, W1).
  await expect(page.getByTestId("today-stat-Runs")).toHaveText("3");
  await expect(page.getByTestId("home-quick-actions")).toBeVisible();
  await fixtureControl("reset");
  await fixtureControl("runs-empty");
  await page.reload();
  await expect(page.getByText("No activity yet.")).toBeVisible();
});

test("Activity with no run is the app's empty screen, with the way to Flows (the owner's build 9)", async ({
  page,
}) => {
  await fixtureControl("runs-empty");
  await page.goto("/account/runs");
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "No activity yet" }),
  ).toBeVisible();
  await expect(
    main.getByText(
      "Every run lands here the moment your first agent goes live.",
    ),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await main.getByRole("link", { name: "Browse flows" }).click();
  await expect(page).toHaveURL(/\/account\/flows$/);
});

test("3, F60 — a session that ends while a page loads says so, with the way back in, and never that you were not signed out", async ({
  page,
}) => {
  await presentSession(page, "ending");
  await page.goto("/account");
  await expect(
    page.getByRole("heading", { name: "Your session has ended" }),
  ).toBeVisible();
  await expect(page.getByText("You have not been signed out")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Sign in again" }),
  ).toHaveAttribute("href", "/login?callbackUrl=%2Faccount");
  // The layout read the session before it ended, so the navigation stays.
  await expect(
    page.getByRole("complementary", { name: "Dashboard navigation" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("link", { name: "Sign in again" }).click();
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
});

test("F60 — while the boundary asks for the session it claims nothing: no alert, and not a cause that may be wrong", async ({
  page,
}) => {
  const check = await holdRequest(page, "**/api/platform/v1/session");
  await presentSession(page, "ending");
  await page.goto("/account");
  await check.arrived;
  const main = page.locator("main");
  await expect(main.getByText("Loading…")).toBeVisible();
  await expect(main.getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toHaveCount(0);
  check.release();
  await expect(
    page.getByRole("heading", { name: "Your session has ended" }),
  ).toBeVisible();
});

// The change audit of 97021f9's #17 (register § Round 15).
test("F60 — when the boundary's own session read fails it claims nothing about the session, and offers Try again", async ({
  page,
}) => {
  // The billing read fails; so does the boundary's question — neither a 401,
  // so the session may or may not be there.
  await presentSession(page, "page-failing");
  await page.route("**/api/platform/v1/session", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ title: "Service Unavailable", status: 503 }),
    }),
  );
  await page.goto("/account/billing");
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toBeVisible();
  await expect(page.getByText("You have not been signed out")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Your session has ended" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Billing", exact: true }).first(),
  ).toBeVisible();
});

test("F62 — a session that ends between the proxy's read and the render goes to sign in, and no page throws on the way", async ({
  page,
}) => {
  await presentSession(page, "proxy-only");
  await page.goto("/account/settings");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
  await expect(page.getByRole("link", { name: /Google/ })).toBeVisible();
});

test("4, 20 — the sidebar's Teams link opens Teams in any workspace; Organization only where its page renders", async ({
  page,
}) => {
  await page.goto("/account");
  const nav = page.getByRole("complementary", {
    name: "Dashboard navigation",
  });
  await nav.getByRole("link", { name: "Departments" }).click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await expect(page.getByRole("link", { name: /general/ })).toBeVisible();
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  // The switch refreshes this page, and its action's answer can show the new
  // workspace before that refresh returns. In Firefox a navigation started then
  // cancels the refresh, and Next answers a cancelled refresh by navigating back
  // here — which aborts the goto (register F73). The refresh ends first, however
  // it ends: Next may abort it itself once the action's answer is shown.
  const refreshed = new Promise<void>((resolve) => {
    const ended = (request: Request) => {
      const url = new URL(request.url());
      if (
        request.method() === "GET" &&
        url.pathname === "/account/teams" &&
        url.searchParams.has("_rsc") &&
        !request.headers()["next-router-prefetch"]
      )
        resolve();
    };
    page.on("requestfinished", ended);
    page.on("requestfailed", ended);
  });
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  await refreshed;
  await page.goto("/account");
  // A personal workspace holds teams too; the organization page is an
  // organization's.
  await expect(nav.getByRole("link", { name: "Departments" })).toHaveCount(1);
  await expect(nav.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await page.goto("/account/teams");
  // Every team the person is on, in every workspace, whichever is active.
  await expect(
    page.getByRole("heading", { name: "Fixture Organization" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /general/ })).toBeVisible();
});

test.describe("on a small screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("5 — every account page names itself in the header, Support names its email, and the menu reaches Teams (register F56)", async ({
    page,
  }) => {
    const header = page
      .getByRole("button", { name: "Open menu" })
      .locator("xpath=..");
    for (const [path, title] of [
      ["/account", "Dashboard"],
      ["/account/flows", "Flows"],
      ["/account/connections", "Connections"],
      ["/account/runs", "Activity"],
      ["/account/approvals", "Approvals"],
      ["/account/teams", "Departments"],
      ["/account/billing", "Billing"],
      ["/account/settings", "Settings"],
      ["/account/support", "Support"],
      ["/account/organization", "Organization"],
      [organizationProject, "Department"],
      ["/account/runs/fixture-run-ok", "Run"],
      ["/account/runs/fixture-run-ok/details", "Run details"],
      [FLOWS.manual, "Flow"],
      [`${FLOWS.manual}/setup`, "Set up"],
      [`${FLOWS.invoice}/vendor?field=vendor`, "Connect integration"],
      [`${FLOWS.invoice}/email`, "Who gets the email"],
    ] as const) {
      await page.goto(path);
      await expect(header.getByText(title, { exact: true })).toBeVisible();
      if (path === "/account/support") {
        // The support email is the way named, as a link to write to, beside
        // Contact us: the contact form is stored and tells nobody (backend
        // SYSTEM-MANIFEST §12.1 #36). Intuit's app review is pointed here.
        const main = page.locator("main");
        await expect(
          main.getByRole("link", { name: "support@autom8x.ai", exact: true }),
        ).toHaveAttribute("href", "mailto:support@autom8x.ai");
        await expect(
          main.getByRole("link", { name: "Contact us", exact: true }),
        ).toHaveAttribute("href", "/contact");
        await expect(main).not.toContainText("placeholder");
      }
    }
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("dialog", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Departments" })
      .click();
    await expect(page).toHaveURL(/\/account\/teams$/);
  });
});

test("6 — the unavailable panel says how long to wait, in the account area and in onboarding", async ({
  page,
}) => {
  await presentSession(page, "throttled");
  await page.goto("/account/flows");
  await expect(
    page.getByRole("heading", { name: "The platform is busy right now" }),
  ).toBeVisible();
  await expect(page.getByText("Try again in 30 seconds.")).toBeVisible();
  await page.goto("/onboarding/setup-org");
  await expect(page).toHaveURL(/\/onboarding\/setup-org$/);
  await expect(
    page.getByRole("heading", { name: "The platform is busy right now" }),
  ).toBeVisible();
  await expect(page.getByText("Try again in 30 seconds.")).toBeVisible();
});

test("7 — the contact form says how long to wait on a 429, and a problem with no usable title is said by its status", async ({
  page,
}) => {
  let answer: "busy" | "untitled" = "busy";
  await page.route(/\/api\/platform\/v1\/contact-requests$/, (route) =>
    answer === "busy"
      ? route.fulfill({
          status: 429,
          headers: { "retry-after": "30" },
          contentType: "application/problem+json",
          body: JSON.stringify({ title: "Too Many Requests", status: 429 }),
        })
      : route.fulfill({
          status: 400,
          contentType: "application/problem+json",
          body: JSON.stringify({
            title: { text: "not a string" },
            status: 400,
          }),
        }),
  );
  await page.goto("/contact");
  await page
    .getByLabel("The workflow you want to automate")
    .fill("Invoices arrive by email");
  await page.getByLabel("Your email").fill("person@example.test");
  // In the form: Next's route announcer is an alert too, and empty.
  const alert = page.locator("form").getByRole("alert");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(alert).toHaveText(
    "The platform is busy right now. Try again in 30 seconds.",
  );
  answer = "untitled";
  await page.getByRole("button", { name: "Send" }).click();
  await expect(alert).toHaveText("Platform request failed with status 400");
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of [
    joinLink,
    "/onboarding/setup-org",
    "/account/teams",
    organizationProject,
  ]) {
    test(`8 — signing in from ${path} returns there`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        `/login?callbackUrl=${encodeURIComponent(path)}`,
      );
    });
  }

  test("9 — the builder's sign-in links return to Flows, and a saved ?id= link is redirected there (307)", async ({
    page,
  }) => {
    await page.goto("/automation-builder");
    const signIn = page.locator(
      'a[href="/login?callbackUrl=%2Faccount%2Fflows"]',
    );
    await expect(signIn).toHaveCount(2);
    const saved = await page.request.get("/automation-builder?id=legacy-1", {
      maxRedirects: 0,
    });
    expect(saved.status()).toBe(307);
    expect(saved.headers().location).toMatch(/^\/account\/flows(\?|$)/u);
  });

  test("10 — every control on the sign-in page and the marketing page shows its keyboard focus (register F44)", async ({
    page,
  }) => {
    await page.goto("/login");
    await expectFocusShownOnEveryStop(page);
    await page.goto("/");
    await expectFocusShownOnEveryStop(page);
  });
});

/**
 * Tabs through the page and requires every stop to show where focus is — the
 * global `:focus-visible` outline, or a control's own ring. F44 removed a dead
 * `focus-visible:outline-none` from 21 controls; this holds that nothing hides
 * the indicator again. Stops when focus comes back round to where it began.
 */
async function expectFocusShownOnEveryStop(page: Page, limit = 80) {
  for (let stop = 0; stop < limit; stop += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element || element === document.body) return null;
      if (element.dataset.focusWalked) return "again";
      element.dataset.focusWalked = "1";
      const style = getComputedStyle(element);
      const outline =
        style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      return {
        name: (
          element.getAttribute("aria-label") ??
          element.textContent ??
          element.tagName
        )
          .trim()
          .slice(0, 60),
        shown: outline || style.boxShadow !== "none",
      };
    });
    if (focused === null || focused === "again") return;
    expect(focused.shown, `"${focused.name}" shows no focus`).toBe(true);
  }
}

test("10 — every control on the account pages F44 touched shows its keyboard focus, the workspace list's options included", async ({
  page,
}) => {
  for (const path of [
    "/account",
    "/account/settings",
    "/account/teams",
    organizationProject,
    "/account/organization",
  ]) {
    await page.goto(path);
    await expectFocusShownOnEveryStop(page);
  }
  await page.goto("/account");
  await page.getByRole("button", { name: "Switch workspace" }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  // The ring checked below is an option's, not whatever else kept focus.
  await expect(
    page
      .getByRole("dialog", { name: "Switch workspace" })
      .getByRole("button", { name: /Fixture Personal/ }),
  ).toBeFocused();
  const option = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as HTMLElement);
    return (
      (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
      style.boxShadow !== "none"
    );
  });
  expect(option, "a workspace option shows no focus").toBe(true);
});

test("11 — Delete Account wears the error tokens, and its keyboard focus is the error ring (register F43)", async ({
  page,
}) => {
  await page.goto("/account/settings");
  const trigger = page.getByRole("button", { name: "Delete Account" });
  const tokens = await page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const resolve = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const resolved = {
      text: resolve("--error-text"),
      border: resolve("--error-border-strong"),
      background: resolve("--error-bg"),
    };
    probe.remove();
    return resolved;
  });
  const worn = () =>
    trigger.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        text: style.color,
        border: style.borderTopColor,
        background: style.backgroundColor,
        ring: style.boxShadow,
      };
    });
  expect({ ...(await worn()), ring: undefined }).toEqual({
    ...tokens,
    ring: undefined,
  });
  for (let stop = 0; stop < 60; stop += 1) {
    await page.keyboard.press("Tab");
    if (await trigger.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(trigger).toBeFocused();
  expect((await worn()).ring).toContain(tokens.text);
});

/*
 * Test 11's probe, for every action that removes or ends something (the
 * owner's build 12, #5; register F85): red where it sits and where it is
 * confirmed — the danger variant's three tokens on a button, the error text on
 * a word — and nothing red where the action can be undone.
 */

// The error tokens and the accent, as this page resolves them.
async function resolvedTokens(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const resolve = (token: string) => {
      probe.style.color = `var(${token})`;
      return getComputedStyle(probe).color;
    };
    const resolved = {
      text: resolve("--error-text"),
      border: resolve("--error-border-strong"),
      background: resolve("--error-bg"),
      accent: resolve("--color-accent"),
      accentText: resolve("--color-accent-2"),
    };
    probe.remove();
    return resolved;
  });
}
type Tokens = Awaited<ReturnType<typeof resolvedTokens>>;

// A control's colours at rest: the pointer off it and its transitions done,
// so a hover is never read for its rest.
async function atRest(control: Locator) {
  await expect(control).toBeVisible();
  await control.page().mouse.move(0, 0);
  await settledAnimations(control);
  return control.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      text: style.color,
      border: style.borderTopColor,
      background: style.backgroundColor,
    };
  });
}

// Red as a button, as Delete Account is.
async function expectDanger(control: Locator, tokens: Tokens, name: string) {
  expect(await atRest(control), name).toEqual({
    text: tokens.text,
    border: tokens.border,
    background: tokens.background,
  });
}

// Red as a word.
async function expectErrorText(control: Locator, tokens: Tokens, name: string) {
  expect((await atRest(control)).text, name).toBe(tokens.text);
}

// Not red at all.
async function expectNotRed(control: Locator, tokens: Tokens, name: string) {
  const drawn = await atRest(control);
  expect(drawn.text, name).not.toBe(tokens.text);
  expect(drawn.background, name).not.toBe(tokens.background);
}

test("11 — every action that removes or ends something wears the error tokens, on its page and in its confirm: Sign out, Archive flow, Cancel run, Unlink, Disconnect, Delete team and Remove member (the owner's build 12, #5)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  const tokens = await resolvedTokens(page);
  await expectDanger(
    page.getByRole("button", { name: "Sign out" }),
    tokens,
    "Sign out (the account area)",
  );
  await page.goto(FLOWS.archivable);
  const card = page.locator("main");
  await expectDanger(
    card.getByRole("button", { name: "Archive flow" }),
    tokens,
    "Archive flow",
  );
  await card.getByRole("button", { name: "Archive flow" }).click();
  let dialog = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  await expectDanger(
    dialog.getByRole("button", { name: "Archive", exact: true }),
    tokens,
    "Archive, confirming",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/account/runs/fixture-run-running");
  await expectDanger(
    page.getByRole("button", { name: "Cancel run" }),
    tokens,
    "Cancel run",
  );
  await page.getByRole("button", { name: "Cancel run" }).click();
  dialog = page.getByRole("dialog", { name: "Cancel this run?" });
  await expectDanger(
    dialog.getByRole("button", { name: "Cancel run" }),
    tokens,
    "Cancel run, confirming",
  );
  await dialog.getByRole("button", { name: "Keep it running" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/account/settings");
  const unlink = page
    .locator("main li")
    .filter({ hasText: "Microsoft" })
    .getByRole("button", { name: "Unlink" });
  await expectDanger(unlink, tokens, "Unlink");
  // At full strength: the linked row dims its words, never its Unlink.
  expect(
    await unlink.evaluate((element) => {
      for (let at: Element | null = element; at; at = at.parentElement)
        if (getComputedStyle(at).opacity !== "1") return at.outerHTML;
      return null;
    }),
    "Unlink sits under a dimmed element",
  ).toBeNull();
  await unlink.click();
  dialog = page.getByRole("dialog", { name: "Unlink Microsoft?" });
  await expectDanger(
    dialog.getByRole("button", { name: "Unlink" }),
    tokens,
    "Unlink, confirming",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/account/connections");
  await expectDanger(
    page.getByRole("button", { name: "Disconnect Fixture OAuth provider" }),
    tokens,
    "Disconnect",
  );
  await page
    .getByRole("button", { name: "Disconnect Fixture OAuth provider" })
    .click();
  dialog = page.getByRole("dialog", {
    name: "Disconnect Fixture OAuth provider?",
  });
  await expectDanger(
    dialog.getByRole("button", { name: "Disconnect" }),
    tokens,
    "Disconnect, confirming",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Red at rest, not only hovered. Its confirm is the browser's own, which
  // takes no colour.
  await page.goto(organizationProject);
  await expectErrorText(
    page.getByRole("button", { name: "Delete department general" }),
    tokens,
    "Delete department, on its page",
  );
  await page.goto("/account/teams");
  await expectErrorText(
    page.getByRole("button", { name: "Delete department general" }),
    tokens,
    "Delete department, in Departments",
  );

  await page.goto("/account/organization");
  const member = page
    .locator("main li")
    .filter({ hasText: "Fixture Member" })
    .filter({ has: page.getByRole("button", { name: "Remove" }) });
  await expectErrorText(
    member.getByRole("button", { name: "Remove" }),
    tokens,
    "Remove",
  );
  await member.getByRole("button", { name: "Remove" }).click();
  dialog = page.getByRole("dialog", { name: "Remove Fixture Member?" });
  await expectDanger(
    dialog.getByRole("button", { name: "Remove member" }),
    tokens,
    "Remove member, confirming",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("11 — a member's Leave department, the Leave on their own row, and the Leave department that confirms it wear the error tokens (the owner's build 12, #5)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(organizationProject);
  const tokens = await resolvedTokens(page);
  const leave = page
    .locator("main")
    .getByRole("button", { name: "Leave department" });
  const own = page
    .locator("main li")
    .filter({ hasText: "(you)" })
    .getByRole("button", { name: "Leave", exact: true });
  await expectErrorText(leave, tokens, "Leave department");
  await expectErrorText(own, tokens, "Leave, on their own row");
  // Hovered, still red, on the error tint — never the neutral hover that
  // greyed them, a dark system theme's included (this suite's scheme).
  for (const [control, name] of [
    [leave, "Leave department, hovered"],
    [own, "Leave, on their own row, hovered"],
  ] as const) {
    await control.hover();
    await settledAnimations(control);
    expect(
      await control.evaluate((element) => {
        const style = getComputedStyle(element);
        return { text: style.color, background: style.backgroundColor };
      }),
      name,
    ).toEqual({ text: tokens.text, background: tokens.background });
  }
  await leave.click();
  const dialog = page.getByRole("dialog", { name: "Leave “general”?" });
  // Typed, so the confirm is read enabled.
  await dialog.getByLabel("Confirmation").fill("DELETE");
  await expectDanger(
    dialog.getByRole("button", { name: "Leave department" }),
    tokens,
    "Leave department, confirming",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("11 — Sign out wears the error text in the marketing nav and in the small-screen menu (the owner's build 12, #5)", async ({
  page,
}) => {
  await page.goto("/");
  const tokens = await resolvedTokens(page);
  await expectErrorText(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Sign out" }),
    tokens,
    "Sign out (the marketing nav)",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open menu" }).click();
  await expectErrorText(
    page
      .getByRole("dialog", { name: "Main navigation" })
      .getByRole("button", { name: "Sign out" }),
    tokens,
    "Sign out (the small-screen menu)",
  );
});

test("11 — what can be undone is not red: Pause, Deny, Reject, Cancel request and Withdraw, whose confirm is the accent (the owner's build 12, #5)", async ({
  page,
}) => {
  await page.goto(FLOWS.archivable);
  const tokens = await resolvedTokens(page);
  await expectNotRed(
    page.locator("main").getByRole("button", { name: "Pause" }),
    tokens,
    "Pause",
  );

  await page.goto(organizationProject);
  await expectNotRed(
    page
      .locator("main li")
      .filter({ hasText: "Fixture Newcomer" })
      .getByRole("button", { name: "Deny" }),
    tokens,
    "Deny",
  );

  await page.goto("/account/organization");
  await expectNotRed(
    page
      .locator("main li")
      .filter({ hasText: "Fixture Requester" })
      .getByRole("button", { name: "Reject" }),
    tokens,
    "Reject, a request to join",
  );

  // An approval's Deny is red since Build 24 (P6): the danger variant, the
  // owner's call for that pair — its test is with Approvals below.

  await presentSession(page, "member");
  await page.goto("/account/teams");
  const operations = page.locator("main li").filter({ hasText: "Operations" });
  await operations.getByRole("button", { name: "Request to join" }).click();
  await expectNotRed(
    operations.getByRole("button", { name: "Withdraw" }),
    tokens,
    "Withdraw",
  );
  await operations.getByRole("button", { name: "Withdraw" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Withdraw your request to join Operations?",
  });
  // The person can ask again any time: the accent outline, Button's default.
  expect(
    await atRest(dialog.getByRole("button", { name: "Withdraw" })),
    "Withdraw, confirming",
  ).toEqual({
    text: tokens.accentText,
    border: tokens.accent,
    background: "rgba(0, 0, 0, 0)",
  });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await presentSession(page, "requester");
  await page.goto(joinLink);
  await page.getByRole("button", { name: "Join Fixture Organization" }).click();
  await expectNotRed(
    page.getByRole("button", { name: "Cancel request" }),
    tokens,
    "Cancel request",
  );
});

test("13 — a disconnected account leaves its row offering Connect; Disconnect is confirmed first, as in the app", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const row = connectionRow(page, "fixture-oauth");
  await row
    .getByRole("button", { name: "Disconnect Fixture OAuth provider" })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Disconnect Fixture OAuth provider?",
  });
  await expect(confirm).toHaveAccessibleDescription(
    "1 live flow uses it. It stops until you connect it again.",
  );
  // Nothing is disconnected until it is confirmed.
  await expect(row).toContainText("Connected");
  await confirm
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    row.getByRole("button", { name: "Disconnect Fixture OAuth provider" }),
  ).toHaveCount(0);
  await expect(row).toContainText("Not connected");
  const connect = row.getByRole("button", {
    name: "Connect Fixture OAuth provider",
  });
  await expect(connect).toBeVisible();
  // Connect asks the provider for consent again: a disconnected grant is not
  // reused.
  await page.route("https://oauth.invalid/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Consent</h1>" }),
  );
  await connect.click();
  await page.waitForURL(/^https:\/\/oauth\.invalid\/authorize/);
});

/**
 * Every connection row as it is drawn — the website's half of backend
 * BUILD-PLAN 25.4.40, the snapshot the app pins in
 * `snoopy-mobile/__tests__/connection-row.test.tsx` in both palettes: each
 * row's mark (its kind and its name), its name and line, its button's words,
 * the colour each is drawn in, and its height. Read as data, not as pixels,
 * so it is the same in every engine and on every machine.
 */
/** What `drawnConnectionRows` reads on Connections, in each palette. */
const CONNECTION_ROWS: Record<"light" | "dark", unknown[]> = {
  light: [
    {
      row: "connection-fixture-key",
      mark: "icon",
      markColour: "rgb(85, 72, 171)",
      name: "Fixture key provider",
      nameColour: "rgb(32, 34, 47)",
      line: "Not connected",
      lineColour: "rgb(102, 106, 130)",
      button: "Connect",
      buttonColour: "rgb(32, 34, 47)",
      buttonGround: "rgba(0, 0, 0, 0)",
      height: 64,
    },
    {
      row: "connection-fixture-oauth",
      mark: "icon",
      markColour: "rgb(85, 72, 171)",
      name: "Fixture OAuth provider",
      nameColour: "rgb(32, 34, 47)",
      line: "Connected",
      lineColour: "rgb(102, 106, 130)",
      button: "Disconnect",
      buttonColour: "rgb(220, 38, 38)",
      buttonGround: "rgba(239, 68, 68, 0.1)",
      height: 64,
    },
    {
      row: "connection-quickbooks",
      mark: "image QuickBooks",
      markColour: null,
      name: "QuickBooks Online",
      nameColour: "rgb(32, 34, 47)",
      line: "Not connected",
      lineColour: "rgb(102, 106, 130)",
      button: "Connect",
      buttonColour: "rgb(32, 34, 47)",
      buttonGround: "rgba(0, 0, 0, 0)",
      height: 64,
    },
    {
      row: "connection-google",
      mark: "glyph Google",
      markColour: "rgb(32, 34, 47)",
      name: "Google",
      nameColour: "rgb(32, 34, 47)",
      line: "person@example.com",
      lineColour: "rgb(102, 106, 130)",
      button: "Disconnect",
      buttonColour: "rgb(220, 38, 38)",
      buttonGround: "rgba(239, 68, 68, 0.1)",
      height: 64,
    },
  ],
  dark: [
    {
      row: "connection-fixture-key",
      mark: "icon",
      markColour: "rgb(210, 206, 253)",
      name: "Fixture key provider",
      nameColour: "rgb(233, 233, 237)",
      line: "Not connected",
      lineColour: "rgb(178, 182, 202)",
      button: "Connect",
      buttonColour: "rgb(233, 233, 237)",
      buttonGround: "rgba(0, 0, 0, 0)",
      height: 64,
    },
    {
      row: "connection-fixture-oauth",
      mark: "icon",
      markColour: "rgb(210, 206, 253)",
      name: "Fixture OAuth provider",
      nameColour: "rgb(233, 233, 237)",
      line: "Connected",
      lineColour: "rgb(178, 182, 202)",
      button: "Disconnect",
      buttonColour: "rgb(248, 113, 113)",
      buttonGround: "rgba(239, 68, 68, 0.1)",
      height: 64,
    },
    {
      row: "connection-quickbooks",
      mark: "image QuickBooks",
      markColour: null,
      name: "QuickBooks Online",
      nameColour: "rgb(233, 233, 237)",
      line: "Not connected",
      lineColour: "rgb(178, 182, 202)",
      button: "Connect",
      buttonColour: "rgb(233, 233, 237)",
      buttonGround: "rgba(0, 0, 0, 0)",
      height: 64,
    },
    {
      row: "connection-google",
      mark: "glyph Google",
      markColour: "rgb(233, 233, 237)",
      name: "Google",
      nameColour: "rgb(233, 233, 237)",
      line: "person@example.com",
      lineColour: "rgb(178, 182, 202)",
      button: "Disconnect",
      buttonColour: "rgb(248, 113, 113)",
      buttonGround: "rgba(239, 68, 68, 0.1)",
      height: 64,
    },
  ],
};

async function drawnConnectionRows(page: Page) {
  // A stored theme fades each colour in: read the rows settled.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getTiming().iterations !==
            Number.POSITIVE_INFINITY,
        )
        .map((animation) => animation.finished.catch(() => null)),
    ),
  );
  return page.locator("[data-connection-row]").evaluateAll((rows) =>
    rows.map((row) => {
      const colour = (element: Element | null | undefined) =>
        element ? getComputedStyle(element).color : null;
      const mark = row.querySelector("[data-mark]");
      const [name, line] = [
        ...row.querySelectorAll(":scope > span:not([data-mark]) > span"),
      ];
      const button = row.querySelector("button");
      return {
        row: row.getAttribute("data-testid"),
        mark: mark
          ? [
              mark.getAttribute("data-mark"),
              mark.getAttribute("alt") ?? mark.getAttribute("aria-label"),
            ]
              .filter(Boolean)
              .join(" ")
          : null,
        markColour:
          mark && mark.getAttribute("data-mark") !== "image"
            ? colour(mark)
            : null,
        name: name?.textContent ?? null,
        nameColour: colour(name),
        line: line?.textContent ?? null,
        lineColour: colour(line),
        button: button?.textContent ?? null,
        buttonColour: colour(button),
        buttonGround: button ? getComputedStyle(button).backgroundColor : null,
        height: Math.round(row.getBoundingClientRect().height),
      };
    }),
  );
}

test("the connection row in both palettes, pinned: every vendor's mark, name, line and button, and each one's colour (backend 25.4.40)", async ({
  page,
}) => {
  for (const theme of ["light", "dark"] as const) {
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/account/connections");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("[data-connection-row]").first()).toBeVisible();
    expect(await drawnConnectionRows(page), theme).toEqual(
      CONNECTION_ROWS[theme],
    );
  }
});

test("15 — an unmet connection links to Connections by the provider's name from the flow's Step 1, and Turn on waits for it", async ({
  page,
}) => {
  await fixtureControl("draft-needs-connection");
  // The fixture's draft, held in its team (the owner's build 12, #9).
  await page.goto("/account/flows/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  const main = page.locator("main");
  // By the provider's name, never its id (spec §3.D).
  const connect = main.getByRole("link", {
    name: "Connect Fixture OAuth provider first.",
  });
  await expect(connect).toHaveAttribute("href", "/account/connections");
  await expect(main).not.toContainText("fixture-oauth");
  await expect(main.getByRole("button", { name: "Turn on" })).toBeDisabled();
  await connect.click();
  await expect(page).toHaveURL(/\/account\/connections$/);
});

test("the platform's email links open their pages: a run's, and the decisions waiting (the owner's build 14 feedback #6)", async ({
  page,
}) => {
  // `PRODUCT_ORIGIN/runs/<id>` and `/approvals/<id>`, as the backend's notifier
  // builds them (`snoopy-backend/apps/runs/src/notifications.ts`); both answered 404.
  await page.goto("/runs/fixture-run-ok");
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-ok$/);
  await expect(page.locator("main")).toContainText(
    "Recorded the invoice and emailed the summary.",
  );
  await fixtureControl("approval-waiting");
  await page.goto("/approvals/a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0");
  await expect(page).toHaveURL(/\/account\/approvals$/);
  await expect(page.locator("main")).toContainText(
    "A payment over the spending limit needs a person to approve it.",
  );
});

test("16 — Cancel on a run another tab already stopped says so", async ({
  page,
  context,
}) => {
  // This tab stays as it was first drawn, as a tab left open does: its own
  // re-read every 2 s (RunLive) would learn of the other tab's cancel and take
  // Cancel away before the click below — a race WebKit lost twice on PR #55.
  // A failed re-read leaves the page as it was; the cancel itself is not a read.
  // The re-read asks for the page body (RunLive's BLOCKS_SHAPE, ADR-0048).
  await page.route(
    /\/api\/platform\/v1\/workspaces\/[^/]+\/runs\/fixture-run-running\?shape=blocks$/,
    (route) => route.abort(),
  );
  await page.goto("/account/runs/fixture-run-running");
  const other = await context.newPage();
  try {
    await other.goto("/account/runs/fixture-run-running");
    await other.getByRole("button", { name: "Cancel run" }).click();
    await other
      .getByRole("dialog", { name: "Cancel this run?" })
      .getByRole("button", { name: "Cancel run" })
      .click();
    await expect(other.getByRole("dialog")).toHaveCount(0);
  } finally {
    await other.close();
  }
  await page.getByRole("button", { name: "Cancel run" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this run?" });
  await dialog.getByRole("button", { name: "Cancel run" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This run has already stopped, so there is nothing to cancel.",
  );
});

test("the cancelled run reads as cancelled on its page, and Activity reached by Back says so too", async ({
  page,
}) => {
  // Two revalidations follow a cancel: the run's page and Activity. Under Next
  // 16.3.3 either alone refreshes both — `revalidatePath` from a server action
  // "causes all previously visited pages to refresh when navigated to again",
  // which Next's own documentation calls temporary. Both outcomes are held.
  await page.goto("/account/runs");
  await page
    .getByRole("link", { name: "Run of Manual input automation, running" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-running$/);
  await page.getByRole("button", { name: "Cancel run" }).click();
  await page
    .getByRole("dialog", { name: "Cancel this run?" })
    .getByRole("button", { name: "Cancel run" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/account\/runs$/);
  await expect(
    page.getByRole("link", {
      name: "Run of Manual input automation, cancelled",
    }),
  ).toBeVisible();
});

test("17 — Approvals: nothing waiting, a decision by an eligible role, and none offered to a member", async ({
  page,
}) => {
  await page.goto("/account/approvals");
  // A whole page with nothing on it is the app's empty screen (the owner's
  // build 9): the title, one line, and nothing to do.
  const nothing = page
    .locator("main")
    .getByRole("heading", { name: "Nothing needs review" });
  await expect(nothing).toBeVisible();
  await expect(
    page.getByText(
      "When an agent pauses for a human decision, it waits for you here.",
    ),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  await fixtureControl("approval-waiting");
  await presentSession(page, "member");
  await page.reload();
  await expect(
    page.getByText(
      "A payment over the spending limit needs a person to approve it.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(
    page.getByText("Only owner or admin can decide this."),
  ).toBeVisible();
  await presentSession(page, "owner");
  await page.reload();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Approve" }).click();
  // The last row leaving goes to Activity (Build 24, P7).
  await expect(page).toHaveURL(/\/account\/runs$/u);
  expect(await approvalStatuses()).toEqual(["approved"]);
});

test("17 — Deny is recorded as rejected, and the last row leaving goes to Activity (Build 24, P7; S6)", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(page).toHaveURL(/\/account\/runs$/u);
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  expect(await approvalStatuses()).toEqual(["rejected"]);
});

// The held Invoice Processing job: Approve and Deny under its page's result
// line (Build 24, P6; build 28's review, finding 1), and its step 4 — where
// it waits — on its details page, its state alone (build 28, item 9).
const heldJob = "/account/runs/fixture-run-invoice-held";
const heldJobDetails = `${heldJob}/details`;
const heldStep = (page: Page) =>
  page.locator("main").getByTestId("run-step-group:record");
const heldDecision = (page: Page) =>
  page.locator("main").getByTestId("run-decision");
// Its result line: the first text of its body, the platform's (ADR-0048).
const resultLine = (page: Page) =>
  page
    .locator("main")
    .getByTestId("run-blocks")
    .getByTestId("block-text")
    .first();
const documentChip = (page: Page, n: number) =>
  page
    .locator("main")
    .getByTestId("block-section")
    .nth(n - 1)
    .getByTestId("block-badge");
const approvalRows = (page: Page) =>
  page.locator('[data-testid^="approval-row-"]');
// Every read of the approvals list the fixture answered (Build 25, R5c 1).
const approvalListReads = async () =>
  (await fixtureRead<{ approvalListReads: number }>("counts"))
    .approvalListReads;
// Every read of the held job's page body (ADR-0048): the run page reads the
// job again until its approval form comes.
const heldJobReads = async () =>
  (await fixtureRead<{ heldJobBlockReads: number }>("counts"))
    .heldJobBlockReads;

test("P6 — a held job's page offers Approve and Deny under its result line, Deny red; Approving… while it saves, then the page is drawn again: the job runs on under its id; its details page shows step 4's state alone", async ({
  page,
}) => {
  await fixtureControl("invoice-approval-pending");
  // Its details page: step 4 waits, and offers nothing.
  await page.goto(heldJobDetails);
  const step = heldStep(page);
  await expect(step).toHaveAttribute("data-state", "held");
  await expect(step).toContainText(
    "Waiting for approval: Document 2: the total can't be read.",
  );
  await expect(page.locator("main").getByRole("button")).toHaveCount(0);
  // Its page: the pair under the result line, the one pair there is.
  await page.goto(heldJob);
  const main = page.locator("main");
  await expect(resultLine(page)).toHaveText("Waiting for approval.");
  const decision = heldDecision(page);
  const approve = decision.getByRole("button", { name: "Approve" });
  const deny = decision.getByRole("button", { name: "Deny" });
  await expect(approve).toBeVisible();
  await expect(deny).toHaveClass(/(?:^|\s)btn-danger(?:\s|$)/u);
  await expectDanger(deny, await resolvedTokens(page), "Deny, a held job's");
  await expect(main.getByRole("button", { name: "Approve" })).toHaveCount(1);
  const below = await page.evaluate(() => {
    const result = document.querySelector(
      '[data-testid="run-blocks"] [data-testid="block-text"]',
    );
    const pair = document.querySelector('[data-testid="run-decision"]');
    return result && pair
      ? Boolean(
          result.compareDocumentPosition(pair) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : false;
  });
  expect(below).toBe(true);
  await expectNoAxeViolations(page);
  const held = await holdRequest(page, `**${heldJob}`, isServerAction);
  await approve.click();
  await held.arrived;
  await expect(
    decision.getByRole("button", { name: "Approving…" }),
  ).toBeDisabled();
  await expect(deny).toBeDisabled();
  held.release();
  await expect(main.getByText(/^running$/iu)).toBeVisible();
  await expect(decision).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${heldJob}$`, "u"));
  expect(await approvalStatuses()).toEqual(["approved"]);
  await page.goto(heldJobDetails);
  await expect(step).toHaveAttribute("data-state", "working");
});

test("P6 — Deny on a held job's page: the result Denied, its waiting document Not approved, and step 4 says Denied (S6)", async ({
  page,
}) => {
  await fixtureControl("invoice-approval-pending");
  await page.goto(heldJob);
  await heldDecision(page).getByRole("button", { name: "Deny" }).click();
  await expect(resultLine(page)).toHaveText("Denied");
  await expect(heldDecision(page)).toHaveCount(0);
  await expect(documentChip(page, 2)).toHaveText("Not approved");
  expect(await approvalStatuses()).toEqual(["rejected"]);
  await page.goto(heldJobDetails);
  await expect(heldStep(page)).toHaveAttribute("data-state", "held");
  await expect(heldStep(page).locator("p").nth(1)).toHaveText("Denied");
  await expect(heldStep(page).getByRole("button")).toHaveCount(0);
});

test("Round 21 (F2) — a held run's review: each change a row with Accept and Deny, Deny red; Save review once every row is answered; the answers sent and the job goes on; Approvals' card says Review 2 changes and opens the run (the platform round's F2; ICD-10 Code Check's words.md section 3)", async ({
  page,
}) => {
  await fixtureControl("invoice-review-pending");
  // Approvals: the card opens the run, with no pair of its own.
  await page.goto("/account/approvals");
  const card = page
    .locator("main")
    .getByRole("link", { name: "Review 2 changes" });
  await expect(card).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: "Approve" }),
  ).toHaveCount(0);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`${heldJob}$`, "u"));
  const decision = heldDecision(page);
  await expect(decision.getByTestId("review-change-change-1")).toContainText(
    "N18.4 → Remove · Kidney failure (N18.6) is coded, so no stage code goes beside it.",
  );
  await expect(decision.getByTestId("review-change-change-2")).toContainText(
    "Add Z99.2",
  );
  await expect(decision.getByRole("button", { name: "Approve" })).toHaveCount(
    0,
  );
  const save = decision.getByRole("button", { name: "Save review" });
  await expect(save).toBeDisabled();
  await expect(decision).toContainText("Accept or deny each change.");
  const deny = decision.getByRole("button", { name: "Deny: Add Z99.2" });
  await expect(deny).toHaveClass(/(?:^|\s)btn-danger(?:\s|$)/u);
  await decision
    .getByRole("button", { name: "Accept: N18.4 → Remove" })
    .click();
  await expect(save).toBeDisabled();
  await deny.click();
  await expect(deny).toHaveAttribute("aria-pressed", "true");
  await expect(save).toBeEnabled();
  await expect(decision).not.toContainText("Accept or deny each change.");
  await expectNoAxeViolations(page);
  await save.click();
  await expect(decision).toHaveCount(0);
  expect(await approvalStatuses()).toEqual(["approved"]);
  expect(
    (
      await fixtureRead<{
        reviewAnswers: { id: string; decision: string }[][];
      }>("counts")
    ).reviewAnswers,
  ).toEqual([
    [
      { id: "change-1", decision: "accepted" },
      { id: "change-2", decision: "denied" },
    ],
  ]);
  // Saved, the job goes on under its id, even with a change denied.
  await expect(page.locator("main").getByText(/^running$/iu)).toBeVisible();
});

test("Round 21 (F2) — a member reads a held run's changes and who may review them, with no pills", async ({
  page,
}) => {
  await fixtureControl("invoice-review-pending");
  await presentSession(page, "member");
  await page.goto(heldJob);
  const decision = heldDecision(page);
  await expect(decision.getByTestId("review-change-change-2")).toContainText(
    "Add Z99.2",
  );
  await expect(decision).toContainText(
    "Only an owner or admin can review this.",
  );
  await expect(decision.getByRole("button")).toHaveCount(0);
});

test("P6 — a member is told who can decide, and offered no button", async ({
  page,
}) => {
  await fixtureControl("invoice-approval-pending");
  await presentSession(page, "member");
  await page.goto(heldJob);
  await expect(heldDecision(page)).toContainText(
    "Only owner or admin can decide this.",
  );
  await expect(heldDecision(page).getByRole("button")).toHaveCount(0);
});

test("a member watching a job turn held is told who can decide, and offered no button, with no reload (§12.1 #300; #57's audit)", async ({
  page,
}) => {
  await fixtureControl("held-job-running");
  await presentSession(page, "member");
  await page.goto(heldJob);
  await expect(page.locator("main").getByText(/^running$/iu)).toBeVisible();
  // A reload from here on would lose this mark.
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
  await fixtureControl("held-job-holds");
  await expect(page.locator("main").getByText(/^held$/iu)).toBeVisible({
    timeout: 10_000,
  });
  await expect(heldDecision(page)).toContainText(
    "Only owner or admin can decide this.",
    { timeout: 15_000 },
  );
  await expect(heldDecision(page).getByRole("button")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => (window as unknown as { sameDocument?: boolean }).sameDocument,
    ),
  ).toBe(true);
});

test("R5c 1 — a job that reaches its approval while its page is open offers Approve and Deny under its result line with no reload: the job is read again until its approval form comes (Build 25; ADR-0048)", async ({
  page,
}) => {
  await fixtureControl("held-job-running");
  await page.goto(heldJob);
  const main = page.locator("main");
  await expect(main.getByText(/^running$/iu)).toBeVisible();
  await expect(main.getByRole("button", { name: "Approve" })).toHaveCount(0);
  // A reload from here on would lose this mark.
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
  const before = await heldJobReads();
  // It holds, and the first read of the job after does not hold its form yet.
  await fixtureControl("held-job-holds");
  await expect(main.getByText(/^held$/iu)).toBeVisible({ timeout: 10_000 });
  const decision = heldDecision(page);
  await expect(decision.getByRole("button", { name: "Approve" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(decision.getByRole("button", { name: "Deny" })).toBeVisible();
  await expect(resultLine(page)).toHaveText("Waiting for approval.");
  expect(
    await page.evaluate(
      () => (window as unknown as { sameDocument?: boolean }).sameDocument,
    ),
  ).toBe(true);
  const listed = await heldJobReads();
  expect(listed - before).toBeGreaterThanOrEqual(2);
  // Its form came: the job is not read again for it (Build 25's audit).
  await page.waitForTimeout(6_000);
  expect(await heldJobReads()).toBe(listed);
});

test("R5c 1 — a held job whose approval form never comes is read again for it at most ten times, then no more, and offers no button (Build 25's audit; ADR-0048)", async ({
  page,
}) => {
  test.setTimeout(75_000);
  await fixtureControl("held-job-holds?hidden=100000");
  const before = await heldJobReads();
  await page.goto(heldJob);
  const main = page.locator("main");
  await expect(main.getByText(/^held$/iu)).toBeVisible();
  // The read that drew the page, then HELD_APPROVAL_REREADS (10) more, each
  // 2 s after the last.
  await expect.poll(heldJobReads, { timeout: 45_000 }).toBe(before + 11);
  await page.waitForTimeout(6_000);
  expect(await heldJobReads()).toBe(before + 11);
  await expect(main.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(heldDecision(page)).toHaveCount(0);
});

test("R5c 1 — a held job that goes on while it is read for its approval offers nothing to decide, and its page never reads the approvals list (Build 25's audit; ADR-0048)", async ({
  page,
}) => {
  await fixtureControl("held-job-holds?hidden=100000");
  const before = await heldJobReads();
  await page.goto(heldJob);
  await expect
    .poll(heldJobReads, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(before + 3);
  await fixtureControl("held-job-running");
  await expect(page.locator("main").getByText(/^running$/iu)).toBeVisible({
    timeout: 10_000,
  });
  await expect(heldDecision(page)).toHaveCount(0);
  const at = await approvalListReads();
  await page.waitForTimeout(6_000);
  expect(await approvalListReads()).toBe(at);
});

test("a held job's re-read that fails costs only that read: the run page stays, and the next read offers Approve and Deny under its result line (Build 25's audit; ADR-0048)", async ({
  page,
}) => {
  // The read that draws the page holds no approval form yet; the first
  // re-read is refused (503), and the next one holds it.
  await fixtureControl("held-job-holds?hidden=1");
  await page.goto(heldJob);
  await expect(page.locator("main").getByText(/^held$/iu)).toBeVisible();
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
  await fixtureControl("run-reads-failing?count=1");
  const decision = heldDecision(page);
  await expect(decision.getByRole("button", { name: "Approve" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(decision.getByRole("button", { name: "Deny" })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toHaveCount(0);
  expect(
    (await fixtureRead<{ runReadsRefused: number }>("counts")).runReadsRefused,
  ).toBe(1);
  expect(
    await page.evaluate(
      () => (window as unknown as { sameDocument?: boolean }).sameDocument,
    ),
  ).toBe(true);
});

test("a job's re-reads refused several in a row cost only those reads: the run page stays as it was, and the next read draws what the job did (§12.1 #300; #57's audit)", async ({
  page,
}) => {
  await fixtureControl("held-job-running");
  await page.goto(heldJobDetails);
  const main = page.locator("main");
  await expect(main.getByText(/^running$/iu)).toBeVisible();
  await page.evaluate(() => Object.assign(window, { sameDocument: true }));
  // Drawn: the browser's next three reads of the job are refused (503).
  await fixtureControl("run-reads-failing?count=3");
  await expect
    .poll(
      async () =>
        (await fixtureRead<{ runReadsRefused: number }>("counts"))
          .runReadsRefused,
      { timeout: 20_000 },
    )
    .toBe(3);
  await expect(main.getByText(/^running$/iu)).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toHaveCount(0);
  // The next read answers: the job holds, and step 4 says so with no reload.
  await fixtureControl("held-job-holds");
  await expect(heldStep(page)).toHaveAttribute("data-state", "held", {
    timeout: 10_000,
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { sameDocument?: boolean }).sameDocument,
    ),
  ).toBe(true);
});

test('a flow that declares no word for its documents heads each one "Document n of 3", and so does a run whose flow the catalog does not list (backend 27.2.1; #58\'s audit)', async ({
  page,
}) => {
  for (const control of ["catalog-words-none", "catalog-empty"]) {
    await fixtureControl("reset");
    await fixtureControl(control);
    await page.goto("/account/runs/fixture-run-invoice");
    const cards = page.locator("main details[data-testid='block-section']");
    await expect(cards, control).toHaveCount(3);
    await expect(cards.nth(0).locator("summary"), control).toContainText(
      "Document 1 of 3",
    );
    await expect(page.locator("main"), control).not.toContainText(
      "Invoice 1 of 3",
    );
  }
});

test("an Approvals row whose flows or catalog cannot be read loses those words, never the page or its buttons (Build 25's audit; the review's R5c 6)", async ({
  page,
}) => {
  const title = page.getByTestId(
    "approval-title-a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1",
  );
  const main = page.locator("main");
  const drawn = async (headline: RegExp) => {
    await page.goto("/account/approvals");
    await expect(approvalRows(page)).toHaveCount(2);
    await expect(title).toHaveText(headline);
    await expect(main.getByRole("button", { name: "Approve" })).toHaveCount(2);
    await expect(main).not.toContainText("ask-approval");
  };
  await fixtureControl("approval-waiting");
  await fixtureControl("invoice-approval-pending");
  // The catalog unread: the flow's template id stands for its name.
  await fixtureControl("catalog-failing");
  await drawn(/^fixture-invoice · expires in \d+[hd]$/u);
  // The flows unread too: nothing to join the approval to.
  await fixtureControl("subscriptions-failing");
  await drawn(/^— · expires in \d+[hd]$/u);
  // The flows alone.
  await fixtureControl("reset");
  await fixtureControl("approval-waiting");
  await fixtureControl("invoice-approval-pending");
  await fixtureControl("subscriptions-failing");
  await drawn(/^— · expires in \d+[hd]$/u);
});

test("P7 — a decided row fades and folds away, its pill never Pending beside a decision; the other stays; the last one leaving goes to Activity", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await fixtureControl("invoice-approval-pending");
  await page.goto("/account/approvals");
  const rows = approvalRows(page);
  await expect(rows).toHaveCount(2);
  // Each row names its flow and the step it waits at, as the app does —
  // never the step id (Build 25, the review's R5c 6).
  await expect(
    page.getByTestId("approval-title-a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1"),
  ).toHaveText(
    /^Invoice Processing · Needs your approval · expires in \d+[hd]$/u,
  );
  await expect(page.locator("main")).not.toContainText("ask-approval");
  // Every pill a leaving row shows, as it shows it.
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { leavingPills: seen });
    new MutationObserver(() => {
      for (const row of document.querySelectorAll("[data-leaving]"))
        seen.push(
          row.querySelector('[data-testid^="approval-pill-"]')?.textContent ??
            "",
        );
    }).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
  const first = rows.first();
  // It folds, and fades, in the same 220 ms.
  expect(
    await first.evaluate((row) => getComputedStyle(row).transitionDuration),
  ).toBe("0.22s");
  await first.getByRole("button", { name: "Approve" }).click();
  await expect(rows).toHaveCount(1);
  const pills = await page.evaluate(
    () => (window as unknown as { leavingPills: string[] }).leavingPills,
  );
  expect(pills.length).toBeGreaterThan(0);
  expect(new Set(pills)).toEqual(new Set(["approved"]));
  await expect(page).toHaveURL(/\/account\/approvals$/u);
  await rows.first().getByRole("button", { name: "Deny" }).click();
  await expect(page).toHaveURL(/\/account\/runs$/u);
  expect(await approvalStatuses()).toEqual(["approved", "rejected"]);
});

// Build 24 (P12; backend ADR-0045): the run package — its buttons on a
// finished job's page, its page with the PDF itself, and the site's inline
// route. In one zone, so the zone each file is asked in is known; the signed
// link is the fixture's own HTTPS store, as the complete export's is.
test.describe("the run package", () => {
  test.use({ timezoneId: "America/Chicago", ignoreHTTPSErrors: true });
  const job = "/account/runs/fixture-run-invoice";
  const packagePage = `${job}/package`;
  const inline = `${packagePage}/file?timeZone=America%2FChicago`;
  const signedLink = (format: string) =>
    `https://127.0.0.1:3443/__fixture/package-file?run=fixture-run-invoice&format=${format}`;
  const packageFiles = async () =>
    (
      await fixtureRead<{
        packageFiles: {
          runId: string;
          format: string;
          timeZone: string | null;
          keyed: boolean;
        }[];
      }>("counts")
    ).packageFiles;

  test("P12 — a finished job offers View package, Download PDF and Download Excel — no Download JSON; each download asks in the browser's zone, with a key, and goes to its signed link", async ({
    page,
  }) => {
    await page.goto(job);
    const main = page.locator("main");
    await expect(
      main.getByRole("button", { name: "Download JSON" }),
    ).toHaveCount(0);
    await expect(
      main.getByRole("link", { name: "View package" }),
    ).toHaveAttribute("href", packagePage);
    for (const [name, format] of [
      ["Download PDF", "pdf"],
      ["Download Excel", "xlsx"],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        main.getByRole("button", { name }).click(),
      ]);
      expect(download.url()).toBe(signedLink(format));
      expect(download.suggestedFilename()).toBe(
        `run-fixture-run-invoice.${format}`,
      );
      // Nothing was left: the signed link saved the file.
      await expect(page).toHaveURL(new RegExp(`${job}$`, "u"));
    }
    expect(await packageFiles()).toEqual([
      {
        runId: "fixture-run-invoice",
        format: "pdf",
        timeZone: "America/Chicago",
        keyed: true,
      },
      {
        runId: "fixture-run-invoice",
        format: "xlsx",
        timeZone: "America/Chicago",
        keyed: true,
      },
    ]);
    // Not while a job goes on: nothing to package yet.
    await page.goto("/account/runs/fixture-run-running");
    await expect(
      page.locator("main").getByRole("button", { name: "Download PDF" }),
    ).toHaveCount(0);
  });

  test("P12 — the platform busy building others: asked once more after its wait, then said", async ({
    page,
  }) => {
    await fixtureControl("package-busy");
    await page.goto(job);
    const main = page.locator("main");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      main.getByRole("button", { name: "Download PDF" }).click(),
    ]);
    expect(download.url()).toBe(signedLink("pdf"));
    expect((await packageFiles()).length).toBe(2);
    await fixtureControl("package-busy-twice");
    await main.getByRole("button", { name: "Download PDF" }).click();
    await expect(main.getByRole("alert")).toHaveText(
      "Could not download. Try again.",
    );
    expect((await packageFiles()).length).toBe(4);
  });

  test("R5c 2 — a signed link that is not https is never followed: Download PDF and Download Excel say they could not download, and the page stays (Build 25)", async ({
    page,
  }) => {
    let downloads = 0;
    page.on("download", () => (downloads += 1));
    for (const scheme of ["http", "javascript"]) {
      await fixtureControl(`signed-link-scheme?scheme=${scheme}`);
      for (const name of ["Download PDF", "Download Excel"]) {
        await page.goto(job);
        const title = await page.title();
        const main = page.locator("main");
        await main.getByRole("button", { name }).click();
        await expect(main.getByRole("alert")).toHaveText(
          "Could not download. Try again.",
        );
        await expect(main.getByRole("button", { name })).toBeEnabled();
        await expect(page).toHaveURL(new RegExp(`${job}$`, "u"));
        expect(await page.title()).toBe(title);
      }
    }
    expect(downloads).toBe(0);
    expect((await packageFiles()).length).toBe(4);
  });

  test("F4 — Share reads nothing until it is pressed: on the run page the first press reads the PDF, busy, and the next hands it to the sheet; the package page shares its frame's own bytes, read once (the review's finding 1)", async ({
    page,
  }) => {
    await standInShareSheet(page);
    const reads = observe(page, (request) => {
      const { pathname } = new URL(request.url());
      return (
        pathname === "/account/share" || pathname.endsWith("/package/file")
      );
    });
    await page.goto(job);
    const main = page.locator("main");
    const share = main.getByRole("button", { name: "Share" });
    await expect(share).toBeEnabled();
    await page.waitForLoadState("networkidle");
    expect(reads).toEqual([]);
    expect(await packageFiles()).toEqual([]);
    // The first press reads it, through this site's share route; nothing
    // is handed on yet.
    await share.click();
    await expect.poll(() => reads.length).toBe(1);
    expect(new URL(reads[0]!).pathname).toBe("/account/share");
    await expect(share).toBeEnabled();
    expect(await shared(page)).toBeUndefined();
    // The next hands the file kept to the sheet, and reads nothing.
    await share.click();
    await expect
      .poll(() => shared(page))
      .toMatchObject({
        name: "run-fixture-run-invoice.pdf",
        type: "application/pdf",
      });
    expect(reads).toHaveLength(1);
    // The package page: its frame's read, the one; Share hands those bytes
    // on at the first press.
    reads.length = 0;
    await page.goto(packagePage);
    await expect(main.locator('iframe[title="Run package"]')).toHaveAttribute(
      "src",
      /^blob:/u,
    );
    await expect(share).toBeEnabled();
    await share.click();
    await expect
      .poll(() => shared(page))
      .toMatchObject({
        name: "run-fixture-run-invoice.pdf",
        type: "application/pdf",
      });
    expect(
      reads.map((url) => new URL(url).pathname + new URL(url).search),
    ).toEqual([inline]);
  });

  test("P12 — View package opens the package page: the PDF itself in a frame, read once from the site's inline route, Download PDF and Download Excel, Back to the run; axe clean", async ({
    page,
  }) => {
    const reads = observe(page, (request) =>
      new URL(request.url()).pathname.endsWith("/package/file"),
    );
    await page.goto(job);
    await page
      .locator("main")
      .getByRole("link", { name: "View package" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${packagePage}$`, "u"));
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Run package",
    );
    await expect(main).toContainText("Run fixture-run-invoice");
    const frame = main.locator('iframe[title="Run package"]');
    await expect(frame).toHaveAttribute("src", /^blob:/u);
    expect(reads.map((url) => url.slice(url.indexOf("/account/")))).toEqual([
      inline,
    ]);
    await expect(
      main.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();
    await expect(
      main.getByRole("button", { name: "Download Excel" }),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: "View package" })).toHaveCount(
      0,
    );
    await expect(main.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      job,
    );
    // The page's own markup; the frame holds a PDF, not this site's page.
    await expect(page).toHaveTitle(/\S/u);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .exclude('iframe[title="Run package"]')
      .analyze();
    expect(results.violations).toEqual([]);
    // The frame's route: the PDF inline, never cached, framed by this site.
    // The frame's request says it is this site's (`sec-fetch-site`), as every
    // current browser's does.
    const sameSite = { headers: { "sec-fetch-site": "same-origin" } };
    const answer = await page.request.get(inline, sameSite);
    expect(answer.status()).toBe(200);
    expect(answer.headers()["content-type"]).toBe("application/pdf");
    // The platform's name for the file, the job's own id.
    expect(answer.headers()["content-disposition"]).toBe(
      'inline; filename="run-fixture-run-invoice.pdf"',
    );
    expect(answer.headers()["cache-control"]).toBe("private, no-store");
    expect(answer.headers()["content-security-policy"]).toBe(
      "frame-ancestors 'self'",
    );
    expect((await answer.body()).subarray(0, 5).toString("latin1")).toBe(
      "%PDF-",
    );
    expect(
      (await packageFiles()).filter((asked) => asked.format === "pdf").at(-1),
    ).toEqual({
      runId: "fixture-run-invoice",
      format: "pdf",
      timeZone: "America/Chicago",
      keyed: true,
    });
    // A request another site started is refused.
    const crossSite = await page.request.get(inline, {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(crossSite.status()).toBe(403);
    // And one that does not say where it came from.
    expect((await page.request.get(inline)).status()).toBe(403);
  });

  test("P12 — a job with no package yet says so, with the way back; its route answers 409; a signed file over the bound is refused", async ({
    page,
  }) => {
    await page.goto("/account/runs/fixture-run-running/package");
    const main = page.locator("main");
    await expect(main).toContainText("This run has no package yet.");
    await expect(main.locator("iframe")).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/account/runs/fixture-run-running",
    );
    const none = await page.request.get(
      "/account/runs/fixture-run-running/package/file",
      { headers: { "sec-fetch-site": "same-origin" } },
    );
    expect(none.status()).toBe(409);
    expect(await none.text()).toBe("This run has no package yet.");
    await fixtureControl("package-file-oversized");
    const oversized = await page.request.get(inline, {
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(oversized.status()).toBe(413);
    expect(oversized.headers()["content-type"]).not.toBe("application/pdf");
  });

  test("the package page's Download PDF and Download Excel go to the https signed link, and never to one that is not https (Build 25's audit; the review's R5c 2)", async ({
    page,
  }) => {
    // Only the platform's signed links count: a headless browser may save the
    // page's own PDF frame, the inline route, as a download too.
    const fromSignedLink = (download: Download) =>
      download.url().startsWith("https://127.0.0.1:3443/");
    const main = page.locator("main");
    await page.goto(packagePage);
    for (const [name, format] of [
      ["Download PDF", "pdf"],
      ["Download Excel", "xlsx"],
    ] as const) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { predicate: fromSignedLink }),
        main.getByRole("button", { name }).click(),
      ]);
      expect(download.url()).toBe(signedLink(format));
      await expect(page).toHaveURL(new RegExp(`${packagePage}$`, "u"));
    }
    let downloads = 0;
    page.on("download", (download) => {
      if (fromSignedLink(download)) downloads += 1;
    });
    for (const scheme of ["http", "javascript"]) {
      await fixtureControl(`signed-link-scheme?scheme=${scheme}`);
      for (const name of ["Download PDF", "Download Excel"]) {
        await page.goto(packagePage);
        const title = await page.title();
        await main.getByRole("button", { name }).click();
        await expect(
          main.getByRole("alert").filter({ hasText: "Could not download" }),
        ).toHaveText("Could not download. Try again.");
        await expect(main.getByRole("button", { name })).toBeEnabled();
        await expect(page).toHaveURL(new RegExp(`${packagePage}$`, "u"));
        expect(await page.title()).toBe(title);
      }
    }
    expect(downloads).toBe(0);
  });

  test("the package page's route asks a platform busy building others once more after its wait, and says it could not open the package when busy twice (Build 25's audit; the review's R5c 5)", async ({
    page,
  }) => {
    const sameSite = { headers: { "sec-fetch-site": "same-origin" } };
    await fixtureControl("package-busy");
    const before = (await packageFiles()).length;
    const answer = await page.request.get(inline, sameSite);
    expect(answer.status()).toBe(200);
    expect(answer.headers()["content-type"]).toBe("application/pdf");
    expect((await answer.body()).subarray(0, 5).toString("latin1")).toBe(
      "%PDF-",
    );
    // Once busy, once more.
    expect((await packageFiles()).length - before).toBe(2);
    await fixtureControl("package-busy-twice");
    const again = (await packageFiles()).length;
    const refused = await page.request.get(inline, sameSite);
    expect(refused.status()).toBe(502);
    expect(await refused.text()).toBe("Could not open the package. Try again.");
    // Never a third time.
    expect((await packageFiles()).length - again).toBe(2);
  });

  test("F4 — Share when the platform cannot make the package: this site's share route answers 502, the run page says it could not share under its buttons, nothing reaches the sheet, and Share can be pressed again; a cross-site ask of the route is refused (Round 21 v2)", async ({
    page,
  }) => {
    await standInShareSheet(page);
    const answers: number[] = [];
    page.on("response", (response) => {
      if (new URL(response.url()).pathname === "/account/share")
        answers.push(response.status());
    });
    await fixtureControl("package-failing");
    await page.goto(job);
    const actions = page.getByTestId("package-actions");
    const share = actions.getByRole("button", { name: "Share" });
    await share.click();
    await expect(actions).toContainText("Could not share. Try again.");
    await expect.poll(() => answers).toEqual([502]);
    expect(await shared(page)).toBeUndefined();
    await expect(share).toBeEnabled();
    const crossSite = await page.request.get(
      "/account/share?run=fixture-run-invoice&format=pdf",
      { headers: { "sec-fetch-site": "cross-site" } },
    );
    expect(crossSite.status()).toBe(403);
  });
});

// Round 21 v2 (backend ADR-0048 amendment 1): the platform's published block
// fixtures, served by the fixture under `blocks-{name}` run ids, as a person
// uses them — the picture, a group of drop-downs, and a long list or table's
// search, sort and pages.
test.describe("the image block (Round 21 v2)", () => {
  const imageRun = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
  const filePage = `/account/runs/${imageRun}/files/0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e`;
  const viewReads = (page: Page) =>
    observe(page, (request) =>
      new URL(request.url()).pathname.endsWith("/view"),
    );

  test("a picture is read once, from its file page's own route, drawn from those bytes inside a link to that page, and let go when it leaves; a scanned PDF is a frame 480 px tall titled by its alt", async ({
    page,
  }) => {
    const views = viewReads(page);
    // Every object URL the page lets go, as the page itself calls it: WebKit
    // still answers a fetch of a released blob: URL for a while, so the
    // release is read where it happens, not from a later fetch.
    await page.addInitScript(() => {
      const released: string[] = [];
      const revoke = URL.revokeObjectURL.bind(URL);
      (window as unknown as { released: string[] }).released = released;
      URL.revokeObjectURL = (url: string) => {
        released.push(url);
        revoke(url);
      };
    });
    await page.goto("/account/runs/blocks-drawn-image");
    const picture = page.getByTestId("block-image");
    const image = picture.locator("img");
    await expect(image).toHaveAttribute("src", /^blob:/u);
    await expect(image).toHaveAttribute(
      "alt",
      "The receipt from Harbor Paper Co.",
    );
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) =>
          element.complete ? element.naturalWidth : 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect(picture).toHaveAttribute("href", filePage);
    expect(views.map((url) => new URL(url).pathname)).toEqual([
      `${filePage}/view`,
    ]);
    // Leaving the picture lets its object URL go.
    const objectUrl = await image.getAttribute("src");
    await image.click();
    await expect(page).toHaveURL(new RegExp(`${filePage}$`, "u"));
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { released: string[] }).released,
        ),
      )
      .toContain(objectUrl);
    await page.goto("/account/runs/blocks-drawn-image-pdf");
    const frame = page.locator('iframe[data-testid="block-image"]');
    await expect(frame).toHaveAttribute("title", "The scanned delivery note");
    await expect(frame).toHaveAttribute("src", /^blob:/u);
    expect(Math.round((await frame.boundingBox())?.height ?? 0)).toBe(480);
  });

  test("a picture whose file is gone says so, with no Try again; any other failure says it could not open the file, and Try again reads it once more and draws it", async ({
    page,
  }) => {
    const picture = page.getByTestId("block-image");
    await fixtureControl("picture-gone");
    await page.goto("/account/runs/blocks-drawn-image");
    await expect(picture).toHaveText("This file is no longer kept.");
    await expect(
      picture.getByRole("button", { name: "Try again" }),
    ).toHaveCount(0);
    await fixtureControl("reset");
    await fixtureControl("picture-failing-once");
    const views = viewReads(page);
    await page.goto("/account/runs/blocks-drawn-image");
    await expect(picture).toContainText("Could not open the file. Try again.");
    expect(views).toHaveLength(1);
    await picture.getByRole("button", { name: "Try again" }).click();
    await expect(picture.locator("img")).toHaveAttribute("src", /^blob:/u);
    expect(views).toHaveLength(2);
  });
});

test("a group: its title over one card of drop-downs, the first open; each opens and closes on its own, several open at once (Round 21 v2, F6)", async ({
  page,
}) => {
  await page.goto("/account/runs/blocks-reviewer-candidate-grouped");
  const group = page.getByTestId("block-group");
  await expect(group).toHaveCount(1);
  await expect(group.getByTestId("block-group-title")).toHaveText(
    /^candidate details$/iu,
  );
  const sections = group.locator('details[data-testid="block-section"]');
  await expect(sections).toHaveCount(2);
  await expect(sections.nth(0)).toHaveAttribute("open", "");
  await expect(sections.nth(1)).not.toHaveAttribute("open", "");
  await expect(group.getByText("Payroll Lead")).toBeVisible();
  await expect(group.getByText("B.S. Accounting")).toBeHidden();
  await sections.nth(1).locator("summary").click();
  await expect(sections.nth(1)).toHaveAttribute("open", "");
  await expect(sections.nth(0)).toHaveAttribute("open", "");
  await expect(group.getByText("B.S. Accounting")).toBeVisible();
  await sections.nth(0).locator("summary").click();
  await expect(sections.nth(0)).not.toHaveAttribute("open", "");
  await expect(sections.nth(1)).toHaveAttribute("open", "");
});

/** A long block's numbers as drawn, in order: "$12.50", "Score 40" → 12.5, 40. */
const numbersOf = async (cells: Locator) =>
  (await cells.allInnerTexts()).map((text) =>
    Number(text.replace(/[^0-9.]/gu, "")),
  );
const nonIncreasing = (values: number[]) =>
  values.every((value, at) => at === 0 || values[at - 1]! >= value);

test("a long list: 25 rows a page, Next and Previous; a sort high to low orders across the pages and goes back to page 1; Search finds a row and a miss says so; Clear search brings every row back (Round 21 v2; ADR-0048 amendment 1)", async ({
  page,
}) => {
  await page.goto("/account/runs/blocks-long-list");
  const paged = page.getByTestId("block-paged");
  const rows = paged.getByTestId("block-list").locator(":scope > li");
  const pager = paged.getByTestId("list-pager");
  await expect(rows).toHaveCount(25);
  await expect(pager).toContainText("Page 1 of 2");
  await paged.getByRole("button", { name: "Next page" }).click();
  await expect(pager).toContainText("Page 2 of 2");
  await expect(rows).toHaveCount(5);
  await paged.getByRole("button", { name: "Previous page" }).click();
  await expect(pager).toContainText("Page 1 of 2");
  await paged.getByRole("button", { name: "Next page" }).click();
  // A sort: the order as sent first, then high to low; page 1 again.
  await paged.getByTestId("list-sort").click();
  const menu = page.getByTestId("list-sort-menu");
  await expect(menu.getByRole("option").first()).toHaveText("Default order");
  await menu.getByRole("option", { name: "Score: high to low" }).click();
  await expect(pager).toContainText("Page 1 of 2");
  const values = paged.getByTestId("block-list-value");
  await expect(values).toHaveCount(25);
  const first = await numbersOf(values);
  expect(nonIncreasing(first)).toBe(true);
  await paged.getByRole("button", { name: "Next page" }).click();
  await expect(values).toHaveCount(5);
  const second = await numbersOf(values);
  expect(nonIncreasing([...first, ...second])).toBe(true);
  // Search: one row, on page 1 of 1; a miss; then every row again.
  const search = paged.getByTestId("list-search");
  await expect(search).toHaveAttribute("placeholder", "Search");
  await search.fill("Applicant 07");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Applicant 07");
  await expect(pager).toContainText("Page 1 of 1");
  await search.fill("zzzz");
  await expect(paged).toContainText('Nothing matches "zzzz".');
  await paged.getByRole("button", { name: "Clear search" }).click();
  await expect(rows).toHaveCount(25);
  await expect(search).toHaveValue("");
});

test("a long table: sorted by its number column high to low across its pages, and searched case-free in any cell (Round 21 v2; ADR-0048 amendment 1)", async ({
  page,
}) => {
  await page.goto("/account/runs/blocks-long-table");
  const paged = page.getByTestId("block-paged");
  const rows = paged.getByTestId("block-table").locator("tbody tr");
  const pager = paged.getByTestId("list-pager");
  await expect(rows).toHaveCount(25);
  await expect(pager).toContainText("Page 1 of 2");
  await paged.getByTestId("list-sort").click();
  await page
    .getByTestId("list-sort-menu")
    .getByRole("option", { name: "Total: high to low" })
    .click();
  const totals = rows.locator("td:nth-child(2)");
  await expect
    .poll(async () => nonIncreasing(await numbersOf(totals)))
    .toBe(true);
  const first = await numbersOf(totals);
  expect(first).toHaveLength(25);
  await paged.getByRole("button", { name: "Next page" }).click();
  await expect(rows).toHaveCount(5);
  expect(nonIncreasing([...first, ...(await numbersOf(totals))])).toBe(true);
  await paged.getByTestId("list-search").fill("lark");
  await expect(rows).toHaveCount(5);
  for (const text of await rows.allInnerTexts())
    expect(text).toContain("Lark Labels");
});

test("Activity's search, sort and pages: Enter puts q in the address and the platform is asked for it, with the flow, the outcome and the time, and never needsReview; × clears it; counted past 25, Oldest first and Next page are each an address the platform reads; a search that finds nothing says so (Round 21 v2; ADR-0048 amendment 1)", async ({
  page,
}) => {
  const asked = async () =>
    (await fixtureRead<{ runsQueries: string[] }>("counts")).runsQueries;
  const lastAsked = async () => (await asked()).at(-1)?.replace(/^\?/u, "");
  await page.goto("/account/runs");
  const search = page.getByTestId("activity-search");
  await expect(search).toHaveAttribute("placeholder", "Search runs");
  expect(await lastAsked()).toBe("sort=newest&page=1");
  // An answer without a count is one page: no sort, no pager.
  await expect(page.getByTestId("activity-sort")).toHaveCount(0);
  await expect(page.getByTestId("activity-pager")).toHaveCount(0);
  await search.fill("Invoice");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/account\/runs\?q=Invoice$/u);
  await expect.poll(lastAsked).toBe("q=Invoice&sort=newest&page=1");
  await expect(search).toHaveValue("Invoice");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page).toHaveURL(/\/account\/runs$/u);
  // The flow, the outcome and the time go on as the platform's own.
  const since = "2026-10-26T04:00:00.000Z";
  await page.goto(
    `/account/runs?status=failed&since=${encodeURIComponent(since)}&flow=99999999-9999-4999-8999-999999999999`,
  );
  await expect(search).toBeVisible();
  expect(await lastAsked()).toBe(
    new URLSearchParams({
      subscriptionId: "99999999-9999-4999-8999-999999999999",
      status: "failed",
      since,
      sort: "newest",
      page: "1",
    }).toString(),
  );
  // The platform that counts: a miss, then 30 runs on two pages.
  await fixtureControl("runs-counted");
  await page.goto("/account/runs?q=zzzz");
  await expect(page.locator("main")).toContainText('Nothing matches "zzzz".');
  await page.goto("/account/runs");
  const pager = page.getByTestId("activity-pager");
  const rows = page.getByTestId("activity-runs").locator(":scope > li");
  await expect(pager).toContainText("Page 1 of 2");
  await expect(rows).toHaveCount(25);
  await expect(rows.first()).toContainText("Run fixture-counted-01");
  const sort = page.getByTestId("activity-sort");
  await expect(sort).toHaveText("Newest first");
  await sort.click();
  await page
    .getByTestId("activity-sort-menu")
    .getByRole("option", { name: "Oldest first" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\?sort=oldest$/u);
  await expect(rows.first()).toContainText("Run fixture-counted-30");
  await expect.poll(lastAsked).toBe("sort=oldest&page=1");
  await pager.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/\/account\/runs\?sort=oldest&page=2$/u);
  await expect(rows).toHaveCount(5);
  await expect(pager).toContainText("Page 2 of 2");
  await expect.poll(lastAsked).toBe("sort=oldest&page=2");
  expect(
    (await asked()).every(
      (query) => !new URLSearchParams(query).has("needsReview"),
    ),
  ).toBe(true);
});

test("P7 — under reduced motion a decided row leaves at once, with no fade", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixtureControl("approval-waiting");
  await fixtureControl("invoice-approval-pending");
  await page.goto("/account/approvals");
  const rows = approvalRows(page);
  await expect(rows).toHaveCount(2);
  expect(
    await rows
      .first()
      .evaluate((row) => getComputedStyle(row).transitionDuration),
  ).toBe("0s");
  await rows.first().getByRole("button", { name: "Approve" }).click();
  await expect(rows).toHaveCount(1);
});

test("18 — billing with no provider configured (503) is said to be unavailable, and offers nothing", async ({
  page,
}) => {
  await fixtureControl("billing-not-configured");
  await page.goto("/account/billing");
  await expect(
    page.getByText("Billing is unavailable right now."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Choose plan|Manage billing/ }),
  ).toHaveCount(0);
});

test("20 — the Teams pages: an unknown team is not found, and a team's page goes back to Teams", async ({
  page,
}) => {
  const unknown = await page.goto(
    "/account/teams/99999999-9999-4999-8999-999999999999",
  );
  expect(unknown?.status()).toBe(404);
  await page.goto(organizationProject);
  await page.getByRole("link", { name: "Back to departments" }).click();
  await expect(page).toHaveURL(/\/account\/teams$/);
});

test('a webhook address opened after another tab switched workspace is refused, never read as "no address yet" (register F28)', async ({
  page,
}) => {
  await page.goto(FLOWS.webhook);
  const open = page.locator("main").getByRole("button", {
    name: "Webhook address",
  });
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await open.click();
  await dialog.getByRole("button", { name: "Create address" }).click();
  await expect(
    dialog.locator("code").filter({ hasText: "/v1/webhooks/" }),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close" }).click();
  await switchInAnotherTab(page, /Fixture Personal/);
  await open.click();
  await expect(dialog.getByRole("alert")).toHaveText(workspaceChanged);
  await expect(dialog.getByText("This flow has no address yet.")).toHaveCount(
    0,
  );
  await expect(
    dialog.getByRole("button", { name: /Create address|Make a new secret/u }),
  ).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  await switchInAnotherTab(page, /Fixture Organization/);
});

// Register F70 (Round 15's close): every action on these pages acted on the
// workspace active NOW. After a switch in another tab, Add and Connect wrote into
// a workspace the person was not looking at; the rest read its 404 as this
// page's answer. Each is refused in words, and nothing changes.
test("every flow control on a page whose workspace another tab switched away is refused in words, and changes nothing (register F70)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  const project = automationCard(page, "Project automation");
  await expect(project.getByRole("button", { name: "Add" })).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);
  await project.getByRole("button", { name: "Add" }).click();
  await expect(project.getByRole("alert")).toHaveText(workspaceChanged);
  await switchInAnotherTab(page, /Fixture Organization/);

  // The manual flow's page: Pause, and Step 1's run.
  await page.goto(FLOWS.manual);
  const main = page.locator("main");
  await switchInAnotherTab(page, /Fixture Personal/);
  await main.getByRole("button", { name: "Pause" }).click();
  await expect(main.getByRole("alert")).toHaveText(workspaceChanged);
  const run = main.getByTestId("run-form");
  // A file chosen now is refused as it is opened. One opened before the switch
  // is refused as it completes ("a file opened before another tab switched …").
  await run.getByLabel("Invoice file").setInputFiles({
    name: "invoice.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fixture"),
  });
  await expect(run.getByRole("alert")).toHaveText(workspaceChanged);
  await run.getByLabel("Invoice file").setInputFiles([]);
  await run.getByLabel("Vendor").fill("Acme Supplies");
  await run.getByLabel("Amount").fill("120.50");
  await run.getByLabel("Invoice reference").fill("INV-1001");
  await run.getByRole("button", { name: "Start run" }).click();
  await expect(run.getByRole("alert")).toHaveText(workspaceChanged);
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}$`, "u"));
  await switchInAnotherTab(page, /Fixture Organization/);

  // Invoice Processing's email page: Add and a remove (Build 22, P5).
  await page.goto(`${FLOWS.invoice}/email`);
  await switchInAnotherTab(page, /Fixture Personal/);
  const also = main.getByTestId("email-also");
  await also
    .getByRole("textbox", { name: "Email address" })
    .fill("bookkeeper@example.com");
  await also.getByRole("button", { name: "Add" }).click();
  await expect(also.getByRole("alert")).toHaveText(workspaceChanged);
  await also.getByRole("button", { name: "Remove ap@example.com" }).click();
  await expect(also.getByRole("alert")).toHaveText(workspaceChanged);
  await switchInAnotherTab(page, /Fixture Organization/);

  // The archivable flow's page: Archive.
  await page.goto(FLOWS.archivable);
  await switchInAnotherTab(page, /Fixture Personal/);
  await main.getByRole("button", { name: "Archive flow" }).click();
  const archive = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  await archive.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(archive.getByRole("alert")).toHaveText(workspaceChanged);
  await archive.getByRole("button", { name: "Cancel" }).click();

  // Back on the workspace the page showed, nothing moved.
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto("/account/flows");
  await expect(project.getByRole("combobox")).toHaveCount(0);
  await expect(project.getByRole("button", { name: "Add" })).toBeVisible();
  await page.goto(FLOWS.manual);
  await expect(main.getByText(/^live$/i)).toBeVisible();
  await page.goto(`${FLOWS.invoice}/email`);
  await expect(
    main.getByTestId("email-also").locator("[data-connection-row]"),
  ).toHaveText(["ap@example.com"]);
  await page.goto(FLOWS.archivable);
  await expect(
    main.getByRole("button", { name: "Archive flow" }),
  ).toBeVisible();
});

test("Set up and Turn on on a page whose workspace another tab switched away are refused in words, and nothing is saved or goes live (register F70)", async ({
  page,
}) => {
  await page.goto(FLOWS.manual);
  const main = page.locator("main");
  await main.getByRole("button", { name: "Pause" }).click();
  await expect(main.getByText(/^paused$/i)).toBeVisible();
  await main.getByRole("link", { name: "Edit setup" }).click();
  await expect(main.getByLabel("Spending limit")).toHaveValue("500");
  await main.getByLabel("Spending limit").fill("99");
  await switchInAnotherTab(page, /Fixture Personal/);

  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(main.getByRole("alert")).toHaveText(workspaceChanged);
  await expect(main.getByLabel("Spending limit")).toHaveValue("99");

  // The flow's page, drawn on its workspace, then switched away.
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto(FLOWS.manual);
  await switchInAnotherTab(page, /Fixture Personal/);
  await main.getByRole("button", { name: "Turn on" }).click();
  await expect(main.getByRole("alert")).toHaveText(workspaceChanged);

  // Back on the workspace the page showed, nothing moved.
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(main.getByText(/^paused$/i)).toBeVisible();
  await page.goto(`${FLOWS.manual}/setup`);
  await expect(main.getByLabel("Spending limit")).toHaveValue("500");
});

test("an approval decided on a page whose workspace another tab switched away is refused, and still waits (register F70)", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );
  expect(await approvalStatuses()).toEqual(["pending"]);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
});

test("a denial on a page whose workspace another tab switched away is refused, and still waits (register F70)", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);
  await page.getByRole("button", { name: "Deny" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );
  expect(await approvalStatuses()).toEqual(["pending"]);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Deny" })).toBeVisible();
});

test("a connection started or removed on a page whose workspace another tab switched away is refused, and nothing is connected or removed (register F70)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const quickbooks = connectionRow(page, "quickbooks");
  const key = connectionRow(page, "fixture-key");
  // The live connection, and the control on it.
  const disconnect = page.getByRole("button", {
    name: "Disconnect Fixture OAuth provider",
  });
  await expect(disconnect).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);

  await quickbooks
    .getByRole("button", { name: "Connect QuickBooks Online" })
    .click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );

  await disconnect.click();
  const confirm = page.getByRole("dialog", {
    name: "Disconnect Fixture OAuth provider?",
  });
  await confirm
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(confirm.getByRole("alert")).toHaveText(workspaceChanged);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await key
    .getByRole("button", { name: "Connect Fixture key provider" })
    .click();
  const connect = page.getByRole("dialog", {
    name: "Connect Fixture key provider",
  });
  await connect.getByLabel("API key").fill("fixture-value");
  await connect.getByRole("button", { name: "Verify and connect" }).click();
  await expect(connect.getByRole("alert")).toHaveText(workspaceChanged);
  await connect.getByRole("button", { name: "Cancel" }).click();

  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto("/account/connections");
  await expect(disconnect).toBeVisible();
  await expect(quickbooks).toContainText("Not connected");
  await expect(
    key.getByRole("button", { name: "Connect Fixture key provider" }),
  ).toBeVisible();
});

test("a provider connected on a page whose workspace another tab switched away is refused, and no consent is asked for (register F70)", async ({
  page,
}) => {
  const consent = observe(page, (request) =>
    request.url().startsWith("https://oauth.invalid/"),
  );
  await page.goto("/account/connections");
  await page
    .getByRole("button", { name: "Disconnect Fixture OAuth provider" })
    .click();
  await page
    .getByRole("dialog", { name: "Disconnect Fixture OAuth provider?" })
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  const connect = connectionRow(page, "fixture-oauth").getByRole("button", {
    name: "Connect Fixture OAuth provider",
  });
  await expect(connect).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);
  await connect.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );
  await expect(page).toHaveURL(/\/account\/connections$/);
  expect(consent).toEqual([]);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(connect).toBeVisible();
});

test("a vendor connected from a flow step's rows on a page whose workspace another tab switched away is refused under its row, saves nothing and asks no consent (Build 25's audit; the review's R5c 5)", async ({
  page,
}) => {
  const consent = observe(
    page,
    (request) =>
      request.url().includes("/connections?status=") ||
      request.url().startsWith("https://oauth.invalid/"),
  );
  const invoiceSettings = async () =>
    (await fixtureRead<{ invoiceConfig: Record<string, unknown> }>("counts"))
      .invoiceConfig;
  const before = await invoiceSettings();
  const vendorPage = `${FLOWS.invoice}/vendor?field=vendor`;
  await page.goto(vendorPage);
  const main = page.locator("main");
  const quickbooks = main.getByRole("radio", { name: "QuickBooks Online" });
  await expect(quickbooks).toBeEnabled();
  await switchInAnotherTab(page, /Fixture Personal/);
  await quickbooks.click();
  await expect(main.getByRole("alert")).toHaveText(workspaceChanged);
  await expect(page).toHaveURL(
    new RegExp(`${FLOWS.invoice}/vendor\\?field=vendor$`, "u"),
  );
  await expect(quickbooks).toBeEnabled();
  expect(consent).toEqual([]);
  expect(await invoiceSettings()).toEqual(before);
  await switchInAnotherTab(page, /Fixture Organization/);
});

test("22 — a page outside the account area that cannot load says so, and Try again loads it once it can", async ({
  page,
}) => {
  await presentSession(page, "requester");
  await fixtureControl("discovery-failing");
  const reads = observe(page, (request) =>
    request.url().includes("/onboarding/join-org"),
  );
  await page.goto(joinLink);
  await expect(
    page.getByRole("heading", { name: "This page could not load" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await fixtureControl("reset");
  const before = reads.length;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => reads.length).toBeGreaterThan(before);
  await expect(
    page.getByRole("button", { name: "Join Fixture Organization" }),
  ).toBeVisible();
});

test("24, 25 — /api/session is gone (404), and /api/ready reports the platform's readiness, 503 when it is not ready", async ({
  page,
}) => {
  expect((await page.request.get("/api/session")).status()).toBe(404);
  const ready = await page.request.get("/api/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toMatchObject({ status: "ready" });
  await fixtureControl("not-ready");
  const notReady = await page.request.get("/api/ready");
  expect(notReady.status()).toBe(503);
  expect(await notReady.json()).toEqual({
    status: "not-ready",
    backend: "unreachable",
  });
});

test("26 — each account page reads the workspace list once, counted at the platform (register F27)", async ({
  page,
}) => {
  for (const path of [
    "/account",
    "/account/flows",
    organizationProject,
    "/account/teams",
    "/account/settings",
    // The run page too (§12.1 #300; #57's audit).
    "/account/runs/fixture-run-invoice",
  ]) {
    await fixtureControl("reset");
    await page.goto(path);
    const { workspaceListReads } = await fixtureRead<{
      workspaceListReads: number;
    }>("counts");
    expect(workspaceListReads, path).toBe(1);
  }
});

// The grey a mark is drawn in, from a screenshot of it: of the greys that each
// cover at least 2% of its box, the darkest — on the light ground, the mark's
// own colour, its anti-aliased edge and the ground lighter. Decoded on a blank
// page of the same browser, where no policy of the site's applies.
async function darkestGrey(page: Page, element: Locator): Promise<number> {
  const png = (await element.screenshot()).toString("base64");
  const blank = await page.context().newPage();
  try {
    return await blank.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, image.width, image.height).data;
      const counts = new Map<number, number>();
      for (let index = 0; index < pixels.length; index += 4) {
        const [red, green, blue] = [
          pixels[index],
          pixels[index + 1],
          pixels[index + 2],
        ];
        if (Math.abs(red - green) > 2 || Math.abs(green - blue) > 2) continue;
        counts.set(red, (counts.get(red) ?? 0) + 1);
      }
      const total = pixels.length / 4;
      const greys = [...counts]
        .filter(([, count]) => count / total >= 0.02)
        .map(([grey]) => grey);
      return greys.length > 0 ? Math.min(...greys) : -1;
    }, png);
  } finally {
    await blank.close();
  }
}

/**
 * The A8X mark on a page's light ground: the design's near-black #212121, its
 * white artwork inverted at .87 (Build 25's audit). The theme is set before
 * the page loads; the mark is read settled.
 */
async function expectNearBlackMark(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL(
    new RegExp(`${path.replace(/[/.?]/gu, "\\$&")}$`, "u"),
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const mark = page.locator(".brand-mark").first();
  await expect(mark).toBeVisible();
  await expect
    .poll(() =>
      mark.evaluate(
        (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
      ),
    )
    .toBe(true);
  // A stored theme fades each colour in: the mark's and its ground's
  // finite animations are let finish first, so it is read settled.
  await mark.evaluate((element) => {
    const animations: Animation[] = [];
    for (let node: Element | null = element; node; node = node.parentElement)
      animations.push(
        ...node
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !==
              Number.POSITIVE_INFINITY,
          ),
      );
    return Promise.all(
      animations.map((animation) => animation.finished.catch(() => null)),
    );
  });
  const grey = await darkestGrey(page, mark);
  // 255 × (1 − 0.87) = 33 = 0x21; invert(1) draws 0, invert(0.78) 0x38.
  expect(
    Math.abs(grey - 0x21),
    `${path}: drawn in grey ${grey}`,
  ).toBeLessThanOrEqual(4);
}

test("on the light ground the A8X mark is the design's near-black #212121 — its white artwork inverted at .87 — on the site and in the account (Build 25's audit)", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  for (const path of ["/", "/account"]) await expectNearBlackMark(page, path);
});

test("the A8X mark is the same near-black #212121 on Set up your organization's light ground (§12.1 #300; #57's audit)", async ({
  page,
}) => {
  await presentSession(page, "requester");
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await expectNearBlackMark(page, "/onboarding/setup-org");
});

test.describe("signed out, on the light ground", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the A8X mark is the same near-black #212121 on Sign in (§12.1 #300; #57's audit)", async ({
    page,
  }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await expectNearBlackMark(page, "/login");
  });
});
