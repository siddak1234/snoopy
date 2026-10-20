import { crc32, deflateSync } from "node:zlib";
import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  test,
  type BrowserContext,
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
  runForm,
  settledAnimations,
  worstContrast,
} from "./helpers";

const requesterUserId = "66666666-6666-4666-8666-666666666666";
const organizationWorkspaceId = "11111111-1111-4111-8111-111111111111";
const personalWorkspaceId = "88888888-8888-4888-8888-888888888888";
const busy = "The platform is busy right now. Try again in 30 seconds.";

const isLogout = (request: Request) =>
  request.method() === "POST" && request.url().includes("/v1/auth/logout");

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
  await connectionRow(page, "fixture-key")
    .getByRole("button", { name: "Connect Fixture key provider" })
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
  // Connected: its row says so, and its one button is Disconnect.
  const row = connectionRow(page, "fixture-key");
  await expect(row).toContainText("Connected");
  await expect(
    row.getByRole("button", { name: "Disconnect Fixture key provider" }),
  ).toBeVisible();
});

test("a dialog that sends nothing yet closes on a click outside it, as on Escape (components/ui/Modal's default)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const connect = connectionRow(page, "fixture-key").getByRole("button", {
    name: "Connect Fixture key provider",
  });
  const dialog = page.getByRole("dialog", {
    name: "Connect Fixture key provider",
  });
  await connect.click();
  await expect(dialog).toBeVisible();
  await page.mouse.click(4, 4);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await connect.click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Connect on a vendor someone connected since the page was read asks no consent, and says so (backend §12.1 #172)", async ({
  page,
}) => {
  const consent = observe(page, (request) =>
    request.url().includes("/connections?status="),
  );
  await fixtureControl("google-disconnected");
  await page.goto("/account/connections");
  const row = connectionRow(page, "google");
  await expect(row).toContainText("Not connected");
  // Another admin connects it meanwhile; the platform reuses that grant.
  await fixtureControl("google-connected");
  await row.getByRole("button", { name: "Connect Google" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "already connected" }),
  ).toHaveText(
    "Google is already connected as person@example.com, with everything it needs — there is nothing to authorize.",
  );
  await expect(page).toHaveURL(/\/account\/connections$/);
  expect(consent).toEqual([]);
  // Read again: its row says the account, and Disconnect.
  await expect(row).toContainText("person@example.com");
  await expect(
    row.getByRole("button", { name: "Disconnect Google" }),
  ).toBeVisible();
});

test("Connections: one row per vendor — its mark at 24, its name, the account's email or its state, our own button — at one least height, and nothing else said (Build 21, spec A4; the owner's build 20 items 6 and 7)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const google = connectionRow(page, "google");
  await expect(google.getByRole("img", { name: "Google" })).toBeVisible();
  await expect(google).toContainText("Google");
  await expect(google).toContainText("person@example.com");
  await expect(
    google.getByRole("button", { name: "Disconnect Google" }),
  ).toHaveText("Disconnect");
  const quickbooks = connectionRow(page, "quickbooks");
  await expect(
    quickbooks.getByRole("img", { name: "QuickBooks" }),
  ).toHaveAttribute("src", "/vendors/quickbooks-symbol.png");
  await expect(quickbooks).toContainText("QuickBooks Online");
  await expect(quickbooks).toContainText("Not connected");
  // Our own Connect: no vendor's button image (the owner's ~04:15Z).
  await expect(
    quickbooks.getByRole("button", { name: "Connect QuickBooks Online" }),
  ).toHaveText("Connect");
  await expect(page.locator('img[src*="connect-to-quickbooks"]')).toHaveCount(
    0,
  );
  // One least height for every row — Google's and QuickBooks' the same — and
  // every mark 24 × 24, in both palettes.
  const measured = async () => {
    const heights = await page
      .locator("[data-connection-row]")
      .evaluateAll((rows) =>
        rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      );
    expect(heights.length).toBe(4);
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeGreaterThanOrEqual(64);
    for (const mark of await page
      .locator("[data-connection-row] [data-mark]")
      .all()) {
      const box = await mark.boundingBox();
      expect([Math.round(box!.width), Math.round(box!.height)]).toEqual([
        24, 24,
      ]);
    }
    return heights[0];
  };
  const dark = await measured();
  // No description, no "Used by", no Available connections, no Replace account.
  for (const gone of [
    "Records bills and receipts.",
    "Reads and sends email.",
    "Available connections",
    "Replace account",
  ]) {
    await expect(page.getByText(gone)).toHaveCount(0);
  }
  await expect(page.getByText(/Used by/u)).toHaveCount(0);
  await expectNoAxeViolations(page);
  // The light palette: the same rows, at the same height.
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await measured()).toBe(dark);
  await page.evaluate(() => localStorage.removeItem("theme"));
  await page.reload();
  // Disconnect asks first, saying what it stops.
  const disconnect = google.getByRole("button", { name: "Disconnect Google" });
  await disconnect.click();
  const dialog = page.getByRole("dialog", { name: "Disconnect Google?" });
  await expect(dialog).toContainText(
    "2 live flows use it. They stop until you connect it again.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(disconnect).toBeFocused();
  await disconnect.click();
  await page
    .getByRole("dialog", { name: "Disconnect Google?" })
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(google).toContainText("Not connected");
  await expect(
    google.getByRole("button", { name: "Connect Google" }),
  ).toBeVisible();
});

test("a connection that needs reauthorization says so on its row, and is repaired by Reconnect, not reused (backend §12.1 #175)", async ({
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
  const row = connectionRow(page, "fixture-oauth");
  await expect(row).toContainText("Needs attention");
  await row
    .getByRole("button", { name: "Reconnect Fixture OAuth provider" })
    .click();
  await page.waitForURL(/^https:\/\/oauth\.invalid\/authorize/);
});

// The page a connect returns to carries only `status`; whether "your existing
// connection is still active" is true depends on the provider the connect left
// for, which this tab remembers (register F100). The fixture starts with its
// OAuth provider connected and its key provider not.
const stillActive =
  "The new authorization didn't complete, so nothing changed — your existing connection is still active. Try again or contact an owner.";
const notCompleted =
  "The connection could not be completed. Try again or contact an owner.";
const pendingConnectKey = "autom8x.connections.pending";

test("an unfinished connect says the connection is still active only when the provider it left for has one (register F100)", async ({
  page,
}) => {
  const banner = page
    .getByRole("alert")
    .filter({ hasText: "Try again or contact an owner." });
  const returnFor = async (providerId: string | null) => {
    await page.evaluate(
      ({ key, value }) =>
        value === null
          ? sessionStorage.removeItem(key)
          : sessionStorage.setItem(key, value),
      { key: pendingConnectKey, value: providerId },
    );
    await page.goto("/account/connections?status=error");
  };
  await page.goto("/account/connections");
  // Left for the provider that is connected: it still is.
  await returnFor("fixture-oauth");
  await expect(banner).toHaveText(stillActive);
  // Left for one with no connection, while another provider is connected —
  // the case the page used to answer "still active".
  await returnFor("fixture-key");
  await expect(banner).toHaveText(notCompleted);
  // Nothing remembered (another tab, storage refused): only what is certain.
  await returnFor(null);
  await expect(banner).toHaveText(notCompleted);
});

test("Reconnect remembers the provider before it leaves for its consent (register F100)", async ({
  page,
}) => {
  await page.route("https://oauth.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>consent</h1>",
    }),
  );
  const banner = page
    .getByRole("alert")
    .filter({ hasText: "Try again or contact an owner." });
  // Reconnect on a connection that needs reauthorization: remembered, and
  // that connection is not active, so the page does not say it is.
  await fixtureControl("oauth-connection-broken");
  await page.goto("/account/connections");
  await connectionRow(page, "fixture-oauth")
    .getByRole("button", { name: "Reconnect Fixture OAuth provider" })
    .click();
  await page.waitForURL(/^https:\/\/oauth\.invalid\/authorize/);
  await page.goto("/account/connections?status=error");
  await expect(banner).toHaveText(notCompleted);
  expect(
    await page.evaluate(
      (key) => sessionStorage.getItem(key),
      pendingConnectKey,
    ),
  ).toBe("fixture-oauth");
});

test("subscription refusals render only the two documented entitlement states", async ({
  page,
}) => {
  // Neither flow is held anywhere, so Add sends each to the fixture's one team
  // (the owner's build 10, and build 12's #9); the platform's refusal is the
  // same whatever the team.
  await page.goto("/account/flows");
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

test("over the plan's flow allowance, Flows says so and a run's start is refused in the same words (the owner's build 13 decision 7a3)", async ({
  page,
}) => {
  const sentence =
    "Your plan allows 2 flows; this workspace has 4. No flow can start a run until you archive 2. Paused and draft flows count.";
  await fixtureControl("over-plan");
  await page.goto("/account/flows");
  await expect(page.getByTestId("flows-over-plan")).toHaveText(sentence);
  await page.goto(FLOWS.manual);
  const form = runForm(page);
  await form.getByLabel("Vendor").fill("Acme Supplies");
  await form.getByLabel("Amount").fill("10");
  await form.getByLabel("Invoice reference").fill("R-1");
  await form.getByRole("button", { name: "Start run" }).click();
  await expect(form.getByRole("alert")).toHaveText(sentence);
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}$`, "u"));
});

test("within the plan, Flows says nothing of it", async ({ page }) => {
  await page.goto("/account/flows");
  await expect(
    automationCard(page, "Manual input automation").getByRole("link", {
      name: "Open Manual input automation",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("flows-over-plan")).toHaveCount(0);
});

test("a live flow whose pinned version declares run input is opened from its card and started from Step 1 of its page, and the run's page follows (Build 21, spec A6)", async ({
  page,
}) => {
  // Backend §12.1 #162, ADR-0030. The fixture creates the run only when the
  // input is exactly the declaration, typed as it says — so landing on the run's
  // page proves the form sent a number for money and nothing undeclared.
  await page.goto("/account/flows");
  const card = automationCard(page, "Manual input automation");
  // The card holds no Run, Set up, Pause or Archive any more: Open.
  for (const gone of ["Run", "Set up", "Pause", "Archive flow"]) {
    await expect(
      card.getByRole("button", { name: gone, exact: true }),
    ).toHaveCount(0);
  }
  await card
    .getByRole("link", { name: "Open Manual input automation" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}$`, "u"));
  const form = runForm(page);
  // The declared fields, in order, titles only. The file is optional, so a
  // run starts without one (backend FR-14; a file is chosen in the tests below).
  await expect(form.getByLabel("Vendor")).toBeVisible();
  await expect(form.getByLabel("Amount")).toHaveAttribute("type", "number");
  await expect(form.getByLabel("Invoice reference")).toBeVisible();
  await expect(form.getByLabel("Invoice file")).toHaveAttribute("type", "file");
  await expect(form.getByText("Who sent the invoice.")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await form.getByLabel("Vendor").fill("Acme Supplies");
  await form.getByLabel("Amount").fill("120.50");
  await form.getByLabel("Invoice reference").fill("INV-1001");
  await form.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
  await expect(page.getByText("Manual", { exact: true })).toBeVisible();
});

