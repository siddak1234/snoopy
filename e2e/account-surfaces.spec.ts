import { expect, test, type Page } from "@playwright/test";
import {
  automationCard,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  holdRequest,
  observe,
  presentSession,
  providerCard,
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

const organizationProject =
  "/account/projects/33333333-3333-4333-8333-333333333333";
const operationsTeam = "/account/teams/abababab-abab-4bab-8bab-abababababab";
const joinLink = "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111";
const workspaceChanged =
  "The active workspace changed in another tab. Reload this page before continuing.";

// The dashboard's figure beside a term.
function figure(page: Page, term: string) {
  return page
    .locator("dt", { hasText: term })
    .locator("xpath=following-sibling::dd[1]");
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
  // One read failing takes nothing else with it.
  await expect(figure(page, "Automations")).toHaveText("4");
  await fixtureControl("reset");
  await fixtureControl("runs-empty");
  await page.reload();
  await expect(page.getByText("No activity yet.")).toBeVisible();
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

test("4, 20 — the sidebar's Teams link opens Teams; a personal workspace shows neither Teams nor Organization, and says where teams are", async ({
  page,
}) => {
  await page.goto("/account");
  const nav = page.getByRole("complementary", {
    name: "Dashboard navigation",
  });
  await nav.getByRole("link", { name: "Teams" }).click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await expect(
    page.getByRole("link", { name: "Operations", exact: true }),
  ).toBeVisible();
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  await page.goto("/account");
  await expect(nav.getByRole("link", { name: "Teams" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await page.goto("/account/teams");
  await expect(
    page.getByText(
      "Teams belong to an organization workspace. Switch to one to see its teams.",
    ),
  ).toBeVisible();
});

test.describe("on a small screen", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("5 — every account page names itself in the header, and the menu reaches Teams (register F56)", async ({
    page,
  }) => {
    const header = page
      .getByRole("button", { name: "Open menu" })
      .locator("xpath=..");
    for (const [path, title] of [
      ["/account", "Dashboard"],
      ["/account/automations", "Automations"],
      ["/account/connections", "Connections"],
      ["/account/runs", "Activity"],
      ["/account/approvals", "Approvals"],
      ["/account/projects", "Projects"],
      ["/account/teams", "Teams"],
      ["/account/billing", "Billing"],
      ["/account/settings", "Settings"],
      ["/account/support", "Support"],
      ["/account/organization", "Organization"],
      [organizationProject, "Project"],
      ["/account/runs/fixture-run-ok", "Run"],
      [operationsTeam, "Team"],
    ] as const) {
      await page.goto(path);
      await expect(header.getByText(title, { exact: true })).toBeVisible();
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
  await page.goto("/account/automations");
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
    "/account/projects",
    operationsTeam,
  ]) {
    test(`8 — signing in from ${path} returns there`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        `/login?callbackUrl=${encodeURIComponent(path)}`,
      );
    });
  }

  test("9 — the builder's sign-in links return to the automations, and a saved ?id= link is redirected there (307)", async ({
    page,
  }) => {
    await page.goto("/automation-builder");
    const signIn = page.locator(
      'a[href="/login?callbackUrl=%2Faccount%2Fautomations"]',
    );
    await expect(signIn).toHaveCount(2);
    const saved = await page.request.get("/automation-builder?id=legacy-1", {
      maxRedirects: 0,
    });
    expect(saved.status()).toBe(307);
    expect(saved.headers().location).toMatch(/^\/account\/automations(\?|$)/u);
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
    "/account/projects",
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

test("13 — a disconnected account leaves its provider offering Connect", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Disconnect" })).toHaveCount(0);
  await expect(
    providerCard(page, "Fixture OAuth provider").getByRole("button", {
      name: "Connect",
    }),
  ).toBeVisible();
});

test("14 — a replacement answered 'reused' names the account the platform answered with", async ({
  page,
}) => {
  await fixtureControl("replace-answers-reused");
  await page.goto("/account/connections");
  await page.getByRole("button", { name: "Replace account" }).click();
  await page
    .getByRole("dialog", { name: "Replace Fixture OAuth account?" })
    .getByRole("button", { name: "Replace account" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "still connected" }),
  ).toHaveText(
    "Fixture other account is still connected — there was nothing to replace.",
  );
});

test("15 — an unmet connection links to Connections, and Go live waits for it", async ({
  page,
}) => {
  await fixtureControl("draft-needs-connection");
  await page.goto("/account/automations");
  const card = automationCard(page, "Plan-limit automation");
  const connect = card.getByRole("link", { name: "Connect fixture-oauth" });
  await expect(connect).toHaveAttribute("href", "/account/connections");
  await expect(card.getByRole("button", { name: "Go live" })).toBeDisabled();
  await connect.click();
  await expect(page).toHaveURL(/\/account\/connections$/);
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
  await expect(page.getByText("Nothing is waiting on you.")).toBeVisible();
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
  await expect(page.getByText("Nothing is waiting on you.")).toBeVisible();
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

test("19 — a team project created after another tab switched workspace is refused, and nothing is created", async ({
  page,
}) => {
  await page.goto("/account/projects");
  await page.getByRole("button", { name: "Create project" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator("label")
    .filter({ hasText: /^\s*team\s*$/i })
    .click();
  await dialog.getByLabel(/Project name/).fill("Stale tab project");
  await dialog.getByLabel(/Project type/).fill("Invoices");
  await switchInAnotherTab(page, /Fixture Personal/);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(workspaceChanged);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto("/account/projects");
  await expect(page.getByText("Stale tab project")).toHaveCount(0);
});

test("20 — the Teams pages: an unknown team is not found, an organization with none, a plain member, and Back", async ({
  page,
}) => {
  const unknown = await page.goto(
    "/account/teams/99999999-9999-4999-8999-999999999999",
  );
  expect(unknown?.status()).toBe(404);
  await page.goto(operationsTeam);
  await page.getByRole("link", { name: "Back to teams" }).click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await fixtureControl("member-plain-on-team");
  await presentSession(page, "member");
  await page.reload();
  await expect(page.getByText("You are its member.")).toBeVisible();
  await page.goto(operationsTeam);
  await expect(
    page.getByText(
      "Only this team's managers, and the organization's owners and admins, can see who is on it.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add or change role" }),
  ).toHaveCount(0);
  await fixtureControl("org-without-teams");
  await page.goto("/account/teams");
  await expect(page.getByText("You are not on a team yet.")).toBeVisible();
  await presentSession(page, "owner");
  await page.reload();
  await expect(page.getByText("No teams yet.")).toBeVisible();
});

test("21 — a team's member form submitted after another tab switched workspace is refused", async ({
  page,
}) => {
  await page.goto(operationsTeam);
  await page
    .getByLabel("Person")
    .selectOption({ label: "Fixture Admin (admin@example.test)" });
  await switchInAnotherTab(page, /Fixture Personal/);
  await page.getByRole("button", { name: "Add or change role" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );
});

// The change audit of 97021f9's #15 (register § Round 15).
test("a team member's removal after another tab switched workspace is refused, and they stay on the team (register F28)", async ({
  page,
}) => {
  await page.goto(operationsTeam);
  const member = page.locator("main li").filter({ hasText: "Fixture Member" });
  await expect(member).toHaveCount(1);
  await switchInAnotherTab(page, /Fixture Personal/);
  await member.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Fixture Member from Operations?",
  });
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(workspaceChanged);
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto(operationsTeam);
  await expect(member).toHaveCount(1);
});

test('a webhook address opened after another tab switched workspace is refused, never read as "no address yet" (register F28)', async ({
  page,
}) => {
  await page.goto("/account/automations");
  const open = automationCard(page, "Webhook automation").getByRole("button", {
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
  await expect(
    dialog.getByText("This automation has no address yet."),
  ).toHaveCount(0);
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
test("every automation control on a page whose workspace another tab switched away is refused in words, and changes nothing (register F70)", async ({
  page,
}) => {
  await page.goto("/account/automations");
  const project = automationCard(page, "Project automation");
  const manual = automationCard(page, "Manual input automation");
  const webhook = automationCard(page, "Webhook automation");
  const archivable = automationCard(page, "Archivable automation");
  await expect(project.getByRole("button", { name: "Add" })).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);

  await project.getByRole("button", { name: "Add" }).click();
  await expect(project.getByRole("alert")).toHaveText(workspaceChanged);

  await manual.getByRole("button", { name: "Pause" }).click();
  await expect(manual.getByRole("alert")).toHaveText(workspaceChanged);

  await webhook.getByRole("button", { name: "Move to v2" }).click();
  const move = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await move.getByRole("button", { name: "Move to v2" }).click();
  await expect(move.getByRole("alert")).toHaveText(workspaceChanged);
  await move.getByRole("button", { name: "Cancel" }).click();

  await archivable.getByRole("button", { name: "Archive" }).click();
  const archive = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  await archive.getByRole("button", { name: "Archive" }).click();
  await expect(archive.getByRole("alert")).toHaveText(workspaceChanged);
  await archive.getByRole("button", { name: "Cancel" }).click();

  await manual.getByRole("button", { name: "Run", exact: true }).click();
  const run = page.getByRole("dialog", { name: "Run Manual input automation" });
  // A file is neither opened in nor completed against the other workspace.
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
  await expect(page).toHaveURL(/\/account\/automations$/);
  await run.getByRole("button", { name: "Cancel" }).click();

  // Back on the workspace the page showed, nothing moved.
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(
    project
      .getByRole("combobox", { name: "Where to add Project automation" })
      .locator("option"),
  ).toHaveCount(2);
  await expect(manual.getByText(/^live$/i)).toBeVisible();
  await expect(webhook).toContainText("This runs v1; v2 is available.");
  await expect(
    archivable.getByRole("button", { name: "Archive" }),
  ).toBeVisible();
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
  await switchInAnotherTab(page, /Fixture Organization/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
});

test("a connection started, replaced or removed on a page whose workspace another tab switched away is refused, and nothing is connected or removed (register F70)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const oauth = providerCard(page, "Fixture OAuth provider");
  const key = providerCard(page, "Fixture key provider");
  // The one live connection, and the controls on it.
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  await expect(disconnect).toBeVisible();
  await switchInAnotherTab(page, /Fixture Personal/);

  await oauth.getByRole("button", { name: "Reconnect" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );

  await disconnect.click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    workspaceChanged,
  );

  await key.getByRole("button", { name: "Connect" }).click();
  const connect = page.getByRole("dialog", {
    name: "Connect Fixture key provider",
  });
  await connect.getByLabel("API key").fill("fixture-value");
  await connect.getByRole("button", { name: "Verify and connect" }).click();
  await expect(connect.getByRole("alert")).toHaveText(workspaceChanged);
  await connect.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Replace account" }).click();
  const replace = page.getByRole("dialog");
  await replace.getByRole("button", { name: "Replace account" }).click();
  await expect(replace.getByRole("alert")).toHaveText(workspaceChanged);

  await switchInAnotherTab(page, /Fixture Organization/);
  await page.goto("/account/connections");
  await expect(disconnect).toBeVisible();
  await expect(page.getByText("Fixture account")).toHaveCount(0);
  await expect(key.getByRole("button", { name: "Connect" })).toBeVisible();
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
    "/account/automations",
    "/account/projects",
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

test("27 — a grant to a team the viewer is not on reads 'A team you are not on', and a project's owner who is a plain member with no team is told which teams they can offer", async ({
  page,
}) => {
  await page.goto("/account/teams");
  await page.getByLabel("Team name").fill("Finance");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(
    page.getByRole("link", { name: "Finance", exact: true }),
  ).toBeVisible();
  await page.goto(organizationProject);
  await page
    .getByLabel("Team", { exact: true })
    .selectOption({ label: "Finance" });
  await page.getByLabel("Role on this project").selectOption("member");
  await page.getByRole("button", { name: "Give access" }).click();
  await expect(
    page.locator("main li").filter({ hasText: "Finance" }),
  ).toBeVisible();
  await presentSession(page, "member");
  await page.reload();
  await expect(
    page.locator("main li").filter({ hasText: "A team you are not on" }),
  ).toBeVisible();
  await fixtureControl("reset");
  await fixtureControl("member-owns-project");
  await fixtureControl("org-without-teams");
  await page.reload();
  await expect(
    page.getByText(
      "You can give access to a team you can see — the teams you are on.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Give access" })).toHaveCount(
    0,
  );
});
