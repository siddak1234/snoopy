import {
  expect,
  test,
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
  observe,
  presentSession,
  settledAnimations,
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
  await nav.getByRole("link", { name: "Teams" }).click();
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
  await expect(nav.getByRole("link", { name: "Teams" })).toHaveCount(1);
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
      ["/account/teams", "Teams"],
      ["/account/billing", "Billing"],
      ["/account/settings", "Settings"],
      ["/account/support", "Support"],
      ["/account/organization", "Organization"],
      [organizationProject, "Team"],
      ["/account/runs/fixture-run-ok", "Run"],
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
      .getByRole("link", { name: "Teams" })
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
    page.getByRole("button", { name: "Delete team general" }),
    tokens,
    "Delete team, on its page",
  );
  await page.goto("/account/teams");
  await expectErrorText(
    page.getByRole("button", { name: "Delete team general" }),
    tokens,
    "Delete team, in Teams",
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

test("11 — a member's Leave team, the Leave on their own row, and the Leave team that confirms it wear the error tokens (the owner's build 12, #5)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(organizationProject);
  const tokens = await resolvedTokens(page);
  const leave = page
    .locator("main")
    .getByRole("button", { name: "Leave team" });
  const own = page
    .locator("main li")
    .filter({ hasText: "(you)" })
    .getByRole("button", { name: "Leave", exact: true });
  await expectErrorText(leave, tokens, "Leave team");
  await expectErrorText(own, tokens, "Leave, on their own row");
  // Hovered, still red, on the error tint — never the neutral hover that
  // greyed them, a dark system theme's included (this suite's scheme).
  for (const [control, name] of [
    [leave, "Leave team, hovered"],
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
    dialog.getByRole("button", { name: "Leave team" }),
    tokens,
    "Leave team, confirming",
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

  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await expectNotRed(
    page.getByRole("button", { name: "Reject" }),
    tokens,
    "Reject, an approval",
  );

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
  // builds them (`apps/runs/src/notifications.ts`); both answered 404.
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
  await expect(
    page.locator("main").getByRole("heading", { name: "Nothing needs review" }),
  ).toBeVisible();
});

test("17 — Reject is recorded as rejected, and nothing waits", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(
    page.locator("main").getByRole("heading", { name: "Nothing needs review" }),
  ).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  expect(await approvalStatuses()).toEqual(["rejected"]);
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
  await page.getByRole("link", { name: "Back to teams" }).click();
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

test("a rejection on a page whose workspace another tab switched away is refused, and still waits (register F70)", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account/approvals");
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);
  await page.getByRole("button", { name: "Reject" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );
  expect(await approvalStatuses()).toEqual(["pending"]);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Reject" })).toBeVisible();
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
  ]) {
    await fixtureControl("reset");
    await page.goto(path);
    const { workspaceListReads } = await fixtureRead<{
      workspaceListReads: number;
    }>("counts");
    expect(workspaceListReads, path).toBe(1);
  }
});