test("a refused start keeps what was typed and the same idempotency key, so resubmitting cannot start a second run", async ({
  page,
}) => {
  // React resets an action form's fields when the action settles; these forms
  // submit from onSubmit so a refusal keeps them (the change audit's P12b).
  await page.goto(FLOWS.manual);
  const dialog = runForm(page);
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

test("a start refused because its flow and the flow's queue are full says so in the flow's words, keeps what was typed and its key, and goes through once there is room (backend BUILD-PLAN 25.2.10)", async ({
  page,
}) => {
  // At capacity the platform holds a new run back, pending, until its turn;
  // only with as many waiting as the flow runs at once is a start refused —
  // 429 `max_concurrent_runs` — and nothing is created. Any other 429 keeps
  // the platform's words (the test above).
  await page.goto(FLOWS.manual);
  const dialog = runForm(page);
  await dialog.getByLabel("Vendor").fill("Acme Supplies");
  await dialog.getByLabel("Amount").fill("10");
  await dialog.getByLabel("Invoice reference").fill("R-1");
  const key = dialog.locator('input[name="idempotencyKey"]');
  const sent = await key.inputValue();
  await fixtureControl("run-at-capacity-once");
  await dialog.getByRole("button", { name: "Start run" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This flow is busy and its queue is full, so the run was not started. Try again once one of its runs has ended.",
  );
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}$`, "u"));
  await expect(dialog.getByLabel("Vendor")).toHaveValue("Acme Supplies");
  await expect(key).toHaveValue(sent);
  // Room again: the same start, with the same key, goes through.
  await dialog.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
});

test("a refused Set up save stays on its page, says so in the spec's words, and keeps what was typed; saved, the flow's page follows and the flow stays on (the owner's AM4; the app's M2)", async ({
  page,
}) => {
  // The change audit's P11: a failed save used to revalidate the page, and under
  // a refusal that re-render replaced the form with the "busy" panel.
  await page.goto(FLOWS.manual);
  await page.getByRole("link", { name: "Edit setup" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}/setup$`, "u"));
  await expect(
    page.getByRole("heading", { name: "Set up Manual input automation" }),
  ).toBeVisible();
  const main = page.locator("main");
  await expect(main.getByLabel("Spending limit")).toHaveValue("500");
  // No help line under a setting (spec A6; S11) — a switch still says what it switches.
  await expect(
    main.getByText("Runs above this amount wait for approval."),
  ).toHaveCount(0);
  await expectNoAxeViolations(page);
  await expect(main.getByLabel("Failure notices")).toBeVisible();
  await expect(main).toContainText(
    "Controls the notification sent when a run fails.",
  );
  // A flow already on is saved, never turned on again.
  await expect(main.getByRole("button", { name: "Turn on" })).toHaveCount(0);
  await main.getByLabel("Spending limit").fill("99");
  await presentSession(page, "throttled");
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(main.getByRole("alert")).toHaveText(
    "Could not save. Try again.",
  );
  await expect(main.getByLabel("Spending limit")).toHaveValue("99");
  // An amount emptied is said before anything is sent.
  await presentSession(page, "owner");
  await main.getByLabel("Spending limit").fill("");
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(main.getByRole("alert")).toHaveText(
    "Enter an amount for Spending limit.",
  );
  await main.getByLabel("Spending limit").fill("99");
  await main.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.manual}$`, "u"));
  await expect(page.getByText(/^live$/iu)).toBeVisible();
});

test("a live flow that declares no run input offers no Start run; Archive flow, last on its page, is confirmed, gives Add back, and lists it under Archived flows with the day (BUILD-PLAN 24.11.11, the owner's build 9)", async ({
  page,
}) => {
  // Backend §12.1 #169 and #92: archiving is how a workspace frees a plan
  // slot; #203: the archived ones are read by name.
  await page.goto("/account/flows");
  const card = automationCard(page, "Archivable automation");
  // Held, so its card says Added ✓, and offers no Add (the owner's build 12,
  // #9; spec §3.A).
  const held = card.getByRole("link", { name: "Added ✓" });
  await expect(held).toBeVisible();
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Archived flows" }),
  ).toHaveCount(0);
  await page.goto(FLOWS.archivable);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(runForm(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start run" })).toHaveCount(0);
  const archive = page.getByRole("button", { name: "Archive flow" });
  await archive.click();
  const dialog = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  // It can be unarchived (the owner's build 12, #4).
  await expect(dialog).toContainText(
    "It stops and moves to Archived flows. Its runs stay in Activity, and you can unarchive it later.",
  );
  await expectNoAxeViolations(page);
  // Cancel changes nothing and hands focus back to the control that opened it.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(archive).toBeFocused();
  await archive.click();
  await page
    .getByRole("dialog", { name: "Archive Archivable automation?" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  // Archived, it goes back to Flows: Add is back, and "Added" is gone.
  await expect(page).toHaveURL(/\/account\/flows$/);
  await expect(card.getByRole("button", { name: "Add" })).toBeVisible();
  await expect(held).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Archived flows" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "An archived flow keeps its history here. Unarchive it any time.",
    ),
  ).toBeVisible();
  const archived = page
    .locator("main li")
    .filter({ hasText: "Archivable automation" });
  await expect(archived).toContainText("Whole workspace");
  await expect(archived).toContainText("Archived Sep 30, 2026");
});

test("Pause, at the bottom of a flow's page, and Turn on, in its Step 1, move a live flow and back, and its status follows (register F38; the app's M4)", async ({
  page,
}) => {
  await page.goto(FLOWS.manual);
  const status = page.getByText(/^(live|paused)$/iu);
  await expect(status).toHaveText(/^live$/iu);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(status).toHaveText(/^paused$/iu);
  // A paused flow starts nothing: Step 1 holds Turn on in Start run's place,
  // the fields kept — and there is no second Turn on at the bottom.
  const form = runForm(page);
  await expect(form.getByRole("button", { name: "Start run" })).toHaveCount(0);
  await expect(form.getByLabel("Vendor")).toBeVisible();
  await expect(page.getByRole("button", { name: "Turn on" })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Pause" })).toHaveCount(0);
  await form.getByRole("button", { name: "Turn on" }).click();
  await expect(status).toHaveText(/^live$/iu);
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
});

test("no move to another version: a flow still on an older one — which the platform could not move — offers none and says no version, to an owner, an admin or a member (Build 22, P4; the owner's build 21 item 7)", async ({
  page,
}) => {
  const main = page.locator("main");
  for (const session of ["owner", "admin", "member"] as const) {
    await presentSession(page, session);
    await page.goto(FLOWS.webhook);
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Webhook automation",
    );
    await expect(main).not.toContainText(/Move to v|is available|runs v/u);
    await expect(main.getByRole("button", { name: /Move/u })).toHaveCount(0);
  }
  // Nor on the newest version's flow.
  await page.goto(FLOWS.invoice);
  await expect(main).not.toContainText(/Move to v|is available/u);
  await expect(main.getByRole("button", { name: /Move/u })).toHaveCount(0);
});

test("an owner makes a webhook automation's address, sees its secret once, and a new secret keeps the address (backend §12.1 #91, #109)", async ({
  page,
}) => {
  const address =
    "https://hooks.example.test/v1/webhooks/efefefef-efef-4fef-8fef-efefefefefef";
  await page.goto(FLOWS.webhook);
  const card = page.locator("main");
  // A manual flow has no address to give.
  await page.goto(FLOWS.manual);
  await expect(
    card.getByRole("button", { name: "Webhook address" }),
  ).toHaveCount(0);
  await page.goto(FLOWS.webhook);
  const open = card.getByRole("button", { name: "Webhook address" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  // What the address is for, first (owner, build 7; BUILD-PLAN 24.11.11).
  await expect(dialog).toContainText(
    "Where a service sends the events that start this flow — give it this address and the secret, which it sends as the x-autom8x-webhook-secret header.",
  );
  await expect(dialog.getByText("This flow has no address yet.")).toBeVisible();
  await dialog.getByRole("button", { name: "Create address" }).click();
  await expect(dialog.getByText("fixture-secret-1")).toBeVisible();
  await expect(dialog).toContainText(address);
  // Said politely when it arrives; the secret itself is only shown.
  const said = "A new secret was made. Copy it now: it is shown this once.";
  await expect(dialog.getByRole("status")).toHaveText(said);
  await expectNoAxeViolations(page);
  // A new secret keeps the address and replaces the one shown.
  await dialog.getByRole("button", { name: "Make a new secret" }).click();
  await expect(dialog.getByText("fixture-secret-2")).toBeVisible();
  await expect(dialog.getByText("fixture-secret-1")).toHaveCount(0);
  await expect(dialog).toContainText(address);
  await expect(dialog.getByRole("status")).toHaveText(said);
  // Closed, the secret is gone; opened again, the address and its last
  // delivery are read, and no secret is.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open.click();
  await expect(dialog).toContainText(address);
  await expect(dialog).toContainText("Last delivery");
  await expect(dialog.getByText(/fixture-secret/u)).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Make a new secret" }),
  ).toBeVisible();
});

test("a webhook address's dialog cannot be dismissed while a secret is being made, so the secret is not lost (backend §12.1 #91, #109)", async ({
  page,
}) => {
  // Making a secret stops the old one when the platform answers, and the new
  // one exists only in that answer: a dialog closed meanwhile lost it.
  await page.goto(FLOWS.webhook);
  await page
    .locator("main")
    .getByRole("button", { name: "Webhook address" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await expect(dialog.getByText("This flow has no address yet.")).toBeVisible();
  const issue = await holdRequest(page, `**${FLOWS.webhook}`, isServerAction);
  await dialog.getByRole("button", { name: "Create address" }).click();
  await issue.arrived;
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  issue.release();
  await expect(dialog.getByText("fixture-secret-1")).toBeVisible();
});

test("a webhook automation's address is offered to an admin and to no plain member (backend §12.1 #109)", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await page.goto(FLOWS.webhook);
  await expect(
    page.locator("main").getByRole("button", {
      name: "Webhook address",
    }),
  ).toBeVisible();
  await presentSession(page, "member");
  await page.reload();
  const card = page.locator("main");
  await expect(
    card.getByRole("button", { name: "Archive flow" }),
  ).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Webhook address" }),
  ).toHaveCount(0);
});

test("a webhook address the platform will not read says so in its dialog, and offers nothing to make (backend §12.1 #91)", async ({
  page,
}) => {
  // A plain member is offered no address at all, so the owner's own read is
  // the one refused — as it is once they are no longer an admin — or failed.
  await page.goto(FLOWS.webhook);
  const open = page.locator("main").getByRole("button", {
    name: "Webhook address",
  });
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  for (const [status, words] of [
    [403, "Forbidden"],
    [503, "Service Unavailable"],
  ] as const) {
    await fixtureControl(`webhook-read-refused?status=${status}`);
    await open.click();
    await expect(dialog.getByRole("alert")).toHaveText(words);
    await expect(dialog.getByText("Loading…")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: /Create address|Make a new secret/u }),
    ).toHaveCount(0);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
});

test("a webhook address read before is not shown again beside a read the platform now refuses (backend §12.1 #91)", async ({
  page,
}) => {
  await page.goto(FLOWS.webhook);
  const open = page.locator("main").getByRole("button", {
    name: "Webhook address",
  });
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  const address = dialog.locator("code").filter({ hasText: "/v1/webhooks/" });
  await open.click();
  await dialog.getByRole("button", { name: "Create address" }).click();
  await expect(address).toHaveCount(1);
  await dialog.getByRole("button", { name: "Close" }).click();
  await fixtureControl("webhook-read-refused?status=403");
  await open.click();
  await expect(dialog.getByRole("alert")).toHaveText("Forbidden");
  await expect(address).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: /Create address|Make a new secret/u }),
  ).toHaveCount(0);
});

test("an address the platform will not make is said in words, and no secret is shown (backend §12.1 #91)", async ({
  page,
}) => {
  await page.goto(FLOWS.webhook);
  await page
    .locator("main")
    .getByRole("button", { name: "Webhook address" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await expect(dialog.getByText("This flow has no address yet.")).toBeVisible();
  const create = dialog.getByRole("button", { name: "Create address" });
  for (const [reason, words] of [
    ["trigger_kind_mismatch", "This flow is not started by a webhook."],
    ["subscription_archived", "An archived flow has no address."],
    // A reason the website does not name reads as the platform's own title.
    ["a_reason_not_named_here", "Conflict"],
  ] as const) {
    await fixtureControl(`webhook-issue-refused?reason=${reason}`);
    await create.click();
    await expect(dialog.getByRole("alert")).toHaveText(words);
    await expect(dialog.getByText(/fixture-secret/u)).toHaveCount(0);
    await expect(dialog.getByRole("status")).toHaveText("");
    await expect(create).toBeEnabled();
  }
});

test("an address the platform has no public origin for is shown by its id, and its last delivery's outcome is said in words (backend §12.1 #91)", async ({
  page,
}) => {
  await fixtureControl("webhook-no-origin");
  await fixtureControl("webhook-last-outcome?outcome=trigger_kind_mismatch");
  const id = "Address id efefefef-efef-4fef-8fef-efefefefefef";
  await page.goto(FLOWS.webhook);
  const open = page.locator("main").getByRole("button", {
    name: "Webhook address",
  });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await dialog.getByRole("button", { name: "Create address" }).click();
  // Made, its secret is shown — and, with no url to give, the address's id.
  await expect(dialog.getByText("fixture-secret-1")).toBeVisible();
  await expect(dialog).toContainText(id);
  await expect(dialog.getByText("Address", { exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Close" }).click();
  // Read again: the id, and what its last delivery came to, in words.
  await open.click();
  await expect(dialog).toContainText(id);
  await expect(
    dialog.getByText(/^Last delivery .+: trigger kind mismatch$/u),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Make a new secret" }),
  ).toBeVisible();
});

test("a secret whose answer was lost is asked for again with the same key, and is answered with that secret rather than a second rotation (backend §12.1 #240)", async ({
  page,
}) => {
  // The platform derives the secret from the press's key: a retry carrying it
  // is answered with the secret the lost answer carried, and nothing rotates.
  await page.goto(FLOWS.webhook);
  const open = page.locator("main").getByRole("button", {
    name: "Webhook address",
  });
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  const renew = dialog.getByRole("button", { name: "Make a new secret" });
  await open.click();
  await dialog.getByRole("button", { name: "Create address" }).click();
  await expect(dialog.getByText("fixture-secret-1")).toBeVisible();
  // Made, and its answer lost on the way back; pressed again, in the dialog.
  await fixtureControl("webhook-answer-lost");
  await renew.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The platform is unreachable",
  );
  await renew.click();
  await expect(dialog.getByText("fixture-secret-2")).toBeVisible();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
  // Lost again, and pressed again after the dialog was closed and reopened.
  await fixtureControl("webhook-answer-lost");
  await renew.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The platform is unreachable",
  );
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await open.click();
  await renew.click();
  await expect(dialog.getByText("fixture-secret-3")).toBeVisible();
  // A secret shown spends its key: the next press is a new secret.
  await renew.click();
  await expect(dialog.getByText("fixture-secret-4")).toBeVisible();

  const { webhookIssues } = await fixtureRead<{
    webhookIssues: { idempotencyKey: string | null; replayed: boolean }[];
  }>("counts");
  expect(webhookIssues.map(({ replayed }) => replayed)).toEqual([
    false,
    false,
    true,
    false,
    true,
    false,
  ]);
  const keys = webhookIssues.map(({ idempotencyKey }) => idempotencyKey);
  // Every press carries one, in the contract's IdempotencyKey shape.
  for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9._~:-]{16,128}$/u);
  // Each retry carries the key of the press it retries, and every press a
  // new one.
  expect(keys[2]).toBe(keys[1]);
  expect(keys[4]).toBe(keys[3]);
  expect(new Set([keys[0], keys[1], keys[3], keys[5]]).size).toBe(4);
});

// What the fixture's object store holds, read at the fixture: the run's page
// does not show the input it was started with.
function fixtureFiles() {
  return fixtureRead<{ filename: string; sizeBytes: number; runId?: string }[]>(
    "files",
  );
}

// How many completions of an upload the platform was asked for: a file waiting
// to be measured is completed again by itself (Round 17's B5), and no page
// shows how often.
async function uploadCompletions() {
  return (await fixtureRead<{ uploadCompletions: number }>("counts"))
    .uploadCompletions;
}

// What the fixture's object store took (BUILD-PLAN 25.8.5): each file's name,
// the type its upload was opened with, the type its PUT came as, and its bytes.
function storedObjects() {
  return fixtureRead<
    {
      filename: string;
      declaredType: string;
      contentType: string | null;
      bytes: string;
    }[]
  >("stored");
}

// A PNG built here, so no image is checked in: `paint` gives each pixel's red,
// green, blue and alpha. The signature, its header, one IDAT and the end.
function png(
  width: number,
  height: number,
  paint: (x: number, y: number) => readonly [number, number, number, number],
): Buffer {
  const stride = width * 4 + 1;
  // Each row begins with its filter, 0: none.
  const rows = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rows.set(paint(x, y), y * stride + 1 + x * 4);
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.byteLength);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  // Eight bits a channel, RGBA, no interlace.
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// A photo as a phone held sideways saves it: its pixels stored 3,000 wide and
// 1,000 tall, the left half red and the right half blue, and EXIF orientation
// 6 — "turn me a quarter clockwise". Upright it is 1,000 wide and 3,000 tall,
// red at the top. The browser encodes the JPEG; the orientation is written in
// here, after the start-of-image marker, where a camera writes it.
async function sidewaysPhoto(page: Page): Promise<Buffer> {
  const encoded = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 3000;
    canvas.height = 1000;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "red";
    context.fillRect(0, 0, 1500, 1000);
    context.fillStyle = "blue";
    context.fillRect(1500, 0, 1500, 1000);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95),
    );
    let binary = "";
    for (const byte of new Uint8Array(await jpeg!.arrayBuffer())) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary);
  });
  const jpeg = Buffer.from(encoded, "base64");
  // APP1, 34 bytes: "Exif", a big-endian TIFF header, and one IFD holding one
  // entry — tag 0x0112 (Orientation), one SHORT, 6.
  const exif = Buffer.from([
    0xff, 0xe1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x4d, 0x4d,
    0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01, 0x01, 0x12, 0x00, 0x03,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  return Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]);
}

// An image as a browser decodes it: its size, and the colour at points given
// as fractions of its width and height, each named as the tests paint them.
async function decodedImage(
  page: Page,
  base64: string,
  points: (readonly [number, number])[],
) {
  const image = await page.evaluate(
    async ([data, at]) => {
      const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes]));
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return {
        width: bitmap.width,
        height: bitmap.height,
        colours: at.map(([across, down]) => [
          ...context
            .getImageData(
              Math.floor(across * bitmap.width),
              Math.floor(down * bitmap.height),
              1,
              1,
            )
            .data.slice(0, 3),
        ]),
      };
    },
    [base64, points] as const,
  );
  const named = ([red = 0, green = 0, blue = 0]: number[]) =>
    red > 200 && green < 80 && blue < 80
      ? "red"
      : blue > 200 && red < 80 && green < 80
        ? "blue"
        : red > 235 && green > 235 && blue > 235
          ? "white"
          : red < 60 && green < 60 && blue < 60
            ? "black"
            : `rgb(${red}, ${green}, ${blue})`;
  return {
    width: image.width,
    height: image.height,
    colours: image.colours.map(named),
  };
}

// Step 1 of the manual flow's page (Build 21, spec A6), with its three typed
// fields filled — where the Run window was until Build 21.
async function openFilledRun(page: Page) {
  await page.goto(FLOWS.manual);
  const form = runForm(page);
  await form.getByLabel("Vendor").fill("Acme Supplies");
  await form.getByLabel("Amount").fill("120.50");
  await form.getByLabel("Invoice reference").fill("INV-1001");
  return form;
}

const invoicePdf = {
  name: "invoice.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 fixture invoice"),
};

test.describe("a file for a run (backend FR-14)", () => {
  // The browser PUTs the file straight to the fixture's object store, whose
  // certificate is the fixture's own.
  test.use({ ignoreHTTPSErrors: true });

  test("a chosen file goes straight to the object store, cross-origin, and the run is started with it", async ({
    page,
  }) => {
    const puts = observe(
      page,
      (request) =>
        request.method() === "PUT" &&
        request.url().startsWith("https://127.0.0.1:3443/__fixture/objects/"),
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    expect(puts).toHaveLength(1);
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Start run" }).click();
    // Nothing is asked first (the owner's D1): the run starts at the press —
    // though the fixture's account never answered the AI question.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    // The platform received the file's id, and gave the file to that run.
    expect(await fixtureFiles()).toEqual([
      { filename: "invoice.pdf", sizeBytes: 24, runId: "fixture-run-started" },
    ]);
  });

  test("the run waits for the file: Start run is held while it uploads", async ({
    page,
  }) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(
      "https://127.0.0.1:3443/__fixture/objects/**",
      async (route) => {
        await held;
        await route.continue();
      },
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await expect(dialog.getByText("Uploading invoice.pdf…")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Uploading…" }),
    ).toBeDisabled();
    release();
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
  });

  test("a page left mid-upload stops the upload, and back on it Start run is not held Uploading…", async ({
    page,
  }) => {
    const put = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await put.arrived;
    await page.goto("/account/flows");
    await page.goto(FLOWS.manual);
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
    await expect(dialog.getByText(/Uploading/u)).toHaveCount(0);
    // The abandoned upload was stopped: letting it through lands nothing.
    put.release();
    await dialog.getByLabel("Vendor").fill("Acme Supplies");
    await dialog.getByLabel("Amount").fill("120.50");
    await dialog.getByLabel("Invoice reference").fill("INV-1001");
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([]);
  });

  test("a file opened before another tab switched workspace is refused as it completes, and nothing is recorded (register F70)", async ({
    page,
    context,
  }) => {
    const put = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    // Opened on the workspace the page showed: the PUT is on its way.
    await put.arrived;
    const other = await context.newPage();
    try {
      await other.goto("/account");
      const trigger = other.getByRole("button", { name: "Switch workspace" });
      await trigger.click();
      await other.getByRole("button", { name: /Fixture Personal/ }).click();
      await expect(trigger).toContainText("Fixture Personal");
    } finally {
      await other.close();
    }
    put.release();
    await expect(dialog.getByRole("alert")).toHaveText(
      "The active workspace changed in another tab. Reload this page before continuing.",
    );
    await expect(dialog.getByText(/^Ready: invoice\.pdf/u)).toHaveCount(0);
    expect(await fixtureFiles()).toEqual([]);
  });

  test("an abandoned upload that ends never releases Start run while the file chosen since is still uploading", async ({
    page,
  }) => {
    const first = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await first.arrived;
    // Left mid-upload, and back.
    await page.goto("/account/flows");
    const second = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    await page.goto(FLOWS.manual);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await second.arrived;
    const start = dialog.getByRole("button", { name: /Start run|Uploading…/u });
    await expect(start).toHaveText("Uploading…");
    // The first upload's end is no word on the second's.
    first.release();
    await page.waitForTimeout(1_000);
    await expect(start).toHaveText("Uploading…");
    await expect(start).toBeDisabled();
    second.release();
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    await expect(start).toHaveText("Start run");
    await expect(start).toBeEnabled();
  });

  test("an upload the store never answers is given up, said, and its field emptied — not held Uploading… for ever", async ({
    page,
  }) => {
    await page.clock.install();
    const put = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles(invoicePdf);
    await put.arrived;
    await expect(dialog.getByText("Uploading invoice.pdf…")).toBeVisible();
    // The signed URL's fifteen minutes, and a moment.
    await page.clock.fastForward("15:01");
    await expect(dialog.getByRole("alert")).toHaveText(
      "The file could not be sent. Try again.",
    );
    await expect(file).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
  });

  test("a file the platform will no longer take is said so, and its field is emptied to choose it again", async ({
    page,
  }) => {
    // `artifact_unavailable`: a file already given to a run, or gone.
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    await fixtureControl("files-collected");
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      "That file can no longer be used. Choose it again.",
    );
    await expect(dialog.getByText(/^Ready:/u)).toHaveCount(0);
    await expect(dialog.getByLabel("Invoice file")).toHaveValue("");
    // What was typed stays; the file chosen again starts the run with it.
    await expect(dialog.getByLabel("Vendor")).toHaveValue("Acme Supplies");
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    // Agreed once already: not asked again.
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([
      { filename: "invoice.pdf", sizeBytes: 24, runId: "fixture-run-started" },
    ]);
  });

  test("a file that is not a PDF, a JPEG or a PNG is refused in words before anything is sent — its upload is never opened (BUILD-PLAN 25.8.5)", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    const sent = observe(
      page,
      (request) =>
        isServerAction(request) ||
        (request.method() === "PUT" && request.url().includes("/__fixture/")),
    );
    await dialog.getByLabel("Invoice file").setInputFiles({
      name: "invoice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an invoice"),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose a PDF, JPEG or PNG file.",
    );
    expect(sent).toEqual([]);
    // Emptied, so the same file chosen again is a change the browser reports.
    await expect(dialog.getByLabel("Invoice file")).toHaveValue("");
    // The file is optional: the run still starts, with no file.
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([]);
  });

  test("a file the store refuses is said so and its field emptied, and the PUT carried no cookie of the browser's", async ({
    page,
  }) => {
    await fixtureControl("store-refusing");
    // The session's own cookie is SameSite=Lax, which this cross-scheme PUT
    // would not carry anyway. A cookie that may travel across sites to the
    // store's host is the one only `credentials: "omit"` keeps home.
    await page.context().addCookies([
      {
        name: "e2e-store-host",
        value: "reachable",
        url: "https://127.0.0.1:3443",
        secure: true,
        sameSite: "None",
      },
    ]);
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles(invoicePdf);
    await expect(dialog.getByRole("alert")).toHaveText(
      "The file was not accepted. Choose it again.",
    );
    await expect(file).toHaveValue("");
    await expect(dialog.getByText(/^Ready:/u)).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
    // Read where the PUT landed: it arrived, and no cookie came with it —
    // the store would have taken one.
    expect(
      await fixtureRead<{ storePuts: number; storePutsWithCookie: number }>(
        "counts",
      ),
    ).toMatchObject({ storePuts: 1, storePutsWithCookie: 0 });
  });

  test("a file the store took but the platform finds did not arrive is said so, its field emptied, and nothing is recorded", async ({
    page,
  }) => {
    // The store answers the PUT and keeps nothing, so the platform's
    // completion finds no object (`no_object`).
    await page.route("https://127.0.0.1:3443/__fixture/objects/**", (route) =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 200,
            headers: { "access-control-allow-origin": "http://127.0.0.1:3001" },
            contentType: "application/json",
            body: "{}",
          })
        : route.fallback(),
    );
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles(invoicePdf);
    await expect(dialog.getByRole("alert")).toHaveText(
      "The file did not arrive. Choose it again.",
    );
    await expect(file).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
    expect(await fixtureFiles()).toEqual([]);
  });

  test("an empty file is refused in words before anything is sent, and the field says nothing of being optional (spec §3.D)", async ({
    page,
  }) => {
    const sent = observe(page, (request) =>
      request.url().includes("/__fixture/objects/"),
    );
    const dialog = await openFilledRun(page);
    await expect(
      dialog.locator("label", { hasText: "Invoice file" }),
    ).toHaveText("Invoice file");
    await expect(dialog).not.toContainText("(optional)");
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles({
      name: "empty.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    });
    await expect(dialog.getByRole("alert")).toHaveText("The file is empty.");
    await expect(file).toHaveValue("");
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
    expect(sent).toEqual([]);
    expect((await fixtureRead<{ storePuts: number }>("counts")).storePuts).toBe(
      0,
    );
  });

  test("each refusal of a file the platform names is said in its words, one it does not name by its title, and the field is emptied each time", async ({
    page,
  }) => {
    // A file still waiting to be measured is said only after four more
    // completions, 1.5 s apart (Round 17's B5), beside thirteen refusals.
    test.slow();
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    for (const [stage, status, reason, words] of [
      // A flow whose manifest takes fewer types than the three.
      [
        "open",
        400,
        "content_type_not_accepted",
        "This flow does not accept that type of file.",
      ],
      [
        "open",
        400,
        "file_too_large",
        "The file is larger than this flow accepts.",
      ],
      [
        "open",
        409,
        "subscription_not_live",
        "Turn it on first; a paused flow takes no files.",
      ],
      ["open", 409, "no_file_input", "This flow does not take a file."],
      // A reason the website does not name reads as the platform's own title.
      ["open", 400, "a_reason_not_named_here", "Bad Request"],
      [
        "complete",
        400,
        "session_expired",
        "The upload took too long. Choose the file again.",
      ],
      [
        "complete",
        400,
        "too_large",
        "The file is larger than this flow accepts.",
      ],
      // The platform's five reasons since it measures a file at seal (backend
      // BUILD-PLAN 25.2.28); the numbers' sentences are held by
      // test/upload-refusals.test.mjs, and with none sent the plain one is said.
      [
        "complete",
        400,
        "file_too_many_pages",
        "This PDF has more pages than this flow reads.",
      ],
      [
        "complete",
        400,
        "file_image_too_large",
        "This image is larger than this flow takes.",
      ],
      [
        "complete",
        400,
        "file_content_mismatch",
        "This file's contents don't match its type. Choose the original file again.",
      ],
      [
        "complete",
        400,
        "file_encrypted",
        "This PDF is password-protected. Remove the password and upload it again.",
      ],
      [
        "complete",
        400,
        "file_unreadable",
        "This file could not be read. Choose it again, or try another copy.",
      ],
      // No place yet to measure the file (backend BUILD-PLAN 25.2.39): a 429,
      // not a refusal. Answered so to every completion here, the Run window's
      // four more (Round 17's B5) find no place either, and only then is it
      // said — as its own, never as the platform being busy.
      [
        "complete",
        429,
        "measurement_busy",
        "Files are checked one at a time. Nothing was lost. Choose the file again in a moment.",
      ],
      ["complete", 409, "a_reason_not_named_here", "Conflict"],
    ] as const) {
      const asked = await uploadCompletions();
      await fixtureControl(
        `upload-refused?stage=${stage}&status=${status}&reason=${reason}`,
      );
      await file.setInputFiles(invoicePdf);
      const waits = reason === "measurement_busy";
      // Its words come after four waits of 1.5 s: past expect's own 5 s.
      await expect(dialog.getByRole("alert")).toHaveText(
        words,
        waits ? { timeout: 15_000 } : {},
      );
      await expect(file).toHaveValue("");
      await expect(
        dialog.getByRole("button", { name: "Start run" }),
      ).toBeEnabled();
      // An upload refused as it opens is never completed; a refused completion
      // is asked once, and one whose file waits to be measured five times.
      expect((await uploadCompletions()) - asked).toBe(
        stage === "open" ? 0 : waits ? 5 : 1,
      );
    }
    expect(await fixtureFiles()).toEqual([]);
  });

  test("a file waiting to be measured is completed again by itself: still uploading meanwhile, then ready with nothing said, and the run starts with it (backend BUILD-PLAN 25.2.39, Round 17's B5)", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    // The next completion finds no place yet to measure the file; the one
    // after measures it.
    await fixtureControl("measurement-busy-once");
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    // Answered busy: for the 1.5 s before it is asked again, the field says
    // only that it is uploading, and the run waits for it.
    await expect.poll(uploadCompletions, { intervals: [50] }).toBe(1);
    await expect(dialog.getByText("Uploading invoice.pdf…")).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Uploading…" }),
    ).toBeDisabled();
    // Asked again, it is measured: ready, nothing said, two completions in all.
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    expect(await uploadCompletions()).toBe(2);
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([
      { filename: "invoice.pdf", sizeBytes: 24, runId: "fixture-run-started" },
    ]);
  });

  test("any other 429 at a completion is the platform being busy, said at once and never asked again (Round 17's B5)", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    // The plan's request limit, which the Edge may answer on any route.
    await fixtureControl(
      "upload-refused?stage=complete&status=429&reason=over_workspace_quota",
    );
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles(invoicePdf);
    await expect(dialog.getByRole("alert")).toHaveText(
      "The platform is busy right now. Try again in a moment.",
    );
    await expect(file).toHaveValue("");
    // Said once its one completion was answered: a retry would come first.
    expect(await uploadCompletions()).toBe(1);
  });
});

test.describe("a photo or an image for a run (backend BUILD-PLAN 25.8.5)", () => {
  // The browser PUTs the file straight to the fixture's object store, whose
  // certificate is the fixture's own.
  test.use({ ignoreHTTPSErrors: true });

  test("the file chooser takes a PDF, a JPEG or a PNG, and a computer is offered no Take photo", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    await expect(dialog.getByLabel("Invoice file")).toHaveAttribute(
      "accept",
      "application/pdf,image/jpeg,image/png",
    );
    // A mouse is this browser's primary pointer, as a computer's is.
    expect(
      await page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    ).toBe(false);
    await expect(
      dialog.getByRole("button", { name: /Take photo/u }),
    ).toHaveCount(0);
    await expect(dialog.locator('input[type="file"]')).toHaveCount(1);
  });

  test("a PDF is sent as it is: its own bytes, name and type", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
    await expect(
      dialog.getByText("Ready: invoice.pdf (24 bytes)"),
    ).toBeVisible();
    expect(await storedObjects()).toEqual([
      {
        filename: "invoice.pdf",
        declaredType: "application/pdf",
        contentType: "application/pdf",
        bytes: invoicePdf.buffer.toString("base64"),
      },
    ]);
  });

  test("a PNG is drawn again and sent as a JPEG named .jpg, its long side 2,576 px and its transparency on white, and the run is started with it", async ({
    page,
  }) => {
    // 3,200 by 1,800: ink on the left two thirds, transparent on the right.
    const scan = png(3200, 1800, (x) =>
      x < 2133 ? [20, 20, 20, 255] : [0, 0, 0, 0],
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles({
      name: "scan.png",
      mimeType: "image/png",
      buffer: scan,
    });
    await expect(
      dialog.getByText(/^Ready: scan\.jpg \(\d+ KB\)$/u),
    ).toBeVisible();
    const [sent, ...others] = await storedObjects();
    expect(others).toEqual([]);
    expect(sent).toMatchObject({
      filename: "scan.jpg",
      declaredType: "image/jpeg",
      contentType: "image/jpeg",
    });
    const bytes = Buffer.from(sent!.bytes, "base64");
    // A JPEG's start-of-image marker, and not the PNG chosen.
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    expect(
      await decodedImage(page, sent!.bytes, [
        [0.25, 0.5],
        [0.9, 0.5],
      ]),
    ).toEqual({ width: 2576, height: 1449, colours: ["black", "white"] });
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([
      {
        filename: "scan.jpg",
        sizeBytes: bytes.byteLength,
        runId: "fixture-run-started",
      },
    ]);
  });

  test("a JPEG saved sideways is sent upright — drawn the way the phone was held — its long side 2,576 px", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles({
      name: "receipt.jpeg",
      mimeType: "image/jpeg",
      buffer: await sidewaysPhoto(page),
    });
    await expect(
      dialog.getByText(/^Ready: receipt\.jpg \(\d+ KB\)$/u),
    ).toBeVisible();
    const [sent, ...others] = await storedObjects();
    expect(others).toEqual([]);
    expect(sent).toMatchObject({
      filename: "receipt.jpg",
      declaredType: "image/jpeg",
      contentType: "image/jpeg",
    });
    // Red at the top: 1,000 by 3,000 upright, so 859 by 2,576.
    expect(
      await decodedImage(page, sent!.bytes, [
        [0.5, 0.1],
        [0.5, 0.9],
      ]),
    ).toEqual({ width: 859, height: 2576, colours: ["red", "blue"] });
  });

  test("a file refused before it is sent ends the upload it replaced: Start run is not held, and that file never lands", async ({
    page,
  }) => {
    const put = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles(invoicePdf);
    await put.arrived;
    await file.setInputFiles({
      name: "invoice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an invoice"),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "Choose a PDF, JPEG or PNG file.",
    );
    const start = dialog.getByRole("button", { name: /Start run|Uploading…/u });
    await expect(start).toHaveText("Start run");
    await expect(start).toBeEnabled();
    // The upload it replaced was stopped: let through, it lands nothing.
    put.release();
    await page.waitForTimeout(1_000);
    await expect(dialog.getByText(/^Ready:/u)).toHaveCount(0);
    expect(await fixtureFiles()).toEqual([]);
  });

  test("an image the browser cannot read is said so, its field emptied, and nothing is sent", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    const sent = observe(
      page,
      (request) =>
        isServerAction(request) ||
        (request.method() === "PUT" && request.url().includes("/__fixture/")),
    );
    const file = dialog.getByLabel("Invoice file");
    await file.setInputFiles({
      name: "torn.png",
      mimeType: "image/png",
      buffer: Buffer.from("not a picture at all"),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "The image could not be read. Try another.",
    );
    await expect(file).toHaveValue("");
    expect(sent).toEqual([]);
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
  });

  test.describe("on a phone or a tablet", () => {
    // A touchscreen as the primary pointer. Chromium's and Firefox's touch
    // emulation make `(pointer: coarse)` match (read 2026-10-10).
    test.use({ hasTouch: true });

    test("Take photo opens the camera, and the photo — held sideways — is sent upright as a JPEG whose long side is 2,576 px, in place of the file chosen before", async ({
      page,
      browserName,
    }) => {
      const dialog = await openFilledRun(page);
      const coarse = await page.evaluate(
        () => matchMedia("(pointer: coarse)").matches,
      );
      test.skip(
        !coarse && browserName === "webkit",
        "this WebKit's touch emulation leaves the primary pointer fine",
      );
      expect(coarse).toBe(true);
      const file = dialog.getByLabel("Invoice file");
      await expect(file).toHaveAttribute(
        "accept",
        "application/pdf,image/jpeg,image/png",
      );
      await file.setInputFiles(invoicePdf);
      await expect(
        dialog.getByText("Ready: invoice.pdf (24 bytes)"),
      ).toBeVisible();
      const takePhoto = dialog.getByRole("button", {
        name: "Take photo for Invoice file",
      });
      await expect(takePhoto).toBeVisible();
      await expectNoAxeViolations(page);

      // Closing the camera without a photo keeps the file the field holds.
      const [closed] = await Promise.all([
        page.waitForEvent("filechooser"),
        takePhoto.click(),
      ]);
      await closed.setFiles([]);
      await page.waitForTimeout(500);
      await expect(
        dialog.getByText("Ready: invoice.pdf (24 bytes)"),
      ).toBeVisible();

      const photo = await sidewaysPhoto(page);
      const [camera] = await Promise.all([
        page.waitForEvent("filechooser"),
        takePhoto.click(),
      ]);
      expect(await camera.element().getAttribute("accept")).toBe("image/*");
      expect(await camera.element().getAttribute("capture")).toBe(
        "environment",
      );
      expect(camera.isMultiple()).toBe(false);
      await camera.setFiles({
        name: "image.jpg",
        mimeType: "image/jpeg",
        buffer: photo,
      });
      await expect(
        dialog.getByText(/^Ready: image\.jpg \(\d+ KB\)$/u),
      ).toBeVisible();
      // The chooser no longer names the PDF the photo replaced.
      await expect(file).toHaveValue("");

      const [, taken, ...others] = await storedObjects();
      expect(others).toEqual([]);
      expect(taken).toMatchObject({
        filename: "image.jpg",
        declaredType: "image/jpeg",
        contentType: "image/jpeg",
      });
      // Upright — red at the top — and bounded: 1,000 by 3,000 becomes 859
      // by 2,576.
      expect(
        await decodedImage(page, taken!.bytes, [
          [0.5, 0.1],
          [0.5, 0.9],
        ]),
      ).toEqual({ width: 859, height: 2576, colours: ["red", "blue"] });
      await dialog.getByRole("button", { name: "Start run" }).click();
      await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
      expect(await fixtureFiles()).toEqual([
        { filename: "invoice.pdf", sizeBytes: 24 },
        {
          filename: "image.jpg",
          sizeBytes: Buffer.from(taken!.bytes, "base64").byteLength,
          runId: "fixture-run-started",
        },
      ]);
    });
  });
});

test("a ghost button keeps AA contrast when hovered and when pressed (register F64)", async ({
  page,
}) => {
  await page.goto(FLOWS.archivable);
  // Archive flow was this test's ghost until it turned red (the owner's build
  // 12, #5; register F85). The ghost measured now is its dialog's Cancel, on
  // the same surface.
  await page.getByRole("button", { name: "Archive flow" }).click();
  const ghost = page
    .getByRole("dialog", { name: "Archive Archivable automation?" })
    .getByRole("button", { name: "Cancel" });
  await expect(ghost).toHaveClass(/btn-ghost/);
  // Each state is measured once its transition has finished: the button from
  // pixels, the one measure the marketing test uses too (register F71), and the
  // rest of the page by axe.
  const contrast = () =>
    new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  await ghost.hover();
  await settledAnimations(ghost);
  expect(await worstContrast(page, ghost), "hovered").toBeGreaterThanOrEqual(
    4.5,
  );
  expect((await contrast()).violations).toEqual([]);
  await page.mouse.down();
  await settledAnimations(ghost);
  expect(await worstContrast(page, ghost), "pressed").toBeGreaterThanOrEqual(
    4.5,
  );
  expect((await contrast()).violations).toEqual([]);
  // Released elsewhere, so nothing is pressed.
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test("a danger button keeps AA contrast at rest, hovered and pressed: Archive flow (the owner's build 12, #5; register F85)", async ({
  page,
}) => {
  await page.goto(FLOWS.archivable);
  const archive = page.getByRole("button", { name: "Archive flow" });
  await expect(archive).toHaveClass(/btn-danger/);
  // Hovered, the stronger tint darkens the ground under the red: its resting
  // text computes to 4.45:1 there, so the hover takes the hover step.
  const contrast = () =>
    new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
  await settledAnimations(archive);
  expect(await worstContrast(page, archive), "at rest").toBeGreaterThanOrEqual(
    4.5,
  );
  await archive.hover();
  await settledAnimations(archive);
  expect(await worstContrast(page, archive), "hovered").toBeGreaterThanOrEqual(
    4.5,
  );
  expect((await contrast()).violations).toEqual([]);
  await page.mouse.down();
  await settledAnimations(archive);
  expect(await worstContrast(page, archive), "pressed").toBeGreaterThanOrEqual(
    4.5,
  );
  expect((await contrast()).violations).toEqual([]);
  // Released elsewhere, so nothing is archived.
  await page.mouse.move(0, 0);
  await page.mouse.up();
});

test("a flow is held once per workspace: its row says its team, and its card says Added ✓, going to it, with no Add (the owner's build 12, #9; spec §3.A)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  // In the general team, as a draft: its row says where, and the card offers
  // no Add but says it is added, going to its row.
  const draft = automationCard(page, "Team draft automation");
  await expect(
    draft.locator("p", { hasText: "Department: general" }),
  ).toBeVisible();
  await expect(draft.getByRole("combobox")).toHaveCount(0);
  await expect(draft.getByRole("button", { name: "Add" })).toHaveCount(0);
  const held = draft.getByRole("link", { name: "Added ✓" });
  await expect(held).toHaveAttribute(
    "href",
    "#flow-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
  await expectNoAxeViolations(page);
  await held.click();
  await expect(page).toHaveURL(/#flow-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb$/u);
  const row = page.locator("#flow-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  await expect(row).toContainText("Department: general");
  // Its team, its status and Open — its page, where it is turned on.
  await expect(
    row.getByRole("link", { name: "Open Team draft automation" }),
  ).toHaveAttribute(
    "href",
    "/account/flows/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  );
});

test("Add sends no team: the flow goes to the team of its category, which the platform makes when the workspace has none, and its Set up opens; Teams then lists it (backend ADR-0036; the owner, 2026-10-14; AM4)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  await expect(
    page.locator("main").getByText("Ready-made flows for your departments.", {
      exact: true,
    }),
  ).toBeVisible();
  const card = automationCard(page, "Project automation");
  // Its category, its price, and no version (spec §3.A, S9).
  await expect(card).toContainText("Operations");
  await expect(card).toContainText("Included");
  await expect(card).not.toContainText("Version");
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Added ✓" })).toHaveCount(0);
  await card.getByRole("button", { name: "Add" }).click();
  // Added, its Set up opens — one page, once (the owner's AM4) — in its team.
  await expect(page).toHaveURL(
    /\/account\/flows\/cccccccc-cccc-4ccc-8ccc-55555550cccc\/setup$/u,
  );
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "Set up Project automation", level: 1 }),
  ).toBeVisible();
  await expect(main).toContainText("Department: Operations");
  await expect(main.getByRole("button", { name: "Turn on" })).toBeVisible();
  await page.goto("/account/flows");
  await expect(
    card.locator("p", { hasText: "Department: Operations" }),
  ).toBeVisible();
  await expect(card.getByRole("link", { name: "Added ✓" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(card.getByRole("alert")).toHaveCount(0);
  // The platform made the team, named by its kind.
  expect(await createdTeams()).toEqual([
    {
      workspaceId: organizationWorkspaceId,
      name: "Operations",
      type: "Operations",
    },
  ]);
  await page.goto("/account/teams");
  await expect(page.getByRole("link", { name: /Operations/ })).toBeVisible();
});

test("Add on a page drawn before another tab added that flow is refused in words, and no second copy is made (the owner's build 12, #9; register F87)", async ({
  page,
  context,
}) => {
  await page.goto("/account/flows");
  const card = automationCard(page, "Project automation");
  await expect(card.getByRole("button", { name: "Add" })).toBeVisible();

  const other = await context.newPage();
  try {
    await other.goto("/account/flows");
    const there = automationCard(other, "Project automation");
    await there.getByRole("button", { name: "Add" }).click();
    await expect(other).toHaveURL(/\/setup$/u);
  } finally {
    await other.close();
  }

  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.getByRole("alert")).toHaveText(
    "This flow is already in this workspace.",
  );
  // Nothing was sent: read again, the flow is in its team once.
  await page.reload();
  await expect(
    card.locator("p", { hasText: "Department: Operations" }),
  ).toHaveCount(1);
  await expect(card.getByRole("link", { name: "Added ✓" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
});

test("a flow held twice from before one flow per workspace keeps both copies listed, each under its place, and its card says Added ✓ once (the owner's build 12, #9; register F87)", async ({
  page,
}) => {
  await fixtureControl("flow-held-twice");
  await page.goto("/account/flows");
  const card = automationCard(page, "Project automation");
  await expect(
    card.locator("p", { hasText: "Department: general" }),
  ).toBeVisible();
  await expect(card.locator("p", { hasText: "Whole workspace" })).toBeVisible();
  await expect(card.getByRole("link", { name: "Added ✓" })).toHaveCount(1);
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
});

test("Unarchive adds an archived flow afresh by its card's own Add, to the team of its category, and opens its Set up; the row then says Added ✓, going to it (the owner's build 12, #4 and #9; backend ADR-0036; AM4)", async ({
  page,
}) => {
  await page.goto(FLOWS.archivable);
  await page.getByRole("button", { name: "Archive flow" }).click();
  await page
    .getByRole("dialog", { name: "Archive Archivable automation?" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account\/flows$/);

  const card = automationCard(page, "Archivable automation");
  const row = page
    .locator("main li")
    .filter({ hasText: "Archivable automation" });
  await expect(row).toContainText("Whole workspace");
  const unarchive = row.getByRole("button", {
    name: "Unarchive Archivable automation",
  });
  await expect(unarchive).toHaveText("Unarchive");
  await expect(row.getByRole("combobox")).toHaveCount(0);
  await expect(row.getByRole("link", { name: "Added ✓" })).toHaveCount(0);
  await expectNoAxeViolations(page);
  await unarchive.click();
  await expect(page).toHaveURL(
    /\/account\/flows\/a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2\/setup$/u,
  );
  await expect(page.locator("main")).toContainText("Department: Operations");

  await page.goto("/account/flows");
  const added = row.getByRole("link", { name: "Added ✓" });
  await expect(added).toHaveAttribute(
    "href",
    "#flow-a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2",
  );
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(
    card.locator("p", { hasText: "Department: Operations" }),
  ).toBeVisible();
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await added.click();
  await expect(page).toHaveURL(/#flow-a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2$/u);
  await page.reload();
  await expect(row).toContainText("Archived Sep 30, 2026");
  await expect(row.getByRole("link", { name: "Added ✓" })).toBeVisible();
});

test("an Add the platform refuses — a team it could not find or make, or its team service not answering — is said in the spec's words (backend ADR-0036; spec §3.A)", async ({
  page,
}) => {
  for (const refusal of ["add-not-found", "add-team-service-down"]) {
    await fixtureControl(refusal);
    await page.goto("/account/flows");
    const card = automationCard(page, "Project automation");
    await card.getByRole("button", { name: "Add" }).click();
    await expect(card.getByRole("alert")).toHaveText(
      "Could not add this flow. Try again.",
    );
    await expect(card.getByRole("button", { name: "Add" })).toBeVisible();
  }
  expect(await createdTeams()).toEqual([]);
});

test("with no team yet, anyone in the workspace adds a flow and its team is made — no Create a team, no Ask to join (backend ADR-0036; the owner, 2026-10-14)", async ({
  page,
}) => {
  await fixtureControl("org-without-projects");
  await presentSession(page, "member");
  await page.goto("/account/flows");
  const main = page.locator("main");
  for (const gone of [
    "Create a team first.",
    "Create a team",
    "An owner or admin creates the first team.",
    "Ask to join a team first.",
    "See teams",
    "Add to",
    "Pick a team.",
  ]) {
    await expect(main).not.toContainText(gone);
  }
  await expectNoAxeViolations(page);
  const card = automationCard(page, "Project automation");
  await card.getByRole("button", { name: "Add" }).click();
  await expect(page).toHaveURL(/\/setup$/u);
  await expect(page.locator("main")).toContainText("Department: Operations");
});

// Invoice Processing (backend ADR-0036–0038; the spec's §2.1): a flow whose
// QuickBooks is optional, chosen on its vendor page.
const invoiceFlow = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
const vendorPage = `/account/flows/${invoiceFlow}/vendor`;

async function invoiceSettings() {
  return (
    await fixtureRead<{ invoiceConfig: Record<string, unknown> }>("counts")
  ).invoiceConfig;
}

test("Invoice Processing: its card says its category, Included and its team; Add opens Set up — one page: 1 · Connect, its vendors and None; 2 · Settings, the Approval limit, no line under it — and Turn on turns it on and opens its page (the owner's AM4; spec A6)", async ({
  page,
}) => {
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  const card = automationCard(page, "Invoice Processing");
  await expect(card).toContainText("Accounting");
  await expect(card).toContainText("Included");
  await expect(card).not.toContainText(/Version|v3/u);
  await card.getByRole("button", { name: "Add" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}/setup$`, "u"));
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "Set up Invoice Processing", level: 1 }),
  ).toBeVisible();
  await expect(main).toContainText("Department: Accounting");
  await expect(main.getByRole("heading", { level: 3 })).toHaveText([
    "Connect",
    "Settings",
  ]);
  for (const number of ["01", "02"]) {
    await expect(main.getByText(number, { exact: true })).toBeVisible();
  }
  const vendors = main.getByRole("radiogroup", { name: "Integration" });
  await expect(vendors.getByRole("radio")).toHaveCount(2);
  await expect(vendors.getByRole("radio", { name: "None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(
    vendors.getByRole("radio", { name: "QuickBooks Online" }),
  ).toContainText("Not connected");
  await expect(main.getByLabel("Approval limit")).toHaveValue("500");
  // No help line, and no email to give (the owner's AM3).
  for (const gone of [
    "Amounts over this wait for approval.",
    "Where the details go.",
    "Send results to",
    "Also email",
  ]) {
    await expect(main.getByText(gone)).toHaveCount(0);
  }
  await expect(main.getByText("Optional", { exact: true })).toHaveCount(1);
  await expectNoAxeViolations(page);
  await main.getByRole("button", { name: "Turn on" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  await expect(page.getByText(/^live$/iu)).toBeVisible();
  expect(await invoiceSettings()).toEqual({
    vendor: "none",
    holdAboveAmount: 500,
  });
});

test("Connect integration: step 2's integration row opens the step's vendors by their marks, then None; a tap saves once and goes back to the flow — no Done, no Save, no Intuit button — and the row says its state, step 4 its title by the choice (spec A2, A3; Build 22, P1, P2, S21; the owner's build 20 items 2, 4 and 5, build 21 item 5)", async ({
  page,
}) => {
  await fixtureControl("quickbooks-connected");
  await page.goto(FLOWS.invoice);
  const vendorRow = page.getByTestId("flow-vendor-vendor");
  // In step 2, Connect integration (backend ADR-0041's setting step).
  await expect(
    page.getByTestId("flow-step-connect").getByTestId("flow-vendor-vendor"),
  ).toBeVisible();
  const recordTitle = page.getByTestId("flow-step-record").locator("p");
  await expect(recordTitle).toHaveText("4 · Details saved");
  await expect(vendorRow).toContainText("None");
  await expect(vendorRow).toContainText("Save the details only.");
  // Named by its vendor, and its line said too — to a screen reader as well.
  await expect(vendorRow).toHaveAccessibleName("None: change the integration");
  await expect(vendorRow).toHaveAccessibleDescription("Save the details only.");
  await vendorRow.click();
  await expect(page).toHaveURL(
    new RegExp(`${vendorPage}\\?field=vendor$`, "u"),
  );
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "Connect integration", level: 1 }),
  ).toBeVisible();
  await expect(main).toContainText("For Invoice Processing");
  await expect(
    main.getByRole("radiogroup", { name: "Connect integration" }),
  ).toBeVisible();
  await expect(main.getByRole("radio")).toHaveCount(2);
  const quickbooks = main.getByRole("radio", { name: "QuickBooks Online" });
  await expect(quickbooks).toContainText("Connected");
  await expect(quickbooks).toHaveAccessibleDescription("Connected");
  await expect(
    main.getByRole("radio", { name: "None" }),
  ).toHaveAccessibleDescription("Save the details only.");
  await expect(
    quickbooks.getByRole("img", { name: "QuickBooks" }),
  ).toHaveAttribute("src", "/vendors/quickbooks-symbol.png");
  await expect(main.getByRole("radio", { name: "None" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  for (const gone of ["Save", "Done"]) {
    await expect(
      main.getByRole("button", { name: gone, exact: true }),
    ).toHaveCount(0);
  }
  await expect(main.getByRole("button", { name: /Disconnect/u })).toHaveCount(
    0,
  );
  await expect(page.locator('img[src*="connect-to-quickbooks"]')).toHaveCount(
    0,
  );
  await expectNoAxeViolations(page);
  // One tap: chosen, saved — the other settings as they were — and back.
  const saves = async () =>
    (await fixtureRead<{ invoiceSaves: unknown[] }>("counts")).invoiceSaves
      .length;
  const before = await saves();
  await quickbooks.click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  expect(await invoiceSettings()).toEqual({
    vendor: "quickbooks",
    holdAboveAmount: 500,
  });
  expect(await saves()).toBe(before + 1);
  // The integration row says its state — never "Connect vendor" — and step 4
  // is QuickBooks updated (D3, the session's suggestion the owner approved).
  await expect(vendorRow).toContainText("QuickBooks Online");
  await expect(vendorRow).toContainText("Connected");
  await expect(vendorRow).toHaveAccessibleDescription("Connected");
  await expect(recordTitle).toHaveText("4 · QuickBooks updated");
  await expect(page.locator("main")).not.toContainText("Connect vendor");
  // None, tapped: saved once, and back.
  await vendorRow.click();
  await main.getByRole("radio", { name: "None" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  expect(await invoiceSettings()).toEqual({
    vendor: "none",
    holdAboveAmount: 500,
  });
  expect(await saves()).toBe(before + 2);
  await expect(recordTitle).toHaveText("4 · Details saved");
});

test("a member on the Connect integration page sees the integration and never changes it: no row is a choice, None too, and the list says who can (spec A2; Build 23's B3)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(`${vendorPage}?field=vendor`);
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "Connect integration", level: 1 }),
  ).toBeVisible();
  const quickbooks = main.getByRole("radio", { name: "QuickBooks Online" });
  await expect(quickbooks).toContainText(
    "Ask an owner or admin to connect it.",
  );
  // Said to a screen reader too: why the row is no choice.
  await expect(quickbooks).toHaveAccessibleDescription(
    "Ask an owner or admin to connect it.",
  );
  await expect(quickbooks).toBeDisabled();
  await expect(main.getByRole("button", { name: /Connect/u })).toHaveCount(0);
  const none = main.getByRole("radio", { name: "None" });
  await expect(none).toHaveAttribute("aria-checked", "true");
  await expect(none).toBeDisabled();
  await expect(none).toHaveAttribute("aria-disabled", "true");
  await expect(main.getByTestId("vendor-member-note")).toHaveText(
    "Only an owner or admin can change the integration.",
  );
});

