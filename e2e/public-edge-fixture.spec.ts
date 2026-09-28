import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";

const requesterUserId = "66666666-6666-4666-8666-666666666666";
const organizationWorkspaceId = "11111111-1111-4111-8111-111111111111";
const personalWorkspaceId = "88888888-8888-4888-8888-888888888888";
const busy = "The platform is busy right now. Try again in 30 seconds.";

// Requests of one shape, observed as they leave the page.
function observe(page: Page, matches: (request: Request) => boolean): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (matches(request)) seen.push(request.url());
  });
  return seen;
}
const isLogout = (request: Request) =>
  request.method() === "POST" && request.url().includes("/v1/auth/logout");

// WCAG 2.2 AA on whatever the page shows now — an open dialog included. On a
// settled document: a server action's re-render replaces the head, and a scan
// that lands in that instant finds no <title> that is there before and after.
// A title that never arrives still fails, here, by name.
async function expectNoAxeViolations(page: Page) {
  await expect(page).toHaveTitle(/\S/u);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

// An automation's card on the automations page, found by its heading.
function automationCard(page: Page, name: string) {
  return page.getByRole("heading", { name }).locator("xpath=../../..");
}

// A provider's card under "Available connections", found by its name.
function providerCard(page: Page, name: string) {
  return page.getByText(name, { exact: true }).locator("xpath=../..");
}

// The fixture's own controls, never the published API.
async function fixtureControl(name: string) {
  const answer = await fetch(`https://127.0.0.1:3443/__fixture/${name}`, {
    method: "POST",
  });
  expect(answer.status).toBe(204);
}

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

// Every test starts from the fixture's first state (register F30, F48), so none
// depends on the order the suite runs in and any one can run on its own.
test.beforeEach(async () => {
  await fixtureControl("reset");
});

test("the pasted-key 409 retry preserves the original connection intent", async ({
  page,
}) => {
  const serverActionRequests = observe(
    page,
    (request) => request.method() === "POST",
  );
  await page.goto("/account/connections");
  await providerCard(page, "Fixture key provider")
    .getByRole("button", { name: "Connect" })
    .click();
  await expect(page.locator('input[name="idempotencyKey"]')).not.toHaveValue(
    "",
  );
  await page.getByLabel("API key").fill("fixture-value");
  await page.getByRole("button", { name: "Verify and connect" }).click();
  await expect(
    page.getByText("This request may still be in progress"),
  ).toBeVisible();
  // The refusal is said once, in the dialog — not again by the page behind it
  // (register F52).
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Connection verification is still in progress" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect.poll(() => serverActionRequests.length).toBe(2);
  await expect(page.getByText("Fixture account")).toBeVisible();
});

test("Reconnect on a connection that already holds what it needs asks no consent, and says so (backend §12.1 #172)", async ({
  page,
}) => {
  const consent = observe(page, (request) =>
    request.url().startsWith("https://oauth.invalid/"),
  );
  await page.goto("/account/connections");
  await providerCard(page, "Fixture OAuth provider")
    .getByRole("button", { name: "Reconnect" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "already connected" }),
  ).toHaveText(
    "Fixture OAuth provider is already connected as Fixture OAuth account, with everything it needs — there is nothing to authorize.",
  );
  await expect(page).toHaveURL(/\/account\/connections$/);
  expect(consent).toEqual([]);
});

test("a connection that needs reauthorization is repaired by Reconnect, not reused (backend §12.1 #175)", async ({
  page,
}) => {
  await page.route("https://oauth.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>consent</h1>",
    }),
  );
  await fixtureControl("oauth-connection-broken");
  await page.goto("/account/connections");
  await expect(
    page.getByText("This connection needs attention before it can be used."),
  ).toBeVisible();
  await providerCard(page, "Fixture OAuth provider")
    .getByRole("button", { name: "Reconnect" })
    .click();
  await page.waitForURL(/^https:\/\/oauth\.invalid\/authorize/);
});

test("Replace account is confirmed first, names the connection it replaces, and goes to the provider's consent (backend ADR-0026)", async ({
  page,
}) => {
  await page.route("https://oauth.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>consent</h1>",
    }),
  );
  await page.goto("/account/connections");
  const replace = page.getByRole("button", { name: "Replace account" });
  await replace.click();
  const dialog = page.getByRole("dialog", {
    name: "Replace Fixture OAuth account?",
  });
  await expect(dialog).toContainText(
    "Fixture OAuth account stays connected until that sign-in completes",
  );
  await expectNoAxeViolations(page);
  // Keeping the account changes nothing and hands focus back.
  await dialog.getByRole("button", { name: "Keep this account" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(replace).toBeFocused();
  await replace.click();
  // The fixture asks for consent only when the id sent is the live one's.
  await page
    .getByRole("dialog", { name: "Replace Fixture OAuth account?" })
    .getByRole("button", { name: "Replace account" })
    .click();
  await page.waitForURL(/^https:\/\/oauth\.invalid\/authorize/);
});