test("a change of the integration the platform refuses as a member's (403 integration_requires_admin) says who can, saves nothing and stays on the page (Build 23's B3)", async ({
  page,
}) => {
  await fixtureControl("quickbooks-connected");
  await fixtureControl("vendor-change-refused");
  const saves = async () =>
    (await fixtureRead<{ invoiceSaves: unknown[] }>("counts")).invoiceSaves
      .length;
  const before = await saves();
  await page.goto(`${vendorPage}?field=vendor`);
  const main = page.locator("main");
  await main.getByRole("radio", { name: "QuickBooks Online" }).click();
  await expect(main.getByRole("alert")).toHaveText(
    "Only an owner or admin can change the integration.",
  );
  await expect(page).toHaveURL(
    new RegExp(`${vendorPage}\\?field=vendor$`, "u"),
  );
  expect(await saves()).toBe(before);
  expect(await invoiceSettings()).toEqual({
    vendor: "none",
    holdAboveAmount: 500,
  });
});

// Build 22 (spec §4, P1 and P5; the owner's build 21 item 5: "When i select
// this step it should take me to the page where i can edit in a screen the
// email it should send to"): Who gets the email, a flow's run emails. The
// workspace's owners and admins and the person who starts the run always get
// it (D1, the session's suggestion the owner approved); an owner or admin
// adds more. Reserved example addresses only.
const emailPage = `${FLOWS.invoice}/email`;
async function emailSaves() {
  return (await fixtureRead<{ emailSaves: string[][] }>("counts")).emailSaves;
}

test("step 5 opens Who gets the email: Always — the owner, the admin, the person who starts the run — then Also send to; an owner adds an address with one save, the list shown, and the flow page counts it (P1, P5; D1; S22, S30)", async ({
  page,
}) => {
  await page.goto(FLOWS.invoice);
  await page.getByTestId("flow-email").click();
  await expect(page).toHaveURL(new RegExp(`${emailPage}$`, "u"));
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Who gets the email",
  );
  await expect(main).toContainText("For Invoice Processing");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText([
    "Always",
    "Also send to",
  ]);
  const always = main.getByTestId("email-always");
  await expect(always.locator("[data-connection-row]")).toHaveText([
    "owner@example.testOwner",
    "admin@example.testAdmin",
    "The person who starts the run",
  ]);
  const also = main.getByTestId("email-also");
  await expect(also.locator("[data-connection-row]")).toHaveText([
    "ap@example.com",
  ]);
  await expect(
    also.getByRole("button", { name: "Remove ap@example.com" }),
  ).toBeVisible();
  const field = also.getByRole("textbox", { name: "Email address" });
  await expect(field).toHaveAttribute("placeholder", "Email address");
  await expect(field).toHaveAttribute("type", "email");
  await expect(field).toHaveAttribute("autocapitalize", "none");
  await expectNoAxeViolations(page);
  await field.fill("bookkeeper@example.com");
  await also.getByRole("button", { name: "Add" }).click();
  await expect(
    also.getByTestId("email-extra-bookkeeper@example.com"),
  ).toBeVisible();
  await expect(field).toHaveValue("");
  expect(await emailSaves()).toEqual([
    ["ap@example.com", "bookkeeper@example.com"],
  ]);
  // Back on the flow page, step 5 counts it.
  await page.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  await expect(page.getByTestId("flow-email")).toContainText("and 3 more");
});

test("Add checks the address first: not one, Enter an email address.; already on the list without case — a person always told or an extra — Already on the list.; nothing is sent (S30)", async ({
  page,
}) => {
  await page.goto(emailPage);
  const also = page.getByTestId("email-also");
  const field = also.getByRole("textbox", { name: "Email address" });
  const add = also.getByRole("button", { name: "Add" });
  for (const [typed, words] of [
    ["bookkeeper", "Enter an email address."],
    ["a b@example.com", "Enter an email address."],
    ["Owner@Example.TEST", "Already on the list."],
    [" AP@example.com ", "Already on the list."],
  ] as const) {
    await field.fill(typed);
    await add.click();
    await expect(also.getByRole("alert")).toHaveText(words);
    // Typing clears the line (the app's M8).
    await field.fill("");
    await expect(also.getByRole("alert")).toHaveCount(0);
  }
  expect(await emailSaves()).toEqual([]);
});

test("a remove saves the list without it at once — no question — its row saying Removing… while one write waits; and at none, the list says None (S30)", async ({
  page,
}) => {
  await page.goto(emailPage);
  const also = page.getByTestId("email-also");
  const remove = also.getByRole("button", { name: "Remove ap@example.com" });
  const put = await holdRequest(page, `**${emailPage}`, isServerAction);
  await remove.click();
  await put.arrived;
  await expect(also.getByTestId("email-extra-ap@example.com")).toContainText(
    "Removing…",
  );
  // One write at a time.
  await expect(remove).toBeDisabled();
  await expect(also.getByRole("button", { name: "Add" })).toBeDisabled();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  put.release();
  await expect(also.getByTestId("email-extra-none")).toHaveText("None");
  await expect(also.getByTestId("email-extra-ap@example.com")).toHaveCount(0);
  expect(await emailSaves()).toEqual([[]]);
});

test("a save the platform refuses or fails says Could not save. Try again. under the section, and the list stays as it was (S30)", async ({
  page,
}) => {
  await fixtureControl("email-recipients-refusing");
  await page.goto(emailPage);
  const also = page.getByTestId("email-also");
  await also
    .getByRole("textbox", { name: "Email address" })
    .fill("bookkeeper@example.com");
  await also.getByRole("button", { name: "Add" }).click();
  await expect(also.getByRole("alert")).toHaveText(
    "Could not save. Try again.",
  );
  await expect(also.locator("[data-connection-row]")).toHaveText([
    "ap@example.com",
  ]);
  await also.getByRole("button", { name: "Remove ap@example.com" }).click();
  await expect(also.getByRole("alert")).toHaveText(
    "Could not save. Try again.",
  );
  await expect(also.locator("[data-connection-row]")).toHaveText([
    "ap@example.com",
  ]);
  expect(await emailSaves()).toEqual([]);
});