test("a replacement named after the connection changed is refused as stale, and nothing is replaced", async ({
  page,
}) => {
  await page.goto("/account/connections");
  // Another admin replaces it after this page read it.
  await fixtureControl("oauth-connection-replaced");
  await page.getByRole("button", { name: "Replace account" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Replace Fixture OAuth account?",
  });
  await dialog.getByRole("button", { name: "Replace account" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This connection changed since the page loaded, so nothing was replaced. Reload the page to see it, then choose again.",
  );
  // Said once, in the dialog (register F52).
  await expect(
    page.getByRole("alert").filter({ hasText: "This connection changed" }),
  ).toHaveCount(1);
  await expect(page).toHaveURL(/\/account\/connections$/);
});

test("subscription refusals render only the two documented entitlement states", async ({
  page,
}) => {
  await page.goto("/account/automations");
  const planLimitCard = page
    .getByRole("heading", { name: "Plan-limit automation" })
    .locator("xpath=../../..");
  await planLimitCard.getByRole("button", { name: "Add" }).click();
  await expect(
    page.getByText("This workspace has reached its current plan limit."),
  ).toBeVisible();
  const entitlementsCard = page
    .getByRole("heading", { name: "Entitlements automation" })
    .locator("xpath=../../..");
  await entitlementsCard.getByRole("button", { name: "Add" }).click();
  await expect(
    page.getByText(
      "Subscriptions are unavailable while billing entitlements are not configured.",
    ),
  ).toBeVisible();
});

test("a live automation whose pinned version declares run input is started from its form, and the run's page follows", async ({
  page,
}) => {
  // Backend §12.1 #162, ADR-0030. The fixture creates the run only when the
  // input is exactly the declaration, typed as it says — so landing on the run's
  // page proves the form sent a number for money and nothing undeclared.
  await page.goto("/account/automations");
  const card = automationCard(page, "Manual input automation");
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await card.getByRole("button", { name: "Run", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Run Manual input automation",
  });
  await expect(dialog).toBeVisible();
  // The declared fields, in order; the file field is not rendered, because no
  // published operation uploads one from a form.
  await expect(dialog.getByLabel("Vendor")).toBeVisible();
  await expect(dialog.getByLabel("Amount")).toHaveAttribute("type", "number");
  await expect(dialog.getByLabel("Invoice reference")).toBeVisible();
  await expect(dialog.getByText("Invoice file")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await dialog.getByLabel("Vendor").fill("Acme Supplies");
  await dialog.getByLabel("Amount").fill("120.50");
  await dialog.getByLabel("Invoice reference").fill("INV-1001");
  await dialog.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
  await expect(page.getByText("Manual", { exact: true })).toBeVisible();
});

// Switches the fixture session this browser presents, mid-page — the platform
// starting to refuse a person who is already looking at a form.
async function presentSession(
  page: Page,
  value: "owner" | "throttled" | "member" | "requester" | "admin",
) {
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value,
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
}

test("a refused start keeps what was typed and the same idempotency key, so resubmitting cannot start a second run", async ({
  page,
}) => {
  // React resets an action form's fields when the action settles; these forms
  // submit from onSubmit so a refusal keeps them (the change audit's P12b).
  await page.goto("/account/automations");
  await automationCard(page, "Manual input automation")
    .getByRole("button", { name: "Run", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Run Manual input automation",
  });
  await dialog.getByLabel("Vendor").fill("Acme Supplies");
  await dialog.getByLabel("Amount").fill("10");
  await dialog.getByLabel("Invoice reference").fill("R-1");
  const key = dialog.locator('input[name="idempotencyKey"]');
  const sent = await key.inputValue();
  expect(sent).toMatch(/^run-/);
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Start run" }).click();
  // The wait the platform stated, in words — not its generic title.
  await expect(dialog.getByRole("alert")).toHaveText(busy);
  await expect(dialog.getByLabel("Vendor")).toHaveValue("Acme Supplies");
  await expect(dialog.getByLabel("Amount")).toHaveValue("10");
  await expect(dialog.getByLabel("Invoice reference")).toHaveValue("R-1");
  await expect(key).toHaveValue(sent);
  // The same values, sent again with the same key, start the run.
  await presentSession(page, "owner");
  await dialog.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
});

test("a refused set-up save stays in its dialog with the platform's answer and what was typed", async ({
  page,
}) => {
  // The change audit's P11: a failed save used to revalidate the page, and under
  // a refusal that re-render replaced the dialog with the "busy" panel.
  await page.goto("/account/automations");
  await automationCard(page, "Manual input automation")
    .getByRole("button", { name: "Set up" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Automation setup" });
  await expect(dialog.getByLabel("Spending limit")).toHaveValue("500");
  await expectNoAxeViolations(page);
  // A notifications switch says what it switches, in words (register F22).
  await expect(dialog.getByLabel("Failure notices")).toBeVisible();
  await expect(dialog).toContainText(
    "Controls the notification sent when a run fails.",
  );
  await dialog.getByLabel("Spending limit").fill("99");
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Save setup" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(busy);
  await expect(dialog.getByLabel("Spending limit")).toHaveValue("99");
  await presentSession(page, "owner");
  await dialog.getByRole("button", { name: "Save setup" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a live automation that declares no run input offers no Run, and Archive is confirmed, one-way, and gives Add back", async ({
  page,
}) => {
  // Backend §12.1 #169 and #92: archiving is how a workspace frees a plan slot.
  await page.goto("/account/automations");
  const card = automationCard(page, "Archivable automation");
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  const archive = card.getByRole("button", { name: "Archive" });
  await archive.click();
  const dialog = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  await expect(dialog).toContainText("gives its plan slot back");
  await expect(dialog).toContainText("This cannot be undone");
  await expectNoAxeViolations(page);
  // Cancel changes nothing and hands focus back to the control that opened it.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(archive).toBeFocused();
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await archive.click();
  await page
    .getByRole("dialog", { name: "Archive Archivable automation?" })
    .getByRole("button", { name: "Archive" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Add" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Archive" })).toHaveCount(0);
});

test("Pause and Go live move a live subscription and back, and the card follows (register F38)", async ({
  page,
}) => {
  await page.goto("/account/automations");
  const card = automationCard(page, "Manual input automation");
  await expect(card.getByText(/^live$/i)).toBeVisible();
  await card.getByRole("button", { name: "Pause" }).click();
  await expect(card.getByText(/^paused$/i)).toBeVisible();
  // A paused automation starts nothing, so it offers no Run.
  await expect(
    card.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await card.getByRole("button", { name: "Go live" }).click();
  await expect(card.getByText(/^live$/i)).toBeVisible();
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("a card lists each subscription under its scope, and Add offers only the scopes it is not in yet (register F21)", async ({
  page,
}) => {
  await page.goto("/account/automations");
  // Already added to the project, as a draft: that row says where, and the only
  // place left to add it is the whole workspace — so there is nothing to choose.
  const planLimit = automationCard(page, "Plan-limit automation");
  await expect(
    planLimit.locator("p", { hasText: "Project: Fixture Project" }),
  ).toBeVisible();
  await expect(planLimit.getByRole("combobox")).toHaveCount(0);
  await expect(planLimit.getByRole("button", { name: "Add" })).toBeVisible();

  // Added nowhere: both scopes are offered, the workspace first.
  const card = automationCard(page, "Project automation");
  const where = card.getByRole("combobox", {
    name: "Where to add Project automation",
  });
  await expect(where.locator("option")).toHaveText([
    "Whole workspace",
    "Project: Fixture Project",
  ]);
  await where.selectOption({ label: "Project: Fixture Project" });
  await card.getByRole("button", { name: "Add" }).click();
  await expect(
    card.locator("p", { hasText: "Project: Fixture Project" }),
  ).toBeVisible();
  // What was chosen is gone from the offer; Add now means the workspace — the
  // fixture answers 409 if the project is sent again.
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.locator("p", { hasText: "Whole workspace" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);
});

test("the account area does not prefetch — a page view costs its own requests and no others", async ({
  page,
}) => {
  // Backend §12.1 #160: every visible link prefetched twice, and one page view
  // cost 23 Edge requests. Watched from BEFORE the navigation, because a link
  // prefetches as it enters the viewport, right after hydration. A document load
  // carries no RSC header, so with nothing navigating every RSC request is a
  // prefetch — hovering included.
  const rsc = observe(page, (request) => request.headers()["rsc"] === "1");
  await page.goto("/account/automations");
  await page.waitForLoadState("networkidle");
  for (const name of ["Connections", "Activity", "Billing", "Settings"]) {
    await page.getByRole("link", { name, exact: true }).first().hover();
  }
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  expect(rsc).toEqual([]);
});

for (const [who, heading] of [
  ["throttled", "The platform is busy right now"],
  ["failing", "The platform could not answer just now"],
] as const) {
  test(`a signed-in person the platform ${who === "throttled" ? "refuses (429)" : "cannot answer (503)"} stays signed in — the account area says so, not /login`, async ({
    page,
  }) => {
    // Backend §12.1 #160: getAppSession() read every failure as "no session",
    // so a refusal redirected to /login and read as a sign-out.
    await page.context().addCookies([
      {
        name: "e2e-public-edge-session",
        value: who,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    const logouts = observe(page, isLogout);
    await page.goto("/account/automations");
    await expect(page).toHaveURL(/\/account\/automations$/);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("You have not been signed out")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expectNoAxeViolations(page);
    expect(logouts).toHaveLength(0);
  });
}

test("a run's outcome is read on its own page — failure reason and result summary", async ({
  page,
}) => {
  // Reached from Activity rather than from a dialog: the run pages keep their
  // fixture path after the Run-now scaffolding went. RunRow's accessible name
  // is `Run of ${name}, ${run.status}` (app/account/runs/page.tsx).
  await page.goto("/account/runs");
  await page
    .getByRole("link", { name: "Run of Manual input automation, failed" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-failed$/);
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "input must carry vendor, amount, and reference" }),
  ).toBeVisible();
  // Every run now starts from its trigger; the page says so rather than
  // defaulting to the manual start the website no longer offers.
  await expect(page.getByText("Triggered", { exact: true })).toBeVisible();

  await page.goto("/account/runs");
  await page
    .getByRole("link", { name: "Run of Manual input automation, succeeded" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-ok$/);
  await expect(
    page.getByText("Recorded the invoice and emailed the summary."),
  ).toBeVisible();
  // A finished run offers nothing to cancel.
  await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
});

test("a running run is cancelled from its page, confirmed first, and then reads as cancelled (cancelRun)", async ({
  page,
}) => {
  await page.goto("/account/runs");
  await page
    .getByRole("link", { name: "Run of Manual input automation, running" })
    .click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-running$/);
  const open = page.getByRole("button", { name: "Cancel run" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Cancel this run?" });
  await expect(dialog).toContainText("is not resumed");
  await expectNoAxeViolations(page);
  // Keeping it running changes nothing.
  await dialog.getByRole("button", { name: "Keep it running" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByText(/^running$/i)).toBeVisible();
  await open.click();
  await page
    .getByRole("dialog", { name: "Cancel this run?" })
    .getByRole("button", { name: "Cancel run" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByText(/^cancelled$/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel run" })).toHaveCount(0);
});

test("the dashboard shows the workspace's own numbers and names its recent runs (register F54)", async ({
  page,
}) => {
  await page.goto("/account");
  const figure = (term: string) =>
    page
      .locator("dt", { hasText: term })
      .locator("xpath=following-sibling::dd[1]");
  // Three subscriptions that are not archived; the platform's tally of this
  // month's runs; no connected integration yet.
  await expect(figure("Automations")).toHaveText("3");
  await expect(figure("Runs this month")).toHaveText(
    "3 · 1 succeeded · 1 failed",
  );
  await expect(figure("Integrations")).toHaveText("1");
  await expect(
    page.getByRole("link", { name: "Run of Manual input automation, running" }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("fixture-manual-input");
  // Its actions lead to the pages that do what they say (register F54).
  await expect(
    page.getByRole("link", { name: "Browse automations" }).first(),
  ).toHaveAttribute("href", "/account/automations");
  await expect(
    page.getByRole("link", { name: "Connect integration" }).first(),
  ).toHaveAttribute("href", "/account/connections");
});

test("domain discovery creates an approval request without an invite flow", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value: "requester",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto(
    "/onboarding/join-org?w=11111111-1111-4111-8111-111111111111",
  );
  await page.getByRole("button", { name: "Join Fixture Organization" }).click();
  await expect(
    page.getByText("Your request was sent for approval."),
  ).toBeVisible();
  await expect(
    page.locator('a[href*="invite"], input[name*="invite" i]'),
  ).toHaveCount(0);
});

test("organization request controls use the public join-request operation without invite links", async ({
  page,
}) => {
  await page.goto("/account/organization");
  await expect(page.getByText(requesterUserId)).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("No pending requests.")).toBeVisible();
  await expect(
    page.locator('a[href*="invite"], input[name*="invite" i]'),
  ).toHaveCount(0);
});

test("workspace export distinguishes complete and partial public responses", async ({
  page,
}) => {
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Prepare export" }).click();
  await expect(page.getByText("This export is complete.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Prepare export" }).click();
  await expect(page.getByText("This is a partial export.")).toBeVisible();
});

test("the workspace switcher drives the public active-workspace operation", async ({
  page,
}) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await expect(trigger).toContainText("Fixture Organization");
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  // And back: the switcher moves both ways.
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Organization/ }).click();
  await expect(trigger).toContainText("Fixture Organization");
});

const operationsTeam = "/account/teams/abababab-abab-4bab-8bab-abababababab";

test("an owner sees every team and creates one; a team lists who is on it, and one control adds someone or changes a role (backend §12.1 #173)", async ({
  page,
}) => {
  await page.goto("/account/teams");
  await expect(
    page.getByRole("link", { name: "Operations", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Team name").fill("Finance");
  await page.getByLabel("Description").fill("Pays the invoices.");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(
    page.getByRole("link", { name: "Finance", exact: true }),
  ).toBeVisible();
  // The form clears once the platform has the team.
  await expect(page.getByLabel("Team name")).toHaveValue("");

  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(page).toHaveURL(operationsTeam);
  const members = page.locator("main li");
  await expect(members).toHaveCount(1);
  await expect(members.first()).toContainText("Fixture Member");
  await expect(members.first()).toContainText(/manager/i);
  await expectNoAxeViolations(page);
  // Adding someone …
  await page
    .getByLabel("Person")
    .selectOption({ label: "Fixture Admin (admin@example.test)" });
  await page.getByRole("button", { name: "Add or change role" }).click();
  await expect(members).toHaveCount(2);
  // … and changing a role are the same operation.
  await page
    .getByLabel("Person")
    .selectOption({ label: "Fixture Member (member@example.test)" });
  await page.getByLabel("Team role").selectOption("member");
  await page.getByRole("button", { name: "Add or change role" }).click();
  await expect(
    members.filter({ hasText: "Fixture Member" }).locator("span"),
  ).toHaveText(/^member$/i);
  // No removal is offered: no operation publishes one (backend §12.1 #174).
  await expect(page.getByRole("button", { name: /remove/i })).toHaveCount(0);
  await expect(
    page.getByText("Removing someone from a team is not available yet."),
  ).toBeVisible();
});

test("a team's manager who is a plain member manages their team — and sees neither the others nor the organization page (backend ADR-0010)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto("/account/teams");
  const nav = page.getByRole("complementary", { name: "Dashboard navigation" });
  await expect(nav.getByRole("link", { name: "Teams" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Organization" })).toHaveCount(0);
  await expect(page.getByText("You are its manager.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create team" })).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Operations", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add or change role" }),
  ).toBeVisible();
  await page.goto("/account/organization");
  await expect(page).toHaveURL(/\/account$/);
});

test("an admin reaches the organization page, where every operation admits them (register F55)", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await page.goto("/account/organization");
  await expect(page).toHaveURL(/\/account\/organization$/);
  await expect(
    page.getByRole("heading", { name: "Organization", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Organization" }),
  ).toBeVisible();
});

test("a project's owner gives a team access, and the project lists the teams granted to it (backend §12.1 #173)", async ({
  page,
}) => {
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await expect(
    page.getByText("No team has access to this project."),
  ).toBeVisible();
  await page
    .getByLabel("Team", { exact: true })
    .selectOption({ label: "Operations" });
  await page.getByLabel("Role on this project").selectOption("admin");
  await page.getByRole("button", { name: "Give access" }).click();
  const granted = page.locator("main li").filter({ hasText: "Operations" });
  await expect(granted).toContainText(/admin/i);
  await expect(
    page.getByText("No team has access to this project."),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("signing out flips the marketing nav without a manual reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Account", exact: true }),
  ).toHaveCount(0);
});

test("a page whose own read fails says so inside the account shell, and Try again asks again", async ({
  page,
}) => {
  // app/account/error.tsx (backend §12.1 #160): the session and the shell read
  // fine; only the billing page's read fails, so the navigation stays.
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value: "page-failing",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  const billingReads = observe(page, (request) =>
    request.url().includes("/account/billing"),
  );
  await page.goto("/account/billing");
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Billing", exact: true }).first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account\/billing$/);
  await expectNoAxeViolations(page);
  const before = billingReads.length;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect.poll(() => billingReads.length).toBeGreaterThan(before);
  await expect(
    page.getByRole("heading", {
      name: "The platform could not answer just now",
    }),
  ).toBeVisible();
});

test("the workspace switcher keeps keyboard focus — arrows move among workspaces, Escape and a selection return to the trigger", async ({
  page,
}) => {
  // Backend §12.1 #170: Escape left focus on <body> and the arrows did nothing.
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  const option = (name: string) =>
    page
      .getByRole("dialog", { name: "Switch workspace" })
      .getByRole("button", { name: new RegExp(name) });
  await trigger.focus();
  await page.keyboard.press("Enter");
  // Opening lands on the workspace in use.
  await expect(option("Fixture Organization")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option("Fixture Personal")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(option("Fixture Organization")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(option("Fixture Personal")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(option("Fixture Organization")).toBeFocused();
  await page.keyboard.press("End");
  await expect(option("Fixture Personal")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  // A selection made from the keyboard also hands focus back.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(trigger).toContainText("Fixture Personal");
  await expect(trigger).toBeFocused();
});

test("keyboard reaches dashboard navigation and preserves a visible focus target", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.getByRole("button", { name: "Connect", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect", exact: true }),
  ).toBeFocused();
});

// A plan's card in the billing page's plan list.
function planCard(page: Page, name: string) {
  return page
    .locator("main li")
    .filter({ has: page.getByText(name, { exact: true }) });
}

test("a billing hand-off is refused when another tab changed the active workspace", async ({
  page,
  context,
}) => {
  await page.goto("/account/billing");
  await expect(
    page.locator("main").getByText("Free", { exact: true }),
  ).toBeVisible();
  const other = await context.newPage();
  try {
    await other.goto("/account");
    const trigger = other.getByRole("button", { name: "Switch workspace" });
    await trigger.click();
    await other.getByRole("button", { name: /Fixture Personal/ }).click();
    await expect(trigger).toContainText("Fixture Personal");
    // This page still shows the organization, which is no longer active:
    // nothing is bought for a workspace the person was not looking at.
    await planCard(page, "Team")
      .getByRole("button", { name: "Choose plan" })
      .click();
    await expect(
      page.getByText(
        "The active workspace changed in another tab. Reload this page before continuing.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/account\/billing$/);
  } finally {
    await other.close();
  }
});

test("the billing page reads the plan through the published operations and hands off to the hosted pages", async ({
  page,
}) => {
  // The hosted pages are the provider's; here they are stubbed at the browser
  // so the navigation itself is what is observed.
  await page.route("https://billing.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>hosted</h1>",
    }),
  );
  await page.goto("/account/billing");
  const main = page.locator("main");
  await expect(main.getByText("Free", { exact: true })).toBeVisible();
  // No billing account yet: the portal answers 409 and the page says what to do.
  await page.getByRole("button", { name: "Manage billing" }).click();
  await expect(
    page.getByText(
      "This workspace has no billing account yet. Choose a plan below to start one.",
    ),
  ).toBeVisible();
  await planCard(page, "Team")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  // Back on the page, the plan the checkout bought is the current one — and
  // with a live subscription no other plan offers a second checkout: changing
  // plans is the portal's (ADR-0025).
  await page.goto("/account/billing");
  await expect(
    planCard(page, "Team").getByRole("button", { name: "Current plan" }),
  ).toBeDisabled();
  await expect(main.getByText(/^active$/i)).toBeVisible();
  await expect(planCard(page, "Pro")).toBeVisible();
  await expect(planCard(page, "Pro").getByRole("button")).toHaveCount(0);
  await expect(
    page.getByText(
      "To change or cancel your plan, or to finish a payment, use Manage billing.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage billing" }).click();
  await page.waitForURL(/billing\.invalid\/portal\//);
});

test("a plan says what it costs when the provider states it, and labels every capability it shows", async ({
  page,
}) => {
  // Backend §12.1 #163, ADR-0031: the price is the provider's figure in minor
  // units; a plan without one says so rather than guessing, and a capability
  // the website has no words for is not printed as a raw key.
  await page.goto("/account/billing");
  const team = planCard(page, "Team");
  await expect(team).toContainText("$5.00 per month");
  await expect(team).toContainText("Automations");
  await expect(team).toContainText("Requests per minute");
  const pro = planCard(page, "Pro");
  await expect(pro).toContainText("Price shown at checkout");
  await expect(page.locator("main")).not.toContainText("fixture.unlabelled");
  await expect(page.locator("main")).not.toContainText("workspace.rate");
  await expectNoAxeViolations(page);
});

test("billing renders no identifier that is not this platform's own", async ({
  page,
}) => {
  await page.goto("/account/billing");
  // `innerText` of the rendered main, not the document: the RSC payload in
  // script tags carries every prop and is not what a person sees.
  const text = await page.locator("main").innerText();
  expect(text).not.toMatch(/cus_|sub_|price_|provider/i);
});

test("a member sees billing gated — not refused and not unavailable", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value: "member",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/account/billing");
  await expect(
    page.getByText(
      "Billing is managed by the owners and admins of this workspace.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Choose plan|Manage billing/ }),
  ).toHaveCount(0);
  // A page that read billing for a member would show the server's 403 as lost
  // access ("no longer have access"), so its absence proves the page's own
  // gate held before any billing read.
  await expect(
    page.getByText(
      /not allowed|unavailable|requires an admin|no longer have access/i,
    ),
  ).toHaveCount(0);
});

test("a member is offered no control the platform would refuse them — connections and export (register F8)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto("/account/connections");
  await expect(
    page.getByText(
      "Only an owner or admin of this workspace can connect or disconnect an account.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /^(Connect|Reconnect|Disconnect|Replace account)$/,
    }),
  ).toHaveCount(0);
  await page.goto("/account/settings");
  await expect(
    page.getByText("Exporting a workspace is for its owners and admins"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Prepare export" }),
  ).toHaveCount(0);
});

test("each workspace holds its own plan — buying for the personal workspace leaves the organization's alone (register F31)", async ({
  page,
}) => {
  await page.route("https://billing.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>hosted</h1>",
    }),
  );
  const activate = async (workspaceId: string) => {
    const answer = await page
      .context()
      .request.patch("/api/platform/v1/session/active-workspace", {
        data: { workspaceId },
        headers: { origin: "http://127.0.0.1:3001" },
      });
    expect(answer.status()).toBe(200);
  };
  await activate(personalWorkspaceId);
  await page.goto("/account/billing");
  await planCard(page, "Team")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  await page.goto("/account/billing");
  await expect(
    planCard(page, "Team").getByRole("button", { name: "Current plan" }),
  ).toBeDisabled();
  await activate(organizationWorkspaceId);
  await page.goto("/account/billing");
  await expect(
    page.locator("main").getByText("Free", { exact: true }),
  ).toBeVisible();
  await expect(
    planCard(page, "Team").getByRole("button", { name: "Choose plan" }),
  ).toBeVisible();
});

test("the account-deletion confirmation says what ADR-0028 removes, and a refusal keeps the account", async ({
  page,
}) => {
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  // Read from the rendered component (Gate 20 line 3).
  await expect(dialog).toContainText(
    "every organization you are the only owner of",
  );
  await expect(dialog).toContainText("who lose them and everything in them");
  await expect(dialog).toContainText(
    "Organizations that have another owner are kept",
  );
  await expect(dialog).toContainText(
    "your account stays and you can try again",
  );
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  // 409: a partial deletion. The account is still here, the session too.
  await expect(dialog.getByRole("alert")).toContainText(
    "your account is still here",
  );
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page).toHaveURL(/\/account\/settings$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/account$/);
});

test("a clean account deletion signs out and leaves", async ({ page }) => {
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value: "requester",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Yes, delete my account" })
    .click();
  // The page built to say so (register F2).
  await expect(page).toHaveURL(/\/account-deleted$/);
  await expect(
    page.getByRole("heading", { name: "Account deleted" }),
  ).toBeVisible();
});

test("the deletion itself signs the browser out — the sign-out after it is only a courtesy (register F34)", async ({
  page,
}) => {
  // The Edge clears the session cookies with its 200. Losing the courtesy
  // sign-out must neither keep the person signed in nor turn a finished
  // deletion into "try again".
  await presentSession(page, "requester");
  await page.route(/\/api\/platform\/v1\/auth\/logout$/, (route) =>
    route.abort("connectionreset"),
  );
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Yes, delete my account" })
    .click();
  await expect(page).toHaveURL(/\/account-deleted$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Faccount$/);
});

// For a cookie caller every 502 on DELETE /v1/account means the Access hop
// failed — the contract's "deleted, but not revoked" 502 is bearer-only
// (backend F39) — and a gateway 504 or a connection lost mid-request is the
// same case: the request may have run and its answer been lost. All of them
// keep the account and say the outcome is unknown, rather than relaying a
// title. The fixture answers none of them; the route is answered here.
const UNKNOWN_OUTCOME = "it is not known whether your account was removed";
const lostAnswers: ReadonlyArray<
  readonly [
    string,
    { status: number; contentType: string; body: string } | "connectionreset",
  ]
> = [
  [
    "the Edge's own 502 problem body",
    {
      status: 502,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:autom8x:problem:dependency-failure",
        title: "Dependency Failure",
        status: 502,
        detail: "Access service is unreachable",
        code: "DEPENDENCY_FAILURE",
      }),
    },
  ],
  [
    "a bodiless gateway 502",
    {
      status: 502,
      contentType: "text/html",
      body: "<!doctype html><title>502</title><p>Bad Gateway</p>",
    },
  ],
  [
    "a gateway 504",
    {
      status: 504,
      contentType: "text/html",
      body: "<!doctype html><title>504</title><p>Gateway Timeout</p>",
    },
  ],
  ["a connection lost mid-request", "connectionreset"],
];
for (const [answer, fulfil] of lostAnswers) {
  test(`${answer} keeps the account — the outcome is said to be unknown`, async ({
    page,
  }) => {
    const logouts = observe(page, isLogout);
    await page.route(/\/api\/platform\/v1\/account$/, (route) =>
      fulfil === "connectionreset"
        ? route.abort(fulfil)
        : route.fulfill(fulfil),
    );
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Delete Account" }).click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByRole("button", { name: "Yes, delete my account" })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(UNKNOWN_OUTCOME);
    await expect(dialog.getByRole("alert")).not.toContainText(
      /Dependency Failure|status 50/,
    );
    await expect(
      dialog.getByRole("button", { name: "Try again" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/account\/settings$/);
    expect(logouts).toHaveLength(0);
    await page.goto("/account");
    await expect(page).toHaveURL(/\/account$/);
  });
}

const unauthenticated = {
  status: 401,
  contentType: "application/problem+json",
  body: JSON.stringify({
    type: "urn:autom8x:problem:unauthenticated",
    title: "Sign in is required.",
    status: 401,
    code: "UNAUTHENTICATED",
  }),
};

test("an expired session is said inline, with the way back in — not a retry, not a redirect", async ({
  page,
}) => {
  const deletes = observe(page, (request) => request.method() === "DELETE");
  const logouts = observe(page, isLogout);
  await page.route(/\/api\/platform\/v1\/account$/, (route) =>
    route.fulfill(unauthenticated),
  );
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Your session ended, so this attempt did not run",
  );
  // The way back in returns to this page; the login page validates the target.
  const signIn = dialog.getByRole("link", { name: "Sign in again" });
  await expect(signIn).toHaveAttribute(
    "href",
    "/login?callbackUrl=%2Faccount%2Fsettings",
  );
  // Focus follows the replaced control (NFR-35): nobody is left on <body>.
  await expect(signIn).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Try again" })).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(/\/account\/settings$/);
  expect(deletes).toHaveLength(1);
  expect(logouts).toHaveLength(0);
  // An ended session survives Cancel: reopening offers the way back in, never
  // the destructive button again.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Delete Account" }).click();
  const reopened = page.getByRole("dialog");
  await expect(
    reopened.getByRole("link", { name: "Sign in again" }),
  ).toBeVisible();
  await expect(
    reopened.getByRole("button", { name: "Yes, delete my account" }),
  ).toHaveCount(0);
  expect(deletes).toHaveLength(1);
});

test("a 401 right after a lost answer hedges — the account may already be gone", async ({
  page,
}) => {
  // The earlier attempt may have finished server-side and taken the session
  // with it, so "this attempt did not run" would overclaim.
  let answer: "lost" | "expired" = "lost";
  await page.route(/\/api\/platform\/v1\/account$/, (route) =>
    answer === "lost"
      ? route.fulfill({
          status: 502,
          contentType: "text/html",
          body: "<!doctype html><title>502</title><p>Bad Gateway</p>",
        })
      : route.fulfill(unauthenticated),
  );
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(dialog.getByRole("alert")).toContainText(UNKNOWN_OUTCOME);
  answer = "expired";
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "may already have been removed by the earlier attempt",
  );
  await expect(
    dialog.getByRole("link", { name: "Sign in again" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account\/settings$/);
});

test("a session that ended while the settings page was open is said, with the way back in (register F40)", async ({
  page,
}) => {
  await page.route(/\/api\/platform\/v1\/auth\/identities$/, (route) =>
    route.fulfill(unauthenticated),
  );
  await page.goto("/account/settings");
  const alert = page
    .getByRole("alert")
    .filter({ hasText: "Your session ended." });
  await expect(alert).toHaveText(
    "Your session ended. Sign in again to see your linked accounts.",
  );
  await expect(
    alert.getByRole("link", { name: "Sign in again" }),
  ).toHaveAttribute("href", "/login?callbackUrl=%2Faccount%2Fsettings");
  await expect(page.getByText("Could not load linked accounts.")).toHaveCount(
    0,
  );
});

test("an answer lost behind the website's own proxy reads as unknown — and after Cancel, the retry's 401 still hedges", async ({
  page,
}) => {
  // No page.route: the fixture's departing session runs its deletion and then
  // drops the connection, and the website's own /api/platform rewrite meets
  // that loss. Its session went with the account, so the next attempt is 401.
  await page.context().addCookies([
    {
      name: "e2e-public-edge-session",
      value: "departing",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  const logouts = observe(page, isLogout);
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(dialog.getByRole("alert")).toContainText(UNKNOWN_OUTCOME);
  // Focus is back on the control that answers it (NFR-35), not on <body>.
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeFocused();
  // The person closes the dialog and comes back to it later on the same page.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Delete Account" }).click();
  const reopened = page.getByRole("dialog");
  await reopened
    .getByRole("button", { name: "Yes, delete my account" })
    .click();
  await expect(reopened.getByRole("alert")).toContainText(
    "may already have been removed by the earlier attempt",
  );
  await expect(
    reopened.getByRole("link", { name: "Sign in again" }),
  ).toBeFocused();
  await expect(page).toHaveURL(/\/account\/settings$/);
  expect(logouts).toHaveLength(0);
});

test("a refusal says in words that the account was kept, and focus returns to Try again (register F46)", async ({
  page,
}) => {
  await page.route(/\/api\/platform\/v1\/account$/, (route) =>
    route.fulfill({
      status: 403,
      contentType: "application/problem+json",
      body: JSON.stringify({
        type: "urn:autom8x:problem:forbidden",
        title: "Request origin is not allowed",
        status: 403,
        code: "FORBIDDEN",
      }),
    }),
  );
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  // The Edge's generic title tells a person nothing they can act on.
  await expect(dialog.getByRole("alert")).toHaveText(
    "The platform refused this request, so your account was not deleted. Reload the page and try again; if it is refused again, contact support.",
  );
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeFocused();
  await expect(page).toHaveURL(/\/account\/settings$/);
});

test("a busy platform is said with its wait, and the account is kept", async ({
  page,
}) => {
  await page.route(/\/api\/platform\/v1\/account$/, (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/problem+json",
      headers: { "retry-after": "30" },
      body: JSON.stringify({
        type: "urn:autom8x:problem:rate-limited",
        title: "Too Many Requests",
        status: 429,
        code: "RATE_LIMITED",
      }),
    }),
  );
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    `${busy} Your account was not deleted.`,
  );
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeFocused();
  await expect(page).toHaveURL(/\/account\/settings$/);
});

test("signed out, the login page arrives with its providers — read on the server, not by the browser", async ({
  page,
}) => {
  // Backend §12.1 #160: the one read every signed-out visitor makes is made by
  // the website's server, cookieless and cached, instead of once a view.
  await page.context().clearCookies();
  const browserReads = observe(page, (request) =>
    request.url().includes("/v1/auth/providers"),
  );
  await page.goto("/login");
  await expect(page.getByRole("link", { name: /Google/ })).toBeVisible();
  expect(browserReads).toEqual([]);
});

test("a crafted return target cannot leave the site — signed in, the login page lands on the account", async ({
  page,
}) => {
  // Signed in, the login page sends a person straight on to its return
  // target, so a target that normalises to "//host" would leave the site.
  for (const target of [
    "/.//evil.example",
    "/%2e//evil.example",
    "/..//evil.example",
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
  ]) {
    await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
    await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:3001\/account$/);
  }
  // The control: an ordinary return target is honoured.
  await page.goto(
    `/login?callbackUrl=${encodeURIComponent("/account/settings")}`,
  );
  await expect(page).toHaveURL(
    /^http:\/\/127\.0\.0\.1:3001\/account\/settings$/,
  );
});

test("keyboard journey — the owner's NFR-35 traversal, by hand", async ({
  page,
}) => {
  // Not an automated assertion: the playbook's Round 5 gate asks for a human
  // keyboard traversal of the core journey. This opens the built site against
  // the loopback fixture, signed in as the owner, and hands the browser over.
  // Run it alone, headed:
  //   KEYBOARD_JOURNEY=1 node scripts/run-browser-fixtures.mjs --headed --grep "keyboard journey"
  // Resume in the Playwright Inspector ends it. The route list is in the Round 5
  // audit (docs/audits/2026-08-11-round-5-phase-1-status.md).
  test.skip(
    process.env.KEYBOARD_JOURNEY !== "1",
    "the owner's traversal, run on purpose with KEYBOARD_JOURNEY=1",
  );
  test.setTimeout(0);
  await page.goto("/account");
  await page.pause();
});