test("by keyboard, an add and a remove each hand focus back to the address field — never dropped with the button or the row they took — and the tenth add, where the field gives way, to Also send to's heading (the Build 22 review)", async ({
  page,
}) => {
  await page.goto(emailPage);
  const also = page.getByTestId("email-also");
  const field = also.getByRole("textbox", { name: "Email address" });
  await field.fill("bookkeeper@example.com");
  await field.press("Enter");
  await expect(
    also.getByTestId("email-extra-bookkeeper@example.com"),
  ).toBeVisible();
  await expect(field).toHaveValue("");
  await expect(field).toBeFocused();
  const remove = also.getByRole("button", { name: "Remove ap@example.com" });
  await remove.focus();
  await remove.press("Enter");
  await expect(also.getByTestId("email-extra-ap@example.com")).toHaveCount(0);
  await expect(field).toBeFocused();
  expect(await emailSaves()).toEqual([
    ["ap@example.com", "bookkeeper@example.com"],
    ["bookkeeper@example.com"],
  ]);
  // From ten, a remove gives the field back, and the add that fills the list
  // again leaves no field: focus goes to the section's heading.
  await fixtureControl("email-recipients-full");
  await page.reload();
  const tenth = also.getByRole("button", {
    name: "Remove person10@example.com",
  });
  await tenth.focus();
  await tenth.press("Enter");
  await expect(field).toBeFocused();
  await field.fill("person10@example.com");
  await field.press("Enter");
  await expect(also.getByTestId("email-limit")).toBeVisible();
  await expect(
    also.getByRole("heading", { name: "Also send to" }),
  ).toBeFocused();
});

test("at ten extra addresses the field gives way to You can add up to 10. (S13)", async ({
  page,
}) => {
  await fixtureControl("email-recipients-full");
  await page.goto(emailPage);
  const also = page.getByTestId("email-also");
  await expect(also.locator("[data-connection-row]")).toHaveCount(10);
  await expect(also.getByTestId("email-limit")).toHaveText(
    "You can add up to 10.",
  );
  await expect(also.getByRole("textbox")).toHaveCount(0);
  await expect(also.getByRole("button", { name: "Add" })).toHaveCount(0);
  // Each can still be removed.
  await expect(
    also.getByRole("button", { name: /^Remove person\d+@example\.com$/u }),
  ).toHaveCount(10);
});

test("a member sees who gets the email and Ask an owner or admin to change this. — no remove, no field (S12)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(emailPage);
  const main = page.locator("main");
  await expect(main.getByTestId("email-always")).toContainText(
    "owner@example.test",
  );
  const also = main.getByTestId("email-also");
  await expect(also).toContainText("ap@example.com");
  await expect(also.getByTestId("email-ask-admin")).toHaveText(
    "Ask an owner or admin to change this.",
  );
  await expect(also.getByRole("button")).toHaveCount(0);
  await expect(also.getByRole("textbox")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("a vendor not connected, tapped by an owner, goes to its sign-in and back — chosen, saved and back to the flow from that one tap; Connections then says it, with our Disconnect, asked first (spec A2, A4)", async ({
  page,
}) => {
  await page.goto(`${vendorPage}?field=vendor`);
  await page
    .locator("main")
    .getByRole("radio", { name: "QuickBooks Online" })
    .click();
  // Through the platform's callback landing, Connections and the vendor
  // page, back to the flow.
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  expect(await invoiceSettings()).toEqual({
    vendor: "quickbooks",
    holdAboveAmount: 500,
  });
  await expect(page.getByTestId("flow-vendor-vendor")).toContainText(
    "Connected",
  );
  // Step 4 says where the details went; no Connections on the page (P3).
  await expect(page.getByTestId("flow-step-record").locator("p")).toHaveText(
    "4 · QuickBooks updated",
  );
  await expect(connectionRow(page, "quickbooks")).toHaveCount(0);

  await page.goto("/account/connections");
  const row = connectionRow(page, "quickbooks");
  await expect(row).toContainText("Connected");
  const disconnect = row.getByRole("button", {
    name: "Disconnect QuickBooks Online",
  });
  await expect(disconnect).toHaveText("Disconnect");
  await expectNoAxeViolations(page);
  // Disconnect is asked first, saying what it stops — and Cancel keeps it.
  await disconnect.click();
  const confirm = page.getByRole("dialog", {
    name: "Disconnect QuickBooks Online?",
  });
  await expect(confirm).toHaveAccessibleDescription(
    "1 live flow uses it. It stops until you connect it again.",
  );
  await expect(
    confirm.getByRole("button", { name: "Disconnect", exact: true }),
  ).toHaveClass(/btn-danger/u);
  await expectNoAxeViolations(page);
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(disconnect).toBeVisible();
  expect(await invoiceSettings()).toEqual({
    vendor: "quickbooks",
    holdAboveAmount: 500,
  });
});

test("a vendor chosen and not connected is said in Step 1, going to its vendor page, and Turn on waits; Set up says Not connected (spec A3, A6)", async ({
  page,
}) => {
  await fixtureControl("quickbooks-connected");
  await fixtureControl("invoice-paused");
  // Chosen while connected, then disconnected on Connections.
  await page.goto(`${vendorPage}?field=vendor`);
  await page
    .locator("main")
    .getByRole("radio", { name: "QuickBooks Online" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  await page.goto("/account/connections");
  await connectionRow(page, "quickbooks")
    .getByRole("button", { name: "Disconnect QuickBooks Online" })
    .click();
  await page
    .getByRole("dialog", { name: "Disconnect QuickBooks Online?" })
    .getByRole("button", { name: "Disconnect", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(connectionRow(page, "quickbooks")).toContainText(
    "Not connected",
  );

  await page.goto(FLOWS.invoice);
  const vendorRow = page.getByTestId("flow-vendor-vendor");
  await expect(vendorRow).toContainText("QuickBooks Online");
  await expect(vendorRow).toContainText("Not connected");
  await expect(
    page.getByRole("link", {
      name: "Connect QuickBooks Online first, or choose None.",
    }),
  ).toHaveAttribute("href", `${vendorPage}?field=vendor`);
  await expect(
    runForm(page).getByRole("button", { name: "Turn on" }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Edit setup" }).click();
  const radio = page
    .locator("main")
    .getByRole("radio", { name: "QuickBooks Online" });
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await expect(radio).toContainText("Not connected");
});

test("a flow still on v1, whose QuickBooks the catalog's newer version makes optional, is sent to Connections from Step 1: its own version has no vendor to choose, so no vendor row and no vendor page — and no move offered (spec A6; Build 22, P4)", async ({
  page,
}) => {
  await fixtureControl("invoice-v1");
  await page.goto(FLOWS.invoice);
  await expect(
    page.getByRole("link", { name: "Connect QuickBooks Online first." }),
  ).toHaveAttribute("href", "/account/connections");
  await expect(page.getByText(/or choose None/u)).toHaveCount(0);
  await expect(page.getByTestId("flow-vendor-vendor")).toHaveCount(0);
  await expect(page.locator(`a[href^="${vendorPage}"]`)).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(
    /Move to v|is available/u,
  );
  // Its vendor page is the same "not found" any other id is.
  const response = await page.goto(`${vendorPage}?field=vendor`);
  expect(response?.status()).toBe(404);
});

test("a finished run of three receipts: its full id, every step done, each receipt on its own card — seller, place, numbers, lines, totals — and the package's buttons, no Download JSON (spec A7, A8; the owner's ~04:05Z and AM7; Build 24's P12)", async ({
  page,
}) => {
  await page.goto("/account/runs/fixture-run-invoice");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Run fixture-run-invoice",
  );
  await expect(main).toContainText("Invoice Processing");
  await expect(main).not.toContainText("fixture-invoice ");
  await expect(main.getByTestId("run-result")).toHaveText(
    "3 receipts: 3 saved.",
  );
  await expect(main.getByTestId("run-tile-Duration")).toHaveText("19s");
  await expect(main.getByTestId("run-tile-Steps done")).toHaveText("5 / 5");
  // A v3 run, drawn by v4's five steps — every step it reported v4 still
  // declares (Build 22, S25): the integration the flow chose now, None (S23),
  // and its email, sent (S24; Build 23's A7).
  const steps = main.getByTestId("run-steps").locator("li");
  await expect(steps.locator("p.font-medium")).toHaveText([
    "1 · Upload invoice",
    "2 · Connect integration",
    "3 · AI processing",
    "4 · Details saved",
    "5 · Email sent",
  ]);
  await expect(steps.locator("p:not(.font-medium)")).toHaveText([
    "Done · 12:00 PM",
    "None",
    "Done · 12:02 PM",
    "Done · 12:04 PM",
    "Email sent · 12:00 PM",
  ]);
  // Never a step's own words, never its id (B6).
  for (const gone of [
    "Photo, 1 page",
    "Totals checked",
    "check-documents",
    "save-documents",
    "Progress",
  ]) {
    await expect(main).not.toContainText(gone);
  }
  // Each a closed row that opens in place (Build 24, P10): "Invoice n of 3",
  // its chip and {vendor} · {total} (S9); open, it starts with its Document
  // type and Format — the job's one photo, JPEG. Each opens on its own.
  const cards = main.locator("details[data-testid^='document-']");
  await expect(cards).toHaveCount(3);
  for (const card of await cards.all())
    await expect(card).not.toHaveAttribute("open");
  await expect(cards.nth(0).locator("summary")).toContainText("Invoice 1 of 3");
  await expect(main.getByTestId("document-1-glance")).toHaveText(
    "Lowe's · $17.19",
  );
  await expect(main.getByTestId("document-1-chip")).toHaveText("Saved");
  await expect(main.getByTestId("document-2-line-1")).toBeHidden();
  await cards.nth(1).locator("summary").click();
  await expect(cards.nth(1)).toHaveAttribute("open");
  await expect(cards.nth(0)).not.toHaveAttribute("open");
  await expect(cards.nth(2)).not.toHaveAttribute("open");
  await expect(main.getByTestId("document-2-line-1")).toBeVisible();
  await expect(main.getByTestId("document-1-line-1")).toBeHidden();
  await expect(cards.nth(1)).toContainText("Document typeReceipt");
  await expect(cards.nth(1)).toContainText("FormatJPEG");
  for (const words of [
    "Receipt · Lowe's",
    "2150 W Shaw Ave, Fresno, CA 93711 · Store 1234",
    "Oct 14, 2026 · 2:32 PM",
    "Receipt #48291",
    "Register07",
    "2X4-8 STUD",
    "4 × $3.98",
    "Subtotal$15.92",
    "Tax$1.27",
    "Total$17.19",
    "PaidCard ending 4417",
    "ResultSaved",
    "CategoryMaterials",
  ]) {
    await expect(cards.nth(0)).toContainText(words);
  }
  for (const words of [
    "Receipt · The Home Depot",
    "More lines on the document.",
    "Discount−$2.00",
    "PaidCash",
  ]) {
    await expect(cards.nth(1)).toContainText(words);
  }
  for (const words of [
    "Receipt · Shell",
    "Clovis, CA",
    "Oct 14, 2026 · 7:05 AM",
    "Auth code559301",
  ]) {
    await expect(cards.nth(2)).toContainText(words);
  }
  // Documents, so no Details; the facts end with the full Run ID.
  await expect(
    main.getByRole("heading", { name: "Details", exact: true }),
  ).toHaveCount(0);
  await expect(main.getByTestId("run-fact-Run ID")).toHaveText(
    "fixture-run-invoice",
  );
  await expect(main.getByRole("link", { name: "View flow" })).toHaveAttribute(
    "href",
    FLOWS.invoice,
  );
  await expectNoAxeViolations(page);
  // The package's three (Build 24, P12; their own test is in
  // account-surfaces.spec.ts): ~~Download JSON~~ until Build 24.
  await expect(main.getByRole("link", { name: "View package" })).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Download PDF" }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: "Download Excel" }),
  ).toBeVisible();
  await expect(main.getByRole("button", { name: "Download JSON" })).toHaveCount(
    0,
  );
});

test("a run is named by its full id, never its request id; a run of an older version is drawn by what it reported — never '34 accounts read' — its failure on its last step (spec A7, A8; run 793eef82 as it ran)", async ({
  page,
}) => {
  await page.goto("/account/runs/793eef82-102d-81be-a2d3-9e8d4e2b2c36");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Run 793eef82-102d-81be-a2d3-9e8d4e2b2c36",
  );
  await expect(main).not.toContainText("1e3231c6");
  await expect(main.getByTestId("run-result")).toHaveText(
    "Add one document per file.",
  );
  await expect(main).not.toContainText("34 accounts read");
  const steps = main.getByTestId("run-steps").locator("li");
  await expect(steps).toHaveCount(6);
  await expect(steps.last()).toHaveAttribute("data-state", "failed");
  await expect(steps.last()).toContainText("Add one document per file.");
  // Activity names it by its full id too.
  await page.goto(
    "/account/runs?flow=f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1&status=failed",
  );
  await expect(main).toContainText("Invoice Processing · Failures");
  await expect(main).toContainText("Run 793eef82-102d-81be-a2d3-9e8d4e2b2c36");
  await expect(main).not.toContainText("v2");
});

test("on a phone, a run's page is no wider than the screen: its title, the full id, wraps at its hyphens — even an id whose every part starts with a digit (spec A8; the owner's AM2)", async ({
  page,
}) => {
  // Any run id is a run here. The title is the whole id (AM2); a browser
  // breaks it after a hyphen, so it never pushes the page sideways.
  const id = "3f2c1a9e-5b7d-4e2a-9c1b-7d8e9f0a1b2c";
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`/account/runs/${id}`);
  const title = page.locator("main").getByRole("heading", { level: 1 });
  await expect(title).toHaveText(`Run ${id}`);
  // The heading holds its words, and the page scrolls no way but down.
  expect(
    await title.evaluate(
      (heading) => heading.scrollWidth - heading.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
});

test("a held run's document whose approval was refused reads Not approved, and the run its decision; the group it waited in says Denied (spec A7; S21; Build 24's P6, S6)", async ({
  page,
}) => {
  await page.goto("/account/runs/fixture-run-invoice-held");
  const main = page.locator("main");
  await expect(main.getByTestId("run-result")).toHaveText("Denied.");
  await expect(main.getByTestId("document-1-chip")).toHaveText("Saved");
  await expect(main.getByTestId("document-2-chip")).toHaveText("Not approved");
  const record = main.getByTestId("run-step-group:record");
  await expect(record).toHaveAttribute("data-state", "held");
  await expect(record).toContainText("Denied");
  await expect(record).not.toContainText("Waiting for approval");
  // Each document's Format is its own file's (Invoice Processing v6's
  // `source`; Build 24, P10).
  await expect(main.getByTestId("document-1")).toContainText("FormatPDF");
  await expect(main.getByTestId("document-2")).toContainText("FormatPNG");
  // Step 5 waits: the approval's email never checks it (Build 23's A7).
  const email = main.getByTestId("run-step-group:email");
  await expect(email).toHaveAttribute("data-state", "waiting");
  await expect(email).toContainText("Waiting");
  await expect(main.getByTestId("run-tile-Steps done")).toHaveText("3 / 5");
});

test("a run still going, of a flow with no groups, is drawn by what it reported and a last row saying it is working — never a step id", async ({
  page,
}) => {
  await page.goto("/account/runs/fixture-run-running");
  const main = page.locator("main");
  const steps = main.getByTestId("run-steps").locator("li");
  await expect(steps.last()).toContainText("Working…");
  await expect(main).not.toContainText("validate-input");
  await expect(
    main.getByRole("heading", { name: "Details", exact: true }),
  ).toHaveCount(0);
});

test.describe("Invoice Processing's page, Step 1 to its run (spec A6, A7; Build 22, P1–P4)", () => {
  // The browser PUTs the file straight to the fixture's object store.
  test.use({ ignoreHTTPSErrors: true });

  test("the page reads top to bottom — Dashboard, then Steps exactly 1 · Upload invoice with the Document and Start run, 2 · Connect integration with the integration row, 3 · AI processing, 4 · Details saved with nothing under it, 5 · Email sent with who gets it — Edit setup; no Connections, no move — and the run's page shows the five steps from the start, each as it is done, its email, and its documents when it ends", async ({
    page,
  }) => {
    await page.goto(FLOWS.invoice);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { level: 1 })).toHaveText(
      "Invoice Processing",
    );
    await expect(main).toContainText("Department: Accounting");
    // No Connections section (P3).
    await expect(main.getByRole("heading", { level: 2 })).toHaveText([
      "Dashboard",
      "Steps",
    ]);
    await expect(main).not.toContainText("Connections");
    await expect(main).not.toContainText(/Move to v|is available/u);
    // No description under the name (S24), and no help line anywhere.
    await expect(main).not.toContainText(
      "Reads bills and receipts, then saves",
    );
    await expect(main).not.toContainText(
      "A PDF or photo of bills or receipts.",
    );
    const steps = main.locator('[data-testid^="flow-step-"]');
    await expect(steps.locator("> p.font-medium")).toHaveText([
      "1 · Upload invoice",
      "2 · Connect integration",
      "3 · AI processing",
      "4 · Details saved",
      "5 · Email sent",
    ]);
    // Titles only (S20): no step's description, no setting's.
    for (const gone of [
      "Add a PDF or photo.",
      "QuickBooks, or None.",
      "AI reads and checks each document.",
      "Saved, or recorded in QuickBooks.",
      "The results are emailed.",
      "Approval limit",
    ]) {
      await expect(main).not.toContainText(gone);
    }
    // Nothing between step 4's title and step 5 (P2).
    await expect(steps.nth(3)).toHaveText("4 · Details saved");
    const form = steps.nth(0).getByTestId("run-form");
    await expect(form).toContainText("Document");
    await expect(form).not.toContainText("(optional)");
    await expect(
      form.getByRole("button", { name: "Upload for Document" }),
    ).toBeVisible();
    await expect(steps.nth(1).getByTestId("flow-vendor-vendor")).toContainText(
      "None",
    );
    // Step 5: the first address and how many more (S22), to who gets it.
    const email = steps.nth(4).getByTestId("flow-email");
    await expect(email).toContainText("owner@example.test");
    await expect(email).toContainText("and 2 more");
    await expect(email).toHaveAttribute("href", `${FLOWS.invoice}/email`);
    await expect(
      main.getByRole("link", { name: "Edit setup" }),
    ).toHaveAttribute("href", `${FLOWS.invoice}/setup`);
    await expectNoAxeViolations(page);
    await form.getByLabel("Document").setInputFiles(invoicePdf);
    await expect(form.getByText("Ready: invoice.pdf (24 bytes)")).toBeVisible();
    await form.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(
      /\/account\/runs\/fixture-run-invoice-started$/,
    );
    // Every step from the start: the first working, the integration done from
    // the start (S23), the rest waiting — the email too, while the run goes on.
    const rows = main.getByTestId("run-steps").locator("li");
    await expect(rows).toHaveCount(5);
    await expect(rows.locator("p.font-medium")).toHaveText([
      "1 · Upload invoice",
      "2 · Connect integration",
      "3 · AI processing",
      "4 · Details saved",
      "5 · Email sent",
    ]);
    await expect(rows.nth(0)).toHaveAttribute("data-state", "working");
    // The running step's icon spins; no other row's does (Build 23's A4).
    await expect(rows.nth(0).locator("svg")).toHaveClass(/animate-spin/u);
    await expect(rows.locator("svg.motion-safe\\:animate-spin")).toHaveCount(1);
    await expect(rows.nth(1)).toHaveAttribute("data-state", "done");
    await expect(rows.nth(1)).toContainText("None");
    for (const n of [2, 3, 4]) {
      await expect(rows.nth(n)).toHaveAttribute("data-state", "waiting");
    }
    await expect(rows.nth(4)).toContainText("Waiting");
    await expect(main.getByTestId("run-tile-Steps done")).toHaveText("1 / 5");
    await expect(
      main.getByRole("button", { name: "Cancel run" }),
    ).toBeVisible();
    // Read again while it goes on: its first step done, the next working.
    await fixtureControl("invoice-run-advance");
    await expect(rows.nth(0)).toHaveAttribute("data-state", "done");
    await expect(rows.nth(2)).toHaveAttribute("data-state", "working");
    await expect(main.getByTestId("run-tile-Steps done")).toHaveText("2 / 5");
    // Ended: every step done — step 5 with its email on its way (Build 23's
    // A7) — its three receipts, and nothing to cancel.
    await fixtureControl("invoice-run-advance");
    await expect(main.getByText(/^succeeded$/iu)).toBeVisible();
    await expect(rows.nth(4)).toHaveAttribute("data-state", "done");
    await expect(rows.nth(4)).toContainText("Sending email…");
    await expect(main.getByTestId("run-tile-Steps done")).toHaveText("5 / 5");
    await expect(main.locator("details[data-testid^='document-']")).toHaveCount(
      3,
    );
    await expect(main.getByRole("button", { name: "Cancel run" })).toHaveCount(
      0,
    );
    await expect(
      main.getByRole("button", { name: "Download PDF" }),
    ).toBeVisible();
    // Its email sent: read again, Email sent and when, every step done.
    await fixtureControl("invoice-run-advance");
    await page.reload();
    await expect(rows.nth(4)).toHaveAttribute("data-state", "done");
    await expect(rows.nth(4)).toContainText("Email sent · 12:02 PM");
    await expect(main.getByTestId("run-tile-Steps done")).toHaveText("5 / 5");
  });

  test("the Dashboard is live: a run of the flow ending changes its tiles without leaving the page, and a tile opens Activity for the flow and that outcome (spec A6; S30)", async ({
    page,
  }) => {
    await fixtureControl("invoice-run-started");
    await page.goto(FLOWS.invoice);
    await expect(page.getByTestId("flow-stat-Runs")).toHaveText("4");
    await expect(page.getByTestId("flow-stat-Successes")).toHaveText("1");
    await expect(page.getByTestId("flow-stat-Failures")).toHaveText("1");
    await fixtureControl("invoice-run-advance");
    await fixtureControl("invoice-run-advance");
    await expect(page.getByTestId("flow-stat-Successes")).toHaveText("2", {
      timeout: 15_000,
    });
    await page.getByTestId("flow-stat-Successes").click();
    await expect(page).toHaveURL(
      /\/account\/runs\?flow=f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1&status=succeeded$/u,
    );
    const main = page.locator("main");
    await expect(main).toContainText("Invoice Processing · Successes");
    await expect(
      main.getByRole("link", { name: "Run of Invoice Processing, succeeded" }),
    ).toHaveCount(2);
    await expect(main).toContainText("Run fixture-run-invoice-started");
  });

  test("with QuickBooks chosen, step 4 is QuickBooks updated on the flow's page and on its run's, and the run's step 2 says QuickBooks Online (D3; S23)", async ({
    page,
  }) => {
    await fixtureControl("quickbooks-connected");
    await page.goto(`${vendorPage}?field=vendor`);
    await page
      .locator("main")
      .getByRole("radio", { name: "QuickBooks Online" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
    const main = page.locator("main");
    await expect(
      main.locator('[data-testid^="flow-step-"] > p.font-medium'),
    ).toHaveText([
      "1 · Upload invoice",
      "2 · Connect integration",
      "3 · AI processing",
      "4 · QuickBooks updated",
      "5 · Email sent",
    ]);
    await fixtureControl("invoice-run-started");
    await fixtureControl("invoice-run-advance");
    await page.goto("/account/runs/fixture-run-invoice-started");
    const rows = main.getByTestId("run-steps").locator("li");
    await expect(rows.locator("p:not(.font-medium)")).toHaveText([
      "Done · 12:00 PM",
      "QuickBooks Online",
      "Working…",
      "Waiting",
      "Waiting",
    ]);
    await expect(rows.nth(3).locator("p.font-medium")).toHaveText(
      "4 · QuickBooks updated",
    );
  });

  test("step 5 whose addresses cannot be read says Unavailable, and still opens who gets the email (S22)", async ({
    page,
  }) => {
    await fixtureControl("email-recipients-failing");
    await page.goto(FLOWS.invoice);
    const email = page.getByTestId("flow-email");
    await expect(email).toHaveText("Unavailable");
    // The rest of the page still shows.
    await expect(runForm(page)).toBeVisible();
    await expect(email).toHaveAttribute("href", `${FLOWS.invoice}/email`);
  });
});

test("a catalog with nothing to add is the app's empty screen — No flows to add yet — not a line in the section (the owner's build 10)", async ({
  page,
}) => {
  await fixtureControl("catalog-empty");
  await page.goto("/account/flows");
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "No flows to add yet" }),
  ).toBeVisible();
  await expect(main.getByText("More are on the way.")).toBeVisible();
  await expect(main.getByText("No flows are available yet.")).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expectNoAxeViolations(page);
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
  await page.goto("/account/flows");
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
    await page.goto("/account/flows");
    await expect(page).toHaveURL(/\/account\/flows$/);
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

test("a figure the platform cannot answer reads Unavailable — once, in Today's tiles' place, as the app's TODAY says it, and within a phone's width — and the rest of the dashboard still shows (D5; the Build 22 review)", async ({
  page,
}) => {
  await fixtureControl("run-stats-failing");
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/account");
  const unavailable = page.getByTestId("home-stats-unavailable");
  await expect(unavailable).toHaveText("Unavailable");
  await expect(page.getByTestId("home-stats")).toHaveCount(0);
  await expect(page.getByText("Unavailable", { exact: true })).toHaveCount(1);
  expect(
    await unavailable.evaluate((line) => line.scrollWidth - line.clientWidth),
  ).toBe(0);
  await expect(page.getByTestId("home-quick-actions")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Run of Manual input automation, running" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /The platform (is busy|could not answer)/,
    }),
  ).toHaveCount(0);
});

test("Cancel on a run whose workspace was switched away in another tab says so, and cancels nothing", async ({
  page,
  context,
}) => {
  await page.goto("/account/runs/fixture-run-running");
  const other = await context.newPage();
  try {
    await other.goto("/account");
    const trigger = other.getByRole("button", { name: "Switch workspace" });
    await trigger.click();
    await other.getByRole("button", { name: /Fixture Personal/ }).click();
    await expect(trigger).toContainText("Fixture Personal");
  } finally {
    await other.close();
  }
  await page.getByRole("button", { name: "Cancel run" }).click();
  const dialog = page.getByRole("dialog", { name: "Cancel this run?" });
  await dialog.getByRole("button", { name: "Cancel run" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The active workspace changed in another tab. Reload this page before continuing.",
  );
  await expect(page.locator("main").getByText(/^running$/i)).toBeVisible();
});

test("the dashboard reads top to bottom — Today's three tiles, Add a flow and Flows, Recent runs and See all — with no Run a flow, Quick actions, Workspace overview, Get started, View teams or Connect integration (Build 22, W1; the owner's build 21 item 1; D4, D5)", async ({
  page,
}) => {
  const runStats = observe(page, (request) =>
    request.url().includes("/run-stats"),
  );
  await page.goto("/account");
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Welcome, Fixture!",
  );
  await expect(main.getByRole("heading", { level: 2 })).toHaveText([
    "Today",
    "Recent runs",
  ]);
  const at = async (locator: ReturnType<Page["locator"]>) =>
    (await locator.boundingBox())?.y ?? Number.NaN;
  const order = [
    await at(main.getByTestId("home-stats")),
    await at(main.getByTestId("home-quick-actions")),
    await at(main.getByTestId("home-recent-runs")),
  ];
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  for (const gone of [
    "Run a flow",
    "Quick actions",
    "Workspace overview",
    "Get started",
    "View teams",
    "Connect integration",
    "Browse flows",
    "Runs this month",
  ]) {
    await expect(main).not.toContainText(gone);
  }
  // Nothing waits: no banner (the owner, build 13 #3).
  await expect(main.getByTestId("home-approvals")).toHaveCount(0);
  // Add a flow and Flows, both to Flows.
  const actions = main.getByTestId("home-quick-actions").getByRole("link");
  await expect(actions).toHaveText(["Add a flow", "Flows"]);
  for (const link of await actions.all())
    await expect(link).toHaveAttribute("href", "/account/flows");
  // Today: the platform's tally from the browser's midnight, each tile to
  // Activity from it (S27).
  const since = await page.evaluate(() => {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    return midnight.toISOString();
  });
  await expect(main.getByTestId("today-stat-Runs")).toHaveText("3");
  await expect(main.getByTestId("today-stat-Successes")).toHaveText("1");
  await expect(main.getByTestId("today-stat-Failures")).toHaveText("1");
  expect(
    runStats.some((url) =>
      url.endsWith(`/run-stats?since=${encodeURIComponent(since)}`),
    ),
  ).toBe(true);
  const sinceQuery = `since=${encodeURIComponent(since)}`;
  await expect(main.getByTestId("today-Runs")).toHaveAttribute(
    "href",
    `/account/runs?${sinceQuery}`,
  );
  await expect(main.getByTestId("today-Successes")).toHaveAttribute(
    "href",
    `/account/runs?status=succeeded&${sinceQuery}`,
  );
  await expect(main.getByTestId("today-Failures")).toHaveAttribute(
    "href",
    `/account/runs?status=failed&${sinceQuery}`,
  );
  // Recent runs: each its flow, its status and the run by its full id (A8).
  const recent = main.getByTestId("home-recent-runs");
  await expect(
    recent.getByRole("link", {
      name: "Run of Manual input automation, running",
    }),
  ).toBeVisible();
  await expect(recent).toContainText("Run fixture-run-running");
  await expect(main).not.toContainText("fixture-manual-input");
  await expect(recent.getByRole("link", { name: "See all" })).toHaveAttribute(
    "href",
    "/account/runs",
  );
  await expectNoAxeViolations(page);
});

test("the dashboard's approvals banner, right after Today, while something waits — in the app's words, to Approvals (D6)", async ({
  page,
}) => {
  await fixtureControl("approval-waiting");
  await page.goto("/account");
  const main = page.locator("main");
  const banner = main.getByTestId("home-approvals");
  await expect(banner).toContainText("1 item needs your review");
  await expect(banner).toContainText(
    "Exceptions your agents held for judgment",
  );
  await expect(banner).toHaveAttribute("href", "/account/approvals");
  const today = (await main.getByTestId("home-stats").boundingBox())!.y;
  const bannerAt = (await banner.boundingBox())!.y;
  const actions = (await main.getByTestId("home-quick-actions").boundingBox())!
    .y;
  expect(today < bannerAt && bannerAt < actions).toBe(true);
  await expectNoAxeViolations(page);
});

test("the dashboard of a workspace with no flow yet: Today, then the first run's words and its one Add a flow — no buttons, no Recent runs (W1; the app's HomeFirstRun)", async ({
  page,
}) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "Nothing automated. Yet." }),
  ).toBeVisible();
  await expect(main).toContainText(
    "Add a prebuilt flow and your first agent is running in minutes — no building required.",
  );
  await expect(main.getByRole("link", { name: "Add a flow" })).toHaveAttribute(
    "href",
    "/account/flows",
  );
  await expect(main.getByTestId("home-stats")).toBeVisible();
  await expect(main.getByTestId("home-quick-actions")).toHaveCount(0);
  await expect(main.getByTestId("home-recent-runs")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("Activity from a Today tile keeps the runs made since that midnight, said as Today — or Today · Successes / Failures — and an address with no instant filters nothing (W1; S27)", async ({
  page,
}) => {
  const main = page.locator("main");
  // The fixture's runs were made 2026-08-12 at noon.
  await page.goto("/account/runs?since=2026-08-12T00%3A00%3A00.000Z");
  const subheader = main
    .getByRole("heading", { level: 1 })
    .locator("xpath=following-sibling::p[1]");
  await expect(subheader).toHaveText("Today");
  await expect(main.getByRole("link", { name: /^Run of / })).toHaveCount(3);
  await page.goto(
    "/account/runs?status=failed&since=2026-08-12T00%3A00%3A00.000Z",
  );
  await expect(subheader).toHaveText("Today · Failures");
  await expect(main.getByRole("link", { name: /^Run of / })).toHaveCount(1);
  await page.goto("/account/runs?since=2026-08-13T00%3A00%3A00.000Z");
  await expect(subheader).toHaveText("Today");
  await expect(
    main.getByRole("heading", { name: "No activity yet" }),
  ).toBeVisible();
  await page.goto("/account/runs?since=yesterday");
  await expect(subheader).toHaveText("Every run in this workspace");
  await expect(main.getByRole("link", { name: /^Run of / })).toHaveCount(3);
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
  // It names the organization — a team is now a part of one.
  await expect(
    page.getByRole("heading", { name: "Join Fixture Organization", level: 1 }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join Fixture Organization" }).click();
  await expect(
    page.getByText("Your request was sent for approval."),
  ).toBeVisible();
  await expect(
    page.locator('a[href*="invite"], input[name*="invite" i]'),
  ).toHaveCount(0);
});

test("a domain claim refused after its organization was made keeps the organization: pressed again, setup claims again on it, with the same claim key, and makes no second organization (backend §12.1 #186)", async ({
  page,
}) => {
  await presentSession(page, "requester");
  await fixtureControl("domain-claim-refused-once");
  await page.goto("/onboarding/setup-org");
  const form = page.locator("form");
  await form.getByLabel("Organization name").fill("Requester Co");
  await form.getByRole("button", { name: "Create organization" }).click();
  await expect(form.getByRole("alert")).toHaveText(busy);
  // The organization is made, and named: only its claim is left to ask.
  await expect(form.getByLabel("Organization name")).toBeDisabled();
  await form.getByRole("button", { name: "Claim example.test again" }).click();
  // In the organization made, active and theirs: its page is offered.
  await expect(page).toHaveURL(/\/account$/);
  await expect(
    page
      .getByRole("complementary", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Organization" }),
  ).toBeVisible();
  const { createdOrganizations, organizationsAskedFor, domainClaims } =
    await fixtureRead<{
      createdOrganizations: {
        id: string;
        name: string;
        idempotencyKey: string;
      }[];
      organizationsAskedFor: number;
      domainClaims: {
        workspaceId: string;
        domain: string;
        joinPolicy: string;
        idempotencyKey: string;
        status: number;
      }[];
    }>("counts");
  // One organization, asked for once: the press after the refusal asked only
  // for the claim — not even a replay of the create.
  expect(createdOrganizations).toEqual([
    {
      id: expect.any(String),
      name: "Requester Co",
      idempotencyKey: expect.stringMatching(/^workspace-create-/u),
    },
  ]);
  expect(organizationsAskedFor).toBe(1);
  const claim = {
    workspaceId: createdOrganizations[0]!.id,
    domain: "example.test",
    joinPolicy: "approval",
    idempotencyKey: domainClaims[0]?.idempotencyKey,
  };
  expect(claim.idempotencyKey).toMatch(/^domain-claim-/u);
  expect(domainClaims).toEqual([
    { ...claim, status: 429 },
    { ...claim, status: 200 },
  ]);
});

test("organization request controls use the public join-request operation without invite links", async ({
  page,
}) => {
  await page.goto("/account/organization");
  // The person asking, by name and address — not an id (backend 24.12.4).
  await expect(page.getByText("Fixture Requester")).toBeVisible();
  await expect(page.getByText("requester@example.test")).toBeVisible();
  await expect(page.getByText(requesterUserId)).toHaveCount(0);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("No pending requests.")).toBeVisible();
  await expect(
    page.locator('a[href*="invite"], input[name*="invite" i]'),
  ).toHaveCount(0);
});

test("Verified domains only turns on and stays on, and turns off again (the owner's build 13 decision 8B)", async ({
  page,
}) => {
  await page.goto("/account/organization");
  const toggle = () =>
    page.getByRole("switch", { name: /^Verified domains only/ });
  await expect(toggle()).not.toBeChecked();
  await expect(
    page.getByText(
      "Only people who sign in with addresses at your verified domains can join, and members can't link an account outside them.",
    ),
  ).toBeVisible();
  await toggle().click();
  await expect(toggle()).toBeChecked();
  // Saved on the platform: read again, it is still on.
  await page.reload();
  await expect(toggle()).toBeChecked();
  await toggle().click();
  await expect(toggle()).not.toBeChecked();
  await page.reload();
  await expect(toggle()).not.toBeChecked();
});

test("Verified domains only refused says why, in words, and stays off (8B)", async ({
  page,
}) => {
  for (const [control, sentence] of [
    [
      "domain-only-refused?reason=members_outside_domain&count=2",
      "2 members sign in with an address outside your verified domains, so this can't be turned on yet. Nobody is removed. A member who hasn't signed in since this setting arrived counts until they sign in again.",
    ],
    [
      "domain-only-refused?reason=no_verified_domain",
      "Verify a domain before limiting the organization to it.",
    ],
  ] as const) {
    await fixtureControl(control);
    await page.goto("/account/organization");
    const toggle = page.getByRole("switch", { name: /^Verified domains only/ });
    await toggle.click();
    await expect(page.getByText(sentence)).toBeVisible();
    await expect(toggle).not.toBeChecked();
  }
});

// The organization's join page, as Copy join link puts it on the clipboard.
const joinPageLink = `http://127.0.0.1:3001/onboarding/join-org?w=${organizationWorkspaceId}`;

// The clipboard is stubbed in the page — each engine grants it differently —
// to keep what was written, or to refuse as a browser may.
async function stubClipboard(page: Page, refuse = false) {
  await page.addInitScript((refusing) => {
    const written: string[] = [];
    Object.defineProperty(window, "__clipboard", { value: written });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (refusing)
            return Promise.reject(
              new DOMException("Refused", "NotAllowedError"),
            );
          written.push(text);
          return Promise.resolve();
        },
      },
    });
  }, refuse);
}

test("Copy join link puts the organization's join page on the clipboard, says Copied, and says who can ask (the owner's build 9)", async ({
  page,
}) => {
  await stubClipboard(page);
  await page.goto("/account/organization");
  await expect(
    page.getByText(
      "People at example.test can ask to join. You approve them here.",
    ),
  ).toBeVisible();
  const status = page
    .getByRole("button", { name: "Copy join link" })
    .locator("xpath=..")
    .getByRole("status");
  await expect(status).toHaveText("");
  await page.getByRole("button", { name: "Copy join link" }).click();
  await expect(status).toHaveText("Copied");
  expect(
    await page.evaluate(
      () => (window as unknown as { __clipboard: string[] }).__clipboard,
    ),
  ).toEqual([joinPageLink]);
  await expectNoAxeViolations(page);
  // No element names an invite: a join link asks; an owner or admin approves.
  await expect(
    page.locator('a[href*="invite"], input[name*="invite" i]'),
  ).toHaveCount(0);
});

test("a refused clipboard leaves the join link selected in a field to copy by hand; an admin has it too, and a domain not verified yet is said (the owner's build 9)", async ({
  page,
}) => {
  await stubClipboard(page, true);
  await fixtureControl("domain-pending");
  await presentSession(page, "admin");
  await page.goto("/account/organization");
  await expect(
    page.getByText(
      "Verify your email domain first — only people at it can ask to join.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy join link" }).click();
  const field = page.getByRole("textbox", { name: "Join link" });
  await expect(field).toHaveValue(joinPageLink);
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((input: HTMLInputElement) =>
      input.value.slice(input.selectionStart ?? 0, input.selectionEnd ?? 0),
    ),
  ).toBe(joinPageLink);
  await expect(page.getByText("Copied", { exact: true })).toHaveCount(0);
  await expectNoAxeViolations(page);
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

test.describe("the complete export (backend §12.1 #39)", () => {
  // The download link is the fixture's own, as a signed store URL would be.
  test.use({ ignoreHTTPSErrors: true });

  test("everything is prepared as one file, and Download asks for a fresh link when it is clicked", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByRole("button", { name: "Preparing everything…" }),
    ).toBeDisabled();
    // Read as running once, then ready: the page asks again on its own.
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 15_000 });
    await expectNoAxeViolations(page);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download file" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("workspace-export.json");
    // The third read's link — asked for at the click, not kept from the second.
    expect(new URL(file.url()).searchParams.get("read")).toBe("3");
  });

  test("an export that failed says why, or that it could not be made, and Export everything is offered again", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    const start = page.getByRole("button", { name: "Export everything" });
    for (const [reason, words] of [
      ["interrupted", "The export was interrupted. Start it again."],
      ["too_large", "The workspace is larger than one export file may be."],
      ["not_configured", "Exports are not available here."],
      // A reason the page does not name, and none at all.
      ["store_refused", "The export could not be made."],
      ["", "The export could not be made."],
    ] as const) {
      await fixtureControl(`export-failed?reason=${reason}`);
      await start.click();
      // Followed from running, so each answer is this export's, not the last.
      await expect(
        page.getByRole("button", { name: "Preparing everything…" }),
      ).toBeDisabled();
      await expect(page.getByText(words, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(start).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Download file" }),
      ).toHaveCount(0);
    }
  });

  test("an export that is ready but partial says so, and still gives its file", async ({
    page,
  }) => {
    await fixtureControl("export-partial");
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByText(
        "Ready, but partial: a part of the workspace could not be read, and the file says which.",
      ),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toHaveCount(0);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download file" }).click();
    expect((await download).suggestedFilename()).toBe("workspace-export.json");
  });

  test("Export everything the platform refuses is said, and no export is started", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    // No longer an admin by the time they click.
    await presentSession(page, "member");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Forbidden",
    );
    await expect(
      page.getByRole("button", { name: "Export everything" }),
    ).toBeEnabled();
    expect(
      await fixtureRead<{ exportJobStarted: boolean; exportJobReads: number }>(
        "counts",
      ),
    ).toMatchObject({ exportJobStarted: false, exportJobReads: 0 });
  });

  test("a download whose fresh link the platform cannot read says so, and nothing is downloaded", async ({
    page,
  }) => {
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.url()));
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 15_000 });
    await fixtureControl("export-read-failing");
    await page.getByRole("button", { name: "Download file" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Service Unavailable",
    );
    // Still offered, to try again.
    await expect(
      page.getByRole("button", { name: "Download file" }),
    ).toBeEnabled();
    await page.waitForTimeout(1_000);
    expect(downloads).toEqual([]);
  });

  test("a download after another tab switched workspace is refused, reads nothing and downloads nothing (register F28)", async ({
    page,
    context,
  }) => {
    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.url()));
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 15_000 });
    const other = await context.newPage();
    try {
      await other.goto("/account");
      const trigger = other.getByRole("button", { name: "Switch workspace" });
      await trigger.click();
      await other.getByRole("button", { name: /Fixture Personal/ }).click();
      await expect(trigger).toContainText("Fixture Personal");
    } finally {
      await other.close();
    }
    const reads = async () =>
      (await fixtureRead<{ exportJobReads: number }>("counts")).exportJobReads;
    const before = await reads();
    await page.getByRole("button", { name: "Download file" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "The active workspace changed in another tab. Reload this page before continuing.",
    );
    await page.waitForTimeout(1_000);
    expect(await reads()).toBe(before);
    expect(downloads).toEqual([]);
  });
});

test("a complete export's file that has been removed is said so, and nothing is downloaded (backend §12.1 #39)", async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.url()));
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect(
    page.getByText("Ready. The file holds the whole workspace."),
  ).toBeVisible({ timeout: 15_000 });
  await fixtureControl("export-expired");
  await page.getByRole("button", { name: "Download file" }).click();
  await expect(
    page.getByText("That file has been removed. Export again for a new one."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download file" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Export everything" }),
  ).toBeEnabled();
  expect(downloads).toEqual([]);
});

test.describe("following a complete export when a read of it fails (backend §12.1 #39)", () => {
  test.use({ ignoreHTTPSErrors: true });

  test("a read the platform fails is asked again, and the export is still followed to ready", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    await fixtureControl("export-read-failing-once");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  });

  test("a read the browser cannot even send is asked again, not dropped unseen", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByRole("button", { name: "Preparing everything…" }),
    ).toBeDisabled();
    let failed = false;
    await page.route("**/account/settings", async (route) => {
      if (failed || !isServerAction(route.request())) return route.fallback();
      failed = true;
      await route.abort();
    });
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 20_000 });
    expect(failed).toBe(true);
  });

  test("reads that keep failing stop in a bounded time, say so, and offer Export everything again", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    await fixtureControl("export-read-failing");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Service Unavailable",
      { timeout: 30_000 },
    );
    const again = page.getByRole("button", { name: "Export everything" });
    await expect(again).toBeEnabled();
    // Asking again picks the running export up, and it is followed to ready.
    await fixtureControl("export-read-failing-once");
    await again.click();
    await expect(
      page.getByText("Ready. The file holds the whole workspace."),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("leaving the page while a read is in flight asks the platform nothing more", async ({
    page,
  }) => {
    await page.goto("/account/settings");
    await page.getByRole("button", { name: "Export everything" }).click();
    await expect(
      page.getByRole("button", { name: "Preparing everything…" }),
    ).toBeDisabled();
    const read = await holdRequest(page, "**/account/settings", isServerAction);
    await read.arrived;
    await page
      .getByRole("complementary", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Home" })
      .click();
    await expect(page).toHaveURL(/\/account$/);
    read.release();
    const reads = async () =>
      (await fixtureRead<{ exportJobReads: number }>("counts")).exportJobReads;
    await expect.poll(reads).toBe(1);
    // Past the next read's time: none is sent from a page no longer shown.
    await page.waitForTimeout(4_000);
    expect(await reads()).toBe(1);
  });
});

test("an export from a page whose workspace was switched away in another tab says so, and exports nothing (register F28)", async ({
  page,
  context,
}) => {
  await page.goto("/account/settings");
  const other = await context.newPage();
  try {
    await other.goto("/account");
    const trigger = other.getByRole("button", { name: "Switch workspace" });
    await trigger.click();
    await other.getByRole("button", { name: /Fixture Personal/ }).click();
    await expect(trigger).toContainText("Fixture Personal");
  } finally {
    await other.close();
  }
  const changed =
    "The active workspace changed in another tab. Reload this page before continuing.";
  await page.getByRole("button", { name: "Prepare export" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(changed);
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText([
    changed,
    changed,
  ]);
  expect(
    await fixtureRead<{ exportCount: number; exportJobStarted: boolean }>(
      "counts",
    ),
  ).toMatchObject({ exportCount: 0, exportJobStarted: false });
});

test("Settings shows the Linked accounts lead in one line — Sign in with any of these. — and each sign-in account by its provider's glyph (Build 21, spec A5; the owner's build 20 items 8 and 9; ~~register F86's sentences~~)", async ({
  page,
}) => {
  await page.goto("/account/settings");
  // One line under the heading, once the accounts are read, as in the app
  // (Build 21, spec A5; the owner's build 20 item 9).
  const lead = page
    .locator("main")
    .getByRole("heading", { name: "Linked accounts" })
    .locator("xpath=following-sibling::p[1]");
  await expect(lead).toHaveText("Sign in with any of these.");
  // Each sign-in account by its provider's own glyph, never a key.
  const rows = page
    .locator("main li")
    .filter({ hasText: /Google|Microsoft|Apple/u });
  for (const row of await rows.all()) {
    await expect(row.locator("svg").first()).toBeVisible();
  }
  await expect(
    page.getByText("Link additional sign-in options to this account."),
  ).toHaveCount(0);
});

test("Unlink takes a linked sign-in account off, confirmed first; the one signed up with has none; a refusal is said in the app's words (backend 24.11.1, build 10)", async ({
  page,
}) => {
  await page.goto("/account/settings");
  const google = page.locator("main li").filter({ hasText: "Google" });
  const microsoft = page.locator("main li").filter({ hasText: "Microsoft" });
  await expect(google).toContainText("Primary");
  await expect(google.getByRole("button", { name: "Unlink" })).toHaveCount(0);
  await expect(microsoft).toContainText("Linked");
  // Each account by the address its provider reports (backend 24.12.2), so
  // two sign-ins can be told apart.
  await expect(google).toContainText("owner@example.test");
  await expect(microsoft).toContainText("fixture.owner@outlook.test");

  // A refusal is the app's sentence for its reason — never the problem's
  // title — and the account stays linked.
  await fixtureControl("unlink-refused");
  await microsoft.getByRole("button", { name: "Unlink" }).click();
  let dialog = page.getByRole("dialog", { name: "Unlink Microsoft?" });
  await expect(dialog).toContainText(
    "You can still sign in with your other linked accounts, and link this one again later.",
  );
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "This sign-in account cannot be unlinked.",
  );
  await expect(microsoft).toContainText("Linked");

  await fixtureControl("reset");
  await microsoft.getByRole("button", { name: "Unlink" }).click();
  dialog = page.getByRole("dialog", { name: "Unlink Microsoft?" });
  // Cancel changes nothing.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(microsoft).toContainText("Linked");
  await microsoft.getByRole("button", { name: "Unlink" }).click();
  await dialog.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Unlinked: offered to link again, and no longer named.
  await expect(microsoft.getByRole("link", { name: "Link" })).toBeVisible();
  await expect(microsoft).not.toContainText("fixture.owner@outlook.test");
  await expect(google).toContainText("Primary");
});

test("each unlink refusal is said in the app's words: every reason, a platform with no unlink yet, and an account another tab already unlinked — never a problem's title (build 10)", async ({
  page,
}) => {
  await page.goto("/account/settings");
  const microsoft = page.locator("main li").filter({ hasText: "Microsoft" });
  const alert = page.locator("main").getByRole("alert");
  const unlink = async () => {
    await microsoft.getByRole("button", { name: "Unlink" }).click();
    await page
      .getByRole("dialog", { name: "Unlink Microsoft?" })
      .getByRole("button", { name: "Unlink" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  };
  for (const [control, words] of [
    [
      "unlink-refused?reason=primary",
      "The account you signed up with stays linked.",
    ],
    ["unlink-refused?reason=last", "The last sign-in account stays linked."],
    [
      "unlink-refused?reason=refused",
      "This sign-in account cannot be unlinked.",
    ],
    // A reason the website does not name: the fallback, not "Bad Request".
    [
      "unlink-refused?reason=a_reason_not_named_here",
      "The account could not be unlinked.",
    ],
    // The Edge's answer for a route it does not have yet (production before
    // the SEVENTEENTH promotion) names the method and path.
    ["unlink-route-missing", "Unlinking isn't available yet."],
  ] as const) {
    await fixtureControl("reset");
    await fixtureControl(control);
    await unlink();
    await expect(alert).toHaveText(words);
    await expect(microsoft).toContainText("Linked");
  }
  // Another tab unlinked it first: this page still offers Unlink, and the
  // platform's 404 says the account is not linked.
  await fixtureControl("reset");
  const elsewhere = await page
    .context()
    .request.delete("/api/platform/v1/auth/identities/microsoft", {
      headers: { origin: "http://127.0.0.1:3001" },
    });
  expect(elsewhere.status()).toBe(200);
  await unlink();
  await expect(alert).toHaveText("That sign-in account is not linked.");
  await expect(microsoft.getByRole("link", { name: "Link" })).toBeVisible();
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

test("an admin reaches the organization page, where every operation admits them (register F55)", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await page.goto("/account/organization");
  await expect(page).toHaveURL(/\/account\/organization$/);
  await expect(
    page.getByRole("heading", { name: "Organization", exact: true }),
  ).toBeVisible();
  // Each member's badge is the role the platform holds — an admin reads as one.
  const self = page.locator("main li").filter({ hasText: "(you)" });
  await expect(self).toContainText("Fixture Admin");
  await expect(self.getByText(/^admin$/i)).toBeVisible();
  await expect(
    page
      .getByRole("complementary", { name: "Dashboard navigation" })
      .getByRole("link", { name: "Organization" }),
  ).toBeVisible();
});

const fixtureProject = "/account/teams/33333333-3333-4333-8333-333333333333";

// Every team a test created, as the platform recorded it.
async function createdTeams() {
  return (
    await fixtureRead<{
      createdTeams: { workspaceId: string; name: string; type: string }[];
    }>("counts")
  ).createdTeams;
}

test("no one creates a team: Teams, its empty screen and the dashboard offer no Create a team — to an owner, an admin or a member (backend ADR-0036; the owner, 2026-10-14)", async ({
  page,
}) => {
  const main = page.locator("main");
  for (const session of ["admin", "member", "owner"] as const) {
    await presentSession(page, session);
    await page.goto("/account/teams");
    await expect(page.getByRole("link", { name: /general/ })).toBeVisible();
    await expect(main).not.toContainText(/Create a (team|department)/u);
  }
  // With no team at all: the empty screen, and nothing to create.
  await fixtureControl("org-without-projects");
  await page.goto("/account/teams");
  await expect(
    main.getByRole("heading", { name: "No departments yet" }),
  ).toBeVisible();
  await expect(
    main.getByText("A department has its own flows and its own people."),
  ).toBeVisible();
  await expect(main.getByRole("button")).toHaveCount(0);
  await expectNoAxeViolations(page);
  await page.goto("/account");
  await expect(main).not.toContainText(/Create a (team|department)/u);
  expect(await createdTeams()).toEqual([]);
});

test('the dashboard lists no teams — Teams stay on their own page (the owner\'s AM5: "remove lsit teams on bottom of home page, it is useless")', async ({
  page,
}) => {
  await page.goto("/account");
  const main = page.locator("main");
  await expect(main.getByTestId("home-recent-runs")).toBeVisible();
  await expect(
    main.getByRole("heading", { name: "Departments", exact: true }),
  ).toHaveCount(0);
  await expect(
    main.getByRole("link", { name: /View all (teams|departments)/u }),
  ).toHaveCount(0);
  await expect(main.getByRole("link", { name: /general/ })).toHaveCount(0);
});

test("a team's owner adds someone from the organization, and the team lists who is on it (backend §12.1 #173)", async ({
  page,
}) => {
  await page.goto(fixtureProject);
  const members = page.locator("main li");
  await expect(members.filter({ hasText: "Fixture Owner" })).toBeVisible();
  await expect(members.filter({ hasText: "Fixture Member" })).toBeVisible();
  await expect(page.getByText("2 members")).toBeVisible();
  await page.getByRole("button", { name: "Add members" }).click();
  const picker = page.getByRole("dialog", { name: "Add members" });
  const admin = picker.locator("li").filter({ hasText: "Fixture Admin" });
  await admin.getByLabel("Role").selectOption("admin");
  await admin.getByRole("button", { name: "Add" }).click();
  await expect(
    picker.getByText(
      "Everyone in this organization is already in the department.",
    ),
  ).toBeVisible();
  await picker.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("3 members")).toBeVisible();
  await expect(page.getByLabel("Role for Fixture Admin")).toHaveValue("admin");
});

test("a team's owner approves a request to join, and the person is on the team (backend 24.11.2)", async ({
  page,
}) => {
  await page.goto(fixtureProject);
  await expect(
    page.getByRole("heading", { name: "Asking to join" }),
  ).toBeVisible();
  const asking = page
    .locator("main li")
    .filter({ hasText: "Fixture Newcomer" });
  await expect(asking).toContainText("newcomer@example.test");
  await expectNoAxeViolations(page);
  await asking.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("No one is asking to join.")).toBeVisible();
  await expect(page.getByText("3 members")).toBeVisible();
  await expect(page.getByLabel("Role for Fixture Newcomer")).toHaveValue(
    "member",
  );
});

test("a team's owner denies a request to join, and no one is added (backend 24.11.2)", async ({
  page,
}) => {
  await page.goto(fixtureProject);
  await page
    .locator("main li")
    .filter({ hasText: "Fixture Newcomer" })
    .getByRole("button", { name: "Deny" })
    .click();
  await expect(page.getByText("No one is asking to join.")).toBeVisible();
  await expect(page.getByText("2 members")).toBeVisible();
  await expect(page.getByText("Fixture Newcomer")).toHaveCount(0);
});

test("a plain member on a team sees no requests and adds no one; an organization admin off the team sees it, decides, and has nothing to leave (backend 24.11.3)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(fixtureProject);
  // A team made before a team was its kind keeps a name of its own at the
  // platform; its title is still its kind, said once (the owner's build 9).
  await expect(
    page.getByRole("heading", { name: "general", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture Organization · You are its member", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Fixture Project");
  await expect(
    page.getByRole("heading", { name: "Asking to join" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add members" })).toHaveCount(
    0,
  );
  await expect(
    page.locator("main").getByRole("button", { name: "Leave department" }),
  ).toBeVisible();

  await presentSession(page, "admin");
  await page.goto(fixtureProject);
  await expect(
    page.getByText(
      "Fixture Organization · You see every department as an organization admin",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Asking to join" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add members" })).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: "Leave department" }),
  ).toHaveCount(0);
});

test("a plain member asks to join a team the organization lists, sees Requested, and withdraws the request, confirmed first (backend 24.11.2, 24.11.4)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto("/account/teams");
  await expect(
    page.getByRole("heading", { name: "Ask to join" }),
  ).toBeVisible();
  const operations = page.locator("main li").filter({ hasText: "Operations" });
  // The team they are on is theirs, not one to ask for — titled by its kind,
  // printed once.
  const theirs = page.locator("main li").filter({ hasText: "general" });
  await expect(theirs).toHaveCount(1);
  await expect(theirs).not.toContainText("Fixture Project");
  await operations.getByRole("button", { name: "Request to join" }).click();
  await expect(operations).toContainText("Requested");
  await expectNoAxeViolations(page);
  await operations.getByRole("button", { name: "Withdraw" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Withdraw your request to join Operations?",
  });
  await expect(dialog).toContainText("You can ask again any time.");
  await dialog.getByRole("button", { name: "Withdraw" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    operations.getByRole("button", { name: "Request to join" }),
  ).toBeVisible();
});

test("before the platform has a directory and requests, Teams lists the teams a person is on and leaves the asking out, never the page", async ({
  page,
}) => {
  await fixtureControl("team-access-missing");
  await presentSession(page, "member");
  await page.goto("/account/teams");
  await expect(page.getByRole("link", { name: /general/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ask to join" })).toHaveCount(
    0,
  );
  await presentSession(page, "owner");
  await page.goto(fixtureProject);
  await expect(page.getByText("No one is asking to join.")).toBeVisible();
});

test("the old addresses land on the new pages: Automations is Flows, Projects is Teams (BUILD-PLAN 24.11.11)", async ({
  page,
}) => {
  await page.goto("/account/automations");
  await expect(page).toHaveURL(/\/account\/flows$/);
  await expect(page.getByRole("heading", { name: "Flows" })).toBeVisible();
  await page.goto("/account/projects");
  await expect(page).toHaveURL(/\/account\/teams$/);
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await expect(page).toHaveURL(fixtureProject);
  await expect(
    page.getByRole("heading", { name: "general", level: 1 }),
  ).toBeVisible();
});

test("Leave department's dialog gives focus back to Leave department when it closes (register F75)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(fixtureProject);
  const trigger = page
    .locator("main")
    .getByRole("button", { name: "Leave department" });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Leave “general”?",
  });
  await expect(dialog.getByLabel("Confirmation")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Leave department's dialog holds while the platform decides, and says its refusal (register F76)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(fixtureProject);
  await page
    .locator("main")
    .getByRole("button", { name: "Leave department" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Leave “general”?",
  });
  await dialog.getByLabel("Confirmation").fill("DELETE");
  const leave = await holdRequest(page, `**${fixtureProject}`, isServerAction);
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Leave department" }).click();
  await leave.arrived;
  // Neither Escape nor the backdrop closes it while the answer is on its way.
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  leave.release();
  await expect(dialog.getByText(busy)).toBeVisible();
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
  // The boundary asked, and the session is still there, so it says so
  // (register F60).
  await expect(page.getByText("You have not been signed out")).toBeVisible();
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
  await page
    .getByRole("button", { name: "Connect Fixture key provider" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Connect Fixture key provider" }),
  ).toBeFocused();
});

// A plan's card on the billing page, found by its name.
function planCard(page: Page, name: string) {
  return page
    .locator("main li")
    .filter({ has: page.getByText(name, { exact: true }) });
}

// How many checkouts the platform was asked for, bought or refused.
async function checkoutAttempts() {
  return (await fixtureRead<{ checkoutAttempts: number }>("counts"))
    .checkoutAttempts;
}

// The hosted pages are the provider's; here they are stubbed at the browser,
// in every tab, so the navigation itself is what is observed.
async function stubHostedPages(context: BrowserContext) {
  await context.route("https://billing.invalid/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>hosted</h1>",
    }),
  );
}

test("a billing hand-off is refused when another tab changed the active workspace", async ({
  page,
  context,
}) => {
  await page.goto("/account/billing");
  await expect(planCard(page, "Free")).toContainText("Enrolled");
  const other = await context.newPage();
  try {
    await other.goto("/account");
    const trigger = other.getByRole("button", { name: "Switch workspace" });
    await trigger.click();
    await other.getByRole("button", { name: /Fixture Personal/ }).click();
    await expect(trigger).toContainText("Fixture Personal");
    // This page still shows the organization, which is no longer active:
    // nothing is bought for a workspace the person was not looking at.
    await planCard(page, "Plus")
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

test("three cards side by side — Free, then the platform's plans by price — each its name and its price, and the workspace's own says Enrolled (the owner's build 9)", async ({
  page,
}) => {
  await page.goto("/account/billing");
  const cards = page.locator("main li");
  // By price, though the platform lists Pro before Plus.
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Free");
  await expect(cards.nth(1)).toContainText("Plus");
  await expect(cards.nth(2)).toContainText("Pro");
  await expect(planCard(page, "Free")).toContainText("$0.00 per month");
  await expect(planCard(page, "Plus")).toContainText("$5.00 per month");
  await expect(planCard(page, "Pro")).toContainText("$10.00 per month");
  // The platform's Pro, not the one drawn in its absence: it can be bought.
  await expect(
    planCard(page, "Pro").getByRole("button", { name: "Choose plan" }),
  ).toBeVisible();
  // On the free floor Free is the workspace's own, and offers nothing.
  await expect(planCard(page, "Free")).toContainText("Enrolled");
  await expect(planCard(page, "Free").getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Enrolled", { exact: true })).toHaveCount(1);
  // A name and a price: no capability is printed, in words or as a key.
  const main = page.locator("main");
  for (const capability of [
    "Flows",
    "Requests per minute",
    "automation.subscribe",
    "workspace.rate",
  ]) {
    await expect(main).not.toContainText(capability);
  }
  // Side by side, across the page's width.
  const tops = await cards.evaluateAll((items) =>
    items.map((item) => Math.round(item.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);
  await expectNoAxeViolations(page);
});

test("a plan picked opens the provider's checkout for that plan; once paying, its card says Enrolled with its status and renewal, and every other card opens Manage billing (ADR-0025, the owner's build 9)", async ({
  page,
  context,
}) => {
  await stubHostedPages(context);
  await page.goto("/account/billing");
  await planCard(page, "Pro")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  // Back on the page, the plan the checkout was for is the workspace's.
  await page.goto("/account/billing");
  const pro = planCard(page, "Pro");
  await expect(pro).toContainText("Enrolled");
  await expect(pro.getByText(/^active$/i)).toBeVisible();
  await expect(pro.locator("dt")).toHaveText("Renews");
  await expect(pro.locator("dd")).toHaveText("Sep 12, 2026, 12:00 PM");
  await expect(planCard(page, "Free")).not.toContainText("Enrolled");
  // Free is cancelling the paid plan in the portal (the owner's build 13 decision 7c).
  await expect(planCard(page, "Free")).toContainText(
    "To move to Free, cancel Pro in Manage billing.",
  );
  await expectNoAxeViolations(page);
  // Changing plans is the portal's: another card, Free included, opens
  // Manage billing — never a second checkout, not even one refused.
  for (const name of ["Plus", "Free"]) {
    await page.goto("/account/billing");
    await planCard(page, name)
      .getByRole("button", { name: "Choose plan" })
      .click();
    await page.waitForURL(/billing\.invalid\/portal\//);
  }
  expect(await checkoutAttempts()).toBe(1);
  await page.goto("/account/billing");
  await pro.getByRole("button", { name: "Manage billing" }).click();
  await page.waitForURL(/billing\.invalid\/portal\//);
  // A subscription gone by the time Manage billing is pressed: the portal
  // answers that there is no billing account, and the page says what to do.
  await page.goto("/account/billing");
  await fixtureControl("reset");
  await pro.getByRole("button", { name: "Manage billing" }).click();
  await expect(
    page.getByText(
      "This workspace has no billing account yet. Choose a plan below to start one.",
    ),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account\/billing$/);
});

test("a cancelled plan says it ends, then Free, and the Free card no longer says to cancel it (the owner's build 14 feedback #11)", async ({
  page,
  context,
}) => {
  await stubHostedPages(context);
  await page.goto("/account/billing");
  await planCard(page, "Pro")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  await fixtureControl("billing-cancelled");
  await page.goto("/account/billing");
  const pro = planCard(page, "Pro");
  await expect(pro).toContainText("Enrolled");
  await expect(pro.locator("dt")).toHaveText("Ends");
  await expect(pro.locator("dd")).toHaveText(
    "Sep 12, 2026, 12:00 PM, then Free",
  );
  await expect(planCard(page, "Free")).not.toContainText("To move to Free");
  // Manage billing stays: a cancellation is undone in the portal.
  await expect(
    pro.getByRole("button", { name: "Manage billing" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a checkout for a workspace that already has a plan opens Manage billing instead — the platform refuses a second subscription (backend 24.12, build 10)", async ({
  page,
  context,
}) => {
  await stubHostedPages(context);
  // This page renders on the free floor …
  await page.goto("/account/billing");
  await expect(planCard(page, "Free")).toContainText("Enrolled");
  // … and another tab buys Plus meanwhile.
  const other = await context.newPage();
  try {
    await other.goto("/account/billing");
    await planCard(other, "Plus")
      .getByRole("button", { name: "Choose plan" })
      .click();
    await other.waitForURL(/billing\.invalid\/checkout\//);
  } finally {
    await other.close();
  }
  await planCard(page, "Pro")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/portal\//);
  // The platform was asked, and refused: two checkouts, one plan.
  expect(await checkoutAttempts()).toBe(2);
  // Nothing was bought twice: the plan is still the one the other tab bought.
  await page.goto("/account/billing");
  await expect(planCard(page, "Plus")).toContainText("Enrolled");
  await expect(planCard(page, "Pro")).not.toContainText("Enrolled");
});

test("a plan whose price the provider cannot state says it is shown at checkout, and is the last card (backend ADR-0031)", async ({
  page,
}) => {
  await fixtureControl("plan-price-unstated");
  await page.goto("/account/billing");
  const cards = page.locator("main li");
  await expect(cards.nth(1)).toContainText("Plus");
  await expect(cards.nth(2)).toContainText("Pro");
  await expect(planCard(page, "Pro")).toContainText("Price shown at checkout");
});

test("a platform listing no Pro: Pro is drawn last at $10.00 per month and opens neither checkout nor Manage billing — paying or not (the owner's build 10)", async ({
  page,
  context,
}) => {
  await stubHostedPages(context);
  await fixtureControl("plan-pro-unlisted");
  await page.goto("/account/billing");
  const cards = page.locator("main li");
  // Still three: Free, Plus, and the Pro the website draws until the platform
  // has one — its name and the owner's price, and no control.
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Free");
  await expect(cards.nth(1)).toContainText("Plus");
  await expect(cards.nth(2)).toContainText("Pro");
  const pro = planCard(page, "Pro");
  await expect(pro).toContainText("$10.00 per month");
  await expect(pro.getByRole("button")).toHaveCount(0);
  await expect(pro).not.toContainText("Enrolled");
  await expect(pro).not.toContainText("Price shown at checkout");
  await expect(
    planCard(page, "Plus").getByRole("button", { name: "Choose plan" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  // Once paying, every other card opens Manage billing — not the drawn Pro,
  // which the portal has nothing to change to.
  await planCard(page, "Plus")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  await page.goto("/account/billing");
  await expect(planCard(page, "Plus")).toContainText("Enrolled");
  await expect(pro.getByRole("button")).toHaveCount(0);
  await expect(
    planCard(page, "Free").getByRole("button", { name: "Choose plan" }),
  ).toBeVisible();
  expect(await checkoutAttempts()).toBe(1);
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
      name: /^(Connect|Reconnect|Disconnect|Replace account)\b/,
    }),
  ).toHaveCount(0);
  await page.goto("/account/settings");
  await expect(
    page.getByText("Exporting a workspace is for its owners and admins"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Prepare export|Export everything)$/ }),
  ).toHaveCount(0);
});

test("each workspace holds its own plan — buying for the personal workspace leaves the organization's alone (register F31)", async ({
  page,
  context,
}) => {
  await stubHostedPages(context);
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
  await planCard(page, "Plus")
    .getByRole("button", { name: "Choose plan" })
    .click();
  await page.waitForURL(/billing\.invalid\/checkout\//);
  await page.goto("/account/billing");
  await expect(planCard(page, "Plus")).toContainText("Enrolled");
  await activate(organizationWorkspaceId);
  await page.goto("/account/billing");
  await expect(planCard(page, "Free")).toContainText("Enrolled");
  await expect(
    planCard(page, "Plus").getByRole("button", { name: "Choose plan" }),
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
  // Its words (the register, 2026-10-13): the Privacy Policy says what
  // deletion leaves, and the old "permanently removed", which was not true,
  // is gone.
  const main = page.getByRole("main");
  await expect(main).toContainText("says what deletion does not remove");
  await expect(main).not.toContainText("permanently removed");
  await expect(
    main.getByRole("link", { name: "Privacy Policy" }),
  ).toHaveAttribute("href", "/privacy");
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

test("a 409 after a lost answer clears the hedge — the account is still here, so a later 401 is only a session that ended (register F47)", async ({
  page,
}) => {
  const answers: ("lost" | "partial" | "expired")[] = [
    "lost",
    "partial",
    "expired",
  ];
  await page.route(/\/api\/platform\/v1\/account$/, (route) => {
    const answer = answers.shift();
    if (answer === "lost") {
      return route.fulfill({
        status: 502,
        contentType: "text/html",
        body: "<!doctype html><title>502</title><p>Bad Gateway</p>",
      });
    }
    if (answer === "partial") {
      return route.fulfill({
        status: 409,
        contentType: "application/problem+json",
        body: JSON.stringify({ title: "Conflict", status: 409 }),
      });
    }
    return route.fulfill(unauthenticated);
  });
  await page.goto("/account/settings");
  await page.getByRole("button", { name: "Delete Account" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Yes, delete my account" }).click();
  await expect(dialog.getByRole("alert")).toContainText(UNKNOWN_OUTCOME);
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "so your account is still here",
  );
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Your session ended, so this attempt did not run. Sign in again to come back here.",
  );
  await expect(
    dialog.getByRole("link", { name: "Sign in again" }),
  ).toBeVisible();
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

test("signed out, the login page says under its buttons that continuing agrees to the Terms of Service and the Privacy Policy, each a link, in the lead's size and colour, with nothing to tick (the owner, 2026-10-13)", async ({
  page,
}) => {
  await page.context().clearCookies();
  await page.goto("/login");
  const line = page.getByText(
    "By continuing, you agree to our Terms of Service and Privacy Policy.",
    { exact: true },
  );
  await expect(line).toBeVisible();
  for (const [name, href] of [
    ["Terms of Service", "/terms"],
    ["Privacy Policy", "/privacy"],
  ] as const) {
    const link = line.getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", href);
    await expect(link).toHaveCSS("text-decoration-line", "underline");
  }
  // Under the last button.
  const lastButton = page.getByRole("link", { name: /^Continue with / }).last();
  await expect(lastButton).toBeVisible();
  const buttonBox = await lastButton.boundingBox();
  const lineBox = await line.boundingBox();
  expect(lineBox!.y).toBeGreaterThanOrEqual(buttonBox!.y + buttonBox!.height);
  // Never smaller or fainter than the screen's own lead.
  const look = (element: Element) => {
    const style = getComputedStyle(element);
    return [style.fontSize, style.color, style.opacity];
  };
  expect(await line.evaluate(look)).toEqual(
    await page
      .getByText(/^Sign in with an approved provider\./u)
      .evaluate(look),
  );
  await expect(page.getByRole("checkbox")).toHaveCount(0);
});

test("a link the platform refused lands a signed-in person on Linked accounts, which says why once (the owner's build 13 decision 10A, TestFlight #19)", async ({
  page,
}) => {
  // The platform sends a link's refusal to the login page, as a sign-in's;
  // signed in already, the person was linking.
  await page.goto("/login?error=auth_callback&reason=identity_already_linked");
  await expect(page).toHaveURL(
    /^http:\/\/127\.0\.0\.1:3001\/account\/settings$/,
  );
  const said = page.getByText(
    "That account is already linked, to this account or another. To link it here, unlink it from the other account first.",
  );
  await expect(said).toBeVisible();
  // Said once: the address no longer carries it, so a reload does not.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Linked accounts" }),
  ).toBeVisible();
  await expect(said).toHaveCount(0);
  // A reason the page does not know is said as the link failing, never raw.
  await page.goto("/login?error=auth_callback&reason=%3Cb%3Ex%3C%2Fb%3E");
  await expect(
    page.getByText("The account could not be linked. Try again."),
  ).toBeVisible();
});

test("signed out, a refused sign-in says why on the login page (10A)", async ({
  page,
}) => {
  await page.context().clearCookies();
  for (const [reason, sentence] of [
    ["signup_disabled", "New sign-ups are closed."],
    ["access_denied", "Sign-in was declined."],
    [
      "provider_refused",
      "Sign-in did not complete. Please try your provider again.",
    ],
  ] as const) {
    await page.goto(`/login?error=auth_callback&reason=${reason}`);
    // By its words: Next's route announcer is an empty alert of its own.
    const said = page.getByText(sentence, { exact: true });
    await expect(said).toBeVisible();
    await expect(said).toHaveAttribute("role", "alert");
  }
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
