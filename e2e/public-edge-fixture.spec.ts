import { AxeBuilder } from "@axe-core/playwright";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Request,
} from "@playwright/test";
import {
  automationCard,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  holdRequest,
  isServerAction,
  observe,
  presentSession,
  providerCard,
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

// A second team in the organization, made as a person makes one: a flow is
// added to a team and nowhere else (the owner's build 10), so a flow already in
// the fixture's one team has somewhere left to go only once there are two.
async function createOperationsTeam(page: Page) {
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Operations");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await page.getByRole("button", { name: "Done" }).click();
}

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

test("a dialog that sends nothing yet closes on a click outside it, as on Escape (components/ui/Modal's default)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  const connect = providerCard(page, "Fixture key provider").getByRole(
    "button",
    { name: "Connect" },
  );
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

test("a connection says how many live flows use it — flows, as every signed-in page says (BUILD-PLAN 24.11.11)", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await expect(
    page.getByText("fixture-oauth · Used by 1 live flow", { exact: true }),
  ).toBeVisible();
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
  // The plan-limit flow is already in the fixture's one team, so a second is
  // where Add can still send it (the owner's build 10); the platform's refusal
  // is the same whatever the team.
  await createOperationsTeam(page);
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

test("a live automation whose pinned version declares run input is started from its form, and the run's page follows", async ({
  page,
}) => {
  // Backend §12.1 #162, ADR-0030. The fixture creates the run only when the
  // input is exactly the declaration, typed as it says — so landing on the run's
  // page proves the form sent a number for money and nothing undeclared.
  await page.goto("/account/flows");
  const card = automationCard(page, "Manual input automation");
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await card.getByRole("button", { name: "Run", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Run Manual input automation",
  });
  await expect(dialog).toBeVisible();
  // The declared fields, in order. The file is optional, so a run starts
  // without one (backend FR-14; a file is chosen in the tests below).
  await expect(dialog.getByLabel("Vendor")).toBeVisible();
  await expect(dialog.getByLabel("Amount")).toHaveAttribute("type", "number");
  await expect(dialog.getByLabel("Invoice reference")).toBeVisible();
  await expect(dialog.getByLabel("Invoice file")).toHaveAttribute(
    "type",
    "file",
  );
  await expectNoAxeViolations(page);
  await dialog.getByLabel("Vendor").fill("Acme Supplies");
  await dialog.getByLabel("Amount").fill("120.50");
  await dialog.getByLabel("Invoice reference").fill("INV-1001");
  await dialog.getByRole("button", { name: "Start run" }).click();
  await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
  await expect(page.getByText("Manual", { exact: true })).toBeVisible();
});

test("a refused start keeps what was typed and the same idempotency key, so resubmitting cannot start a second run", async ({
  page,
}) => {
  // React resets an action form's fields when the action settles; these forms
  // submit from onSubmit so a refusal keeps them (the change audit's P12b).
  await page.goto("/account/flows");
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
  await page.goto("/account/flows");
  await automationCard(page, "Manual input automation")
    .getByRole("button", { name: "Set up" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Flow setup" });
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

test("a live flow that declares no run input offers no Run; Archive flow is confirmed, gives Add back, and lists it under Archived flows with the day (BUILD-PLAN 24.11.11, the owner's build 9)", async ({
  page,
}) => {
  // Backend §12.1 #169 and #92: archiving is how a workspace frees a plan
  // slot; #203: the archived ones are read by name.
  await page.goto("/account/flows");
  const card = automationCard(page, "Archivable automation");
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Run", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Archived flows" }),
  ).toHaveCount(0);
  const archive = card.getByRole("button", { name: "Archive flow" });
  await archive.click();
  const dialog = page.getByRole("dialog", {
    name: "Archive Archivable automation?",
  });
  await expect(dialog).toContainText(
    "It stops and moves to Archived flows. Its runs stay in Activity, and you can add it again later.",
  );
  await expectNoAxeViolations(page);
  // Cancel changes nothing and hands focus back to the control that opened it.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(archive).toBeFocused();
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await archive.click();
  await page
    .getByRole("dialog", { name: "Archive Archivable automation?" })
    .getByRole("button", { name: "Archive", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Add" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Archive flow" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Archived flows" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "An archived flow keeps its history here. Add it again any time.",
    ),
  ).toBeVisible();
  const archived = page
    .locator("main li")
    .filter({ hasText: "Archivable automation" });
  await expect(archived).toContainText("Whole workspace");
  await expect(archived).toContainText("Archived Sep 30, 2026");
});

test("Pause and Go live move a live subscription and back, and the card follows (register F38)", async ({
  page,
}) => {
  await page.goto("/account/flows");
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

test("a subscription pinned to an older version moves to the newest in place, confirmed first (backend §12.1 #126)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  const card = automationCard(page, "Webhook automation");
  await expect(card).toContainText("This runs v1; v2 is available.");
  const move = card.getByRole("button", { name: "Move to v2" });
  await move.click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await expect(dialog).toContainText(
    "New runs use v2; runs v1 already made are kept as they are.",
  );
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(move).toBeFocused();
  await move.click();
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // It runs the newest now, so nothing is offered to move to.
  await expect(card.getByText("This runs v1; v2 is available.")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Move to v2" })).toHaveCount(0);
  // The button went with the note it sat in; focus is on the card's heading,
  // not dropped on the page.
  await expect(
    card.getByRole("heading", { name: "Webhook automation" }),
  ).toBeFocused();
});

test("a move the platform holds for a pending approval is said in words, and the subscription stays where it was (backend §12.1 #126)", async ({
  page,
}) => {
  await fixtureControl("approval-pending-on-move");
  await page.goto("/account/flows");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "An approval for this flow is still waiting. Decide it first, then move.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(card).toContainText("This runs v1; v2 is available.");
});

test("a move refused while a run of the automation is still going is said in words, and the subscription stays where it was (backend §12.1 #126, 23.6.3)", async ({
  page,
}) => {
  await fixtureControl("runs-in-flight-on-move");
  await page.goto("/account/flows");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "A run of this flow is still going. Wait for it to finish, then move.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(card).toContainText("This runs v1; v2 is available.");
});

test("each refusal of a move the platform names is said in its words, one it does not name by its title, and the subscription stays where it was (backend §12.1 #126)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  const move = dialog.getByRole("button", { name: "Move to v2" });
  for (const [status, reason, words] of [
    [409, "version_unavailable", "That version is no longer available."],
    [409, "subscription_archived", "An archived flow cannot move."],
    [
      422,
      "invalid_config",
      "Its settings do not fit that version. Open Set up, fix them, then move.",
    ],
    [
      422,
      "unmet_connections",
      "That version needs an account this workspace has not connected. Connect it first, or pause the flow and move.",
    ],
    [
      422,
      "setup_incomplete",
      "That version needs a setting this flow does not have yet. Pause it, move, then finish Set up.",
    ],
    // A reason the website does not name reads as the platform's own title.
    [409, "a_reason_not_named_here", "Conflict"],
  ] as const) {
    await fixtureControl(`move-refused?status=${status}&reason=${reason}`);
    await move.click();
    await expect(dialog.getByRole("alert")).toHaveText(words);
    await expect(move).toBeEnabled();
  }
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(card).toContainText("This runs v1; v2 is available.");
});

test("a move's dialog cannot be dismissed while the platform decides, so its refusal is not lost (backend §12.1 #126)", async ({
  page,
}) => {
  await fixtureControl("approval-pending-on-move");
  await page.goto("/account/flows");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Move to v2" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  const move = await holdRequest(page, "**/account/flows", isServerAction);
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await move.arrived;
  // Neither Escape nor the backdrop closes it while the answer is on its way.
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  move.release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "An approval for this flow is still waiting. Decide it first, then move.",
  );
  // The refusal renders a moment before the transition ends (register F72): the
  // dialog is dismissible again once its buttons are.
  await expect(
    dialog.getByRole("button", { name: "Move to v2" }),
  ).toBeEnabled();
  // Answered, it closes as before.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a move's dialog closes on an Escape pressed the moment its answer enables Move again (register F72)", async ({
  page,
}) => {
  await fixtureControl("approval-pending-on-move");
  await page.goto("/account/flows");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Move to v2" })
    .click();
  const move = await holdRequest(page, "**/account/flows", isServerAction);
  await page
    .getByRole("dialog", { name: "Move Webhook automation to v2?" })
    .getByRole("button", { name: "Move to v2" })
    .click();
  await move.arrived;
  // Escape in the same moment React enables Move again, before any effect that
  // runs after the commit: the dialog must already be dismissible then.
  await page.evaluate(() => {
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    ].find((candidate) => candidate.textContent?.trim() === "Moving…");
    if (!button) throw new Error("the pending Move button is not shown");
    new MutationObserver((_, observer) => {
      if (button.disabled) return;
      observer.disconnect();
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    }).observe(button, { attributes: true, attributeFilter: ["disabled"] });
  });
  move.release();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("an owner makes a webhook automation's address, sees its secret once, and a new secret keeps the address (backend §12.1 #91, #109)", async ({
  page,
}) => {
  const address =
    "https://hooks.example.test/v1/webhooks/efefefef-efef-4fef-8fef-efefefefefef";
  await page.goto("/account/flows");
  const card = automationCard(page, "Webhook automation");
  // A manual automation has no address to give.
  await expect(
    automationCard(page, "Manual input automation").getByRole("button", {
      name: "Webhook address",
    }),
  ).toHaveCount(0);
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
  await page.goto("/account/flows");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Webhook address" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await expect(dialog.getByText("This flow has no address yet.")).toBeVisible();
  const issue = await holdRequest(page, "**/account/flows", isServerAction);
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
  await page.goto("/account/flows");
  await expect(
    automationCard(page, "Webhook automation").getByRole("button", {
      name: "Webhook address",
    }),
  ).toBeVisible();
  await presentSession(page, "member");
  await page.reload();
  const card = automationCard(page, "Webhook automation");
  await expect(card.getByRole("button", { name: "Move to v2" })).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Webhook address" }),
  ).toHaveCount(0);
});

test("a webhook address the platform will not read says so in its dialog, and offers nothing to make (backend §12.1 #91)", async ({
  page,
}) => {
  // A plain member is offered no address at all, so the owner's own read is
  // the one refused — as it is once they are no longer an admin — or failed.
  await page.goto("/account/flows");
  const open = automationCard(page, "Webhook automation").getByRole("button", {
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
  await page.goto("/account/flows");
  const open = automationCard(page, "Webhook automation").getByRole("button", {
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
  await page.goto("/account/flows");
  await automationCard(page, "Webhook automation")
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
  await page.goto("/account/flows");
  const open = automationCard(page, "Webhook automation").getByRole("button", {
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

// What the fixture's object store holds, read at the fixture: the run's page
// does not show the input it was started with.
function fixtureFiles() {
  return fixtureRead<{ filename: string; sizeBytes: number; runId?: string }[]>(
    "files",
  );
}

// The Run dialog of the manual automation, with its three typed fields filled.
async function openFilledRun(page: Page) {
  await page.goto("/account/flows");
  await automationCard(page, "Manual input automation")
    .getByRole("button", { name: "Run", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Run Manual input automation",
  });
  // Opened, the dialog puts focus on its first field; typing waits for it.
  await expect(dialog.getByLabel("Vendor")).toBeFocused();
  await dialog.getByLabel("Vendor").fill("Acme Supplies");
  await dialog.getByLabel("Amount").fill("120.50");
  await dialog.getByLabel("Invoice reference").fill("INV-1001");
  return dialog;
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

  test("a form closed mid-upload stops the upload, and opened again it is not held Uploading…", async ({
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
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await automationCard(page, "Manual input automation")
      .getByRole("button", { name: "Run", exact: true })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Start run" }),
    ).toBeEnabled();
    await expect(dialog.getByText(/Uploading/u)).toHaveCount(0);
    // The abandoned upload was stopped: letting it through lands nothing.
    put.release();
    // Opened, the dialog puts focus on its first field; typing waits for it.
    await expect(dialog.getByLabel("Vendor")).toBeFocused();
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
    await dialog.getByRole("button", { name: "Cancel" }).click();
    const second = await holdRequest(
      page,
      "https://127.0.0.1:3443/__fixture/objects/**",
      (request) => request.method() === "PUT",
    );
    await automationCard(page, "Manual input automation")
      .getByRole("button", { name: "Run", exact: true })
      .click();
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
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(page).toHaveURL(/\/account\/runs\/fixture-run-started$/);
    expect(await fixtureFiles()).toEqual([
      { filename: "invoice.pdf", sizeBytes: 24, runId: "fixture-run-started" },
    ]);
  });

  test("a file of a type the automation does not take is refused in words, and nothing is sent", async ({
    page,
  }) => {
    const puts = observe(
      page,
      (request) =>
        request.method() === "PUT" && request.url().includes("/__fixture/"),
    );
    const dialog = await openFilledRun(page);
    await dialog.getByLabel("Invoice file").setInputFiles({
      name: "invoice.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an invoice"),
    });
    await expect(dialog.getByRole("alert")).toHaveText(
      "This flow does not accept that type of file.",
    );
    expect(puts).toEqual([]);
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

  test("an empty file is refused in words before anything is sent, and the optional field says it is optional", async ({
    page,
  }) => {
    const sent = observe(page, (request) =>
      request.url().includes("/__fixture/objects/"),
    );
    const dialog = await openFilledRun(page);
    await expect(
      dialog.locator("label", { hasText: "Invoice file" }),
    ).toContainText("(optional)");
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
    const dialog = await openFilledRun(page);
    const file = dialog.getByLabel("Invoice file");
    for (const [stage, status, reason, words] of [
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
        "Go live first; a paused flow takes no files.",
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
      ["complete", 409, "a_reason_not_named_here", "Conflict"],
    ] as const) {
      await fixtureControl(
        `upload-refused?stage=${stage}&status=${status}&reason=${reason}`,
      );
      await file.setInputFiles(invoicePdf);
      await expect(dialog.getByRole("alert")).toHaveText(words);
      await expect(file).toHaveValue("");
      await expect(
        dialog.getByRole("button", { name: "Start run" }),
      ).toBeEnabled();
    }
    expect(await fixtureFiles()).toEqual([]);
  });

  test("the Run dialog dismissed by Escape or by a click outside it mid-upload closes, stops the upload, and opened again is not held Uploading…", async ({
    page,
  }) => {
    const dialog = await openFilledRun(page);
    const run = automationCard(page, "Manual input automation").getByRole(
      "button",
      { name: "Run", exact: true },
    );
    const held: Awaited<ReturnType<typeof holdRequest>>[] = [];
    for (const dismiss of [
      () => page.keyboard.press("Escape"),
      () => page.mouse.click(4, 4),
    ]) {
      const put = await holdRequest(
        page,
        "https://127.0.0.1:3443/__fixture/objects/**",
        (request) => request.method() === "PUT",
      );
      held.push(put);
      await dialog.getByLabel("Invoice file").setInputFiles(invoicePdf);
      await put.arrived;
      await dismiss();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await run.click();
      await expect(
        dialog.getByRole("button", { name: "Start run" }),
      ).toBeEnabled();
      await expect(dialog.getByText(/Uploading/u)).toHaveCount(0);
    }
    // The abandoned uploads were stopped: let through, neither lands.
    for (const put of held) put.release();
    await page.waitForTimeout(1_000);
    expect(await fixtureFiles()).toEqual([]);
    expect((await fixtureRead<{ storePuts: number }>("counts")).storePuts).toBe(
      0,
    );
  });
});

test("a ghost button keeps AA contrast when hovered and when pressed (register F64)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  const archive = automationCard(page, "Archivable automation").getByRole(
    "button",
    { name: "Archive flow" },
  );
  // Each state is measured once its transition has finished: the button from
  // pixels, the one measure the marketing test uses too (register F71), and the
  // rest of the page by axe.
  const contrast = () =>
    new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
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

test("a card lists each subscription under its team, and Add offers only the teams it is not in yet — never the whole workspace (register F21, the owner's build 10)", async ({
  page,
}) => {
  // A second team, so there is a choice to make: the fixture's general, and
  // Operations.
  await createOperationsTeam(page);

  await page.goto("/account/flows");
  // Already in the general team, as a draft: that row says where, and the only
  // team left to add it to is Operations — so there is nothing to choose.
  const planLimit = automationCard(page, "Plan-limit automation");
  await expect(
    planLimit.locator("p", { hasText: "Team: general" }),
  ).toBeVisible();
  await expect(planLimit.getByRole("combobox")).toHaveCount(0);
  await expect(planLimit.getByRole("button", { name: "Add" })).toBeVisible();

  // Added nowhere: both teams are offered, and the whole workspace is not.
  const card = automationCard(page, "Project automation");
  const where = card.getByRole("combobox", {
    name: "Where to add Project automation",
  });
  await expect(where.locator("option")).toHaveText([
    "Team: general",
    "Team: Operations",
  ]);
  await where.selectOption({ label: "Team: Operations" });
  await card.getByRole("button", { name: "Add" }).click();
  await expect(
    card.locator("p", { hasText: "Team: Operations" }),
  ).toBeVisible();
  // What was chosen is gone from the offer; Add now means the one team left —
  // the fixture answers 409 if Operations is sent again.
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.locator("p", { hasText: "Team: general" })).toBeVisible();
  // In every team: nothing is left to add, and the workspace was never a place.
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(card.locator("p", { hasText: "Whole workspace" })).toHaveCount(
    0,
  );
  await expect(card.getByRole("alert")).toHaveCount(0);
});

test("with no team yet, no flow can be added: an owner or admin is told to create a team first, with the way to Teams, and a plain member who does (the owner's build 10)", async ({
  page,
}) => {
  await fixtureControl("org-without-projects");
  await page.goto("/account/flows");
  const card = automationCard(page, "Project automation");
  await expect(card.getByText("Create a team first.")).toBeVisible();
  const create = card.getByRole("link", { name: "Create a team" });
  await expect(create).toHaveAttribute("href", "/account/teams");
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(card.getByRole("combobox")).toHaveCount(0);
  // Every card says it, the ones already added to the whole workspace included:
  // adding to a team is what needs one.
  const manual = automationCard(page, "Manual input automation");
  await expect(
    manual.locator("p", { hasText: "Whole workspace" }),
  ).toBeVisible();
  await expect(manual.getByText("Create a team first.")).toBeVisible();
  await expectNoAxeViolations(page);
  await create.click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await expect(
    page.locator("main").getByRole("heading", { name: "No teams yet" }),
  ).toBeVisible();

  // A plain member cannot make one, and is told who does — and offered nothing.
  await presentSession(page, "member");
  await page.goto("/account/flows");
  await expect(
    card.getByText("An owner or admin creates the first team."),
  ).toBeVisible();
  await expect(card.getByText("Create a team first.")).toHaveCount(0);
  await expect(card.getByRole("link", { name: "Create a team" })).toHaveCount(
    0,
  );
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("a plain member on no team, in an organization that has one, is told to ask to join it — not that the first team is still to be made (the owner's build 10; the change audit)", async ({
  page,
}) => {
  await fixtureControl("org-without-projects");
  await createOperationsTeam(page);
  await presentSession(page, "member");
  await page.goto("/account/flows");
  const card = automationCard(page, "Project automation");
  await expect(card.getByText("Ask to join a team first.")).toBeVisible();
  await expect(
    card.getByText("An owner or admin creates the first team."),
  ).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Add" })).toHaveCount(0);
  await expect(card.getByRole("combobox")).toHaveCount(0);
  await expectNoAxeViolations(page);
  const teams = card.getByRole("link", { name: "See teams" });
  await expect(teams).toHaveAttribute("href", "/account/teams");
  await teams.click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await expect(
    page.locator("main li").filter({ hasText: "Operations" }),
  ).toBeVisible();
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

test("a figure the platform cannot answer reads Unavailable, and the rest of the dashboard still shows", async ({
  page,
}) => {
  await fixtureControl("run-stats-failing");
  await page.goto("/account");
  const figure = (term: string) =>
    page
      .locator("dt", { hasText: term })
      .locator("xpath=following-sibling::dd[1]");
  await expect(figure("Runs this month")).toHaveText("Unavailable");
  await expect(figure("Flows")).toHaveText("4");
  await expect(figure("Integrations")).toHaveText("1");
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

test("the dashboard shows the workspace's own numbers and names its recent runs (register F54)", async ({
  page,
}) => {
  await page.goto("/account");
  const figure = (term: string) =>
    page
      .locator("dt", { hasText: term })
      .locator("xpath=following-sibling::dd[1]");
  // Four subscriptions that are not archived; the platform's tally of this
  // month's runs; the one connected integration.
  await expect(figure("Flows")).toHaveText("4");
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
    page.getByRole("link", { name: "Browse flows" }).first(),
  ).toHaveAttribute("href", "/account/flows");
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

test("Create a team is the kind alone, made where the person is working: Other opens a field, words too short are refused, and the team made opens its page, titled by its kind (BUILD-PLAN 24.11.11, the owner's build 9)", async ({
  page,
}) => {
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  // One line says where it goes; there is no picker, name or description.
  await expect(dialog).toContainText("In Fixture Organization.");
  await expect(dialog.getByRole("combobox")).toHaveCount(1);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  const kind = dialog.getByLabel("Kind of team", { exact: true });
  await expect(kind).toBeFocused();
  await expect(kind.locator("option")).toContainText([
    "HR",
    "Accounting",
    "Finance",
    "Legal",
    "Research",
    "Other",
  ]);
  await expect(dialog.getByLabel("What kind of team")).toHaveCount(0);
  await kind.selectOption("Other");
  const other = dialog.getByLabel("What kind of team");
  await expect(other).toBeVisible();
  await expect(other).toHaveAttribute("placeholder", "Facilities");
  await expect(other).toHaveAttribute("minlength", "2");
  await expect(other).toHaveAttribute("maxlength", "60");
  await expectNoAxeViolations(page);

  // Words that trim to nothing pass the field, and the server refuses them.
  await other.fill("   ");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Say what kind of team it is, in 2 to 60 characters.",
  );

  await other.fill("Facilities");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("dialog", { name: "Team created" })).toHaveText(
    /Your team is ready\. Add people on its page\./u,
  );
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/account\/teams\/55555550-/);
  // Titled by its kind, which is not said a second time under it.
  await expect(
    page.getByRole("heading", { name: "Facilities", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture Organization · You are its owner", {
      exact: true,
    }),
  ).toBeVisible();
  // The kind is sent as the team's name and its type.
  expect(await createdTeams()).toEqual([
    {
      workspaceId: organizationWorkspaceId,
      name: "Facilities",
      type: "Facilities",
    },
  ]);
});

test("Create a team closes on Escape, asks for the list once as Done does, and sends the kind picked (register F77)", async ({
  page,
}) => {
  const actions = observe(page, isServerAction);
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Finance");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(
    page.getByRole("dialog", { name: "Team created" }),
  ).toBeVisible();
  const before = actions.length;
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/\/account\/teams\/55555550-/);
  await expect(
    page.getByRole("heading", { name: "Finance", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Fixture Organization · You are its owner", {
      exact: true,
    }),
  ).toBeVisible();
  expect(actions.length - before).toBe(1);
});

test("the dashboard titles a team by its kind, and offers Create a team only to an owner or admin (the owner's build 9)", async ({
  page,
}) => {
  await page.goto("/account");
  const main = page.locator("main");
  // A team made before a team was its kind keeps a name at the platform; the
  // dashboard titles it by its kind, as every team list does.
  await expect(main.getByRole("link", { name: /general/ })).toBeVisible();
  await expect(main).not.toContainText("Fixture Project");

  // With no team, Create a team is the owner's and the admin's alone.
  await fixtureControl("org-without-projects");
  await page.goto("/account");
  await expect(main.getByText("No teams yet.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Create a team" })).toBeVisible();
  await presentSession(page, "member");
  await page.goto("/account");
  await expect(main.getByText("No teams yet.")).toBeVisible();
  await expect(main.getByRole("link", { name: "Create a team" })).toHaveCount(
    0,
  );
});

test("an organization with no team yet shows the empty screen, whose one Create a team makes its first in the organization being worked in (register F57, the owner's build 9)", async ({
  page,
}) => {
  await fixtureControl("org-without-projects");
  await page.goto("/account/teams");
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", { name: "No teams yet" }),
  ).toBeVisible();
  await expect(
    main.getByText("A team has its own flows and its own people."),
  ).toBeVisible();
  // The empty screen's Create is the only one: the top row's is not drawn.
  await expect(main.getByRole("button", { name: "Create a team" })).toHaveCount(
    1,
  );
  await expectNoAxeViolations(page);
  await main.getByRole("button", { name: "Create a team" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await expect(dialog).toContainText("In Fixture Organization.");
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Operations");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("heading", { name: "Operations", level: 1 }),
  ).toBeVisible();
  await page.goto("/account/teams");
  await expect(
    page.getByRole("heading", { name: "Fixture Organization" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Operations/ })).toBeVisible();
  await expect(main.getByRole("heading", { name: "No teams yet" })).toHaveCount(
    0,
  );
});

test("working in the personal workspace, a team is made there — named by its one line, with no one to add (the owner's build 9)", async ({
  page,
}) => {
  // Switched as the switcher does, through the platform's own operation — not
  // by the switcher itself, whose refresh a navigation can cancel (F73).
  const switched = await page
    .context()
    .request.patch("/api/platform/v1/session/active-workspace", {
      data: { workspaceId: personalWorkspaceId },
      headers: { origin: "http://127.0.0.1:3001" },
    });
  expect(switched.status()).toBe(200);
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await expect(dialog).toContainText("In your personal workspace.");
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Sales");
  await dialog.getByRole("button", { name: "Create team" }).click();
  const made = page.getByRole("dialog", { name: "Team created" });
  await expect(made).toContainText("Your team is ready.");
  await expect(made).not.toContainText("Add people");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("heading", { name: "Sales", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("Personal · You are its owner", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add members" })).toHaveCount(
    0,
  );
  expect(await createdTeams()).toEqual([
    { workspaceId: personalWorkspaceId, name: "Sales", type: "Sales" },
  ]);
});

test("a kind the workspace already has a team for is refused in words — whatever its case, the older team's own kind too — and nothing is made (build 10)", async ({
  page,
}) => {
  await page.goto("/account/teams");
  const create = page
    .locator("main")
    .getByRole("button", { name: "Create a team" });
  await create.click();
  let dialog = page.getByRole("dialog", { name: "Create a team" });
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Finance");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("heading", { name: "Finance", level: 1 }),
  ).toBeVisible();

  await page.goto("/account/teams");
  await create.click();
  dialog = page.getByRole("dialog", { name: "Create a team" });
  const kind = dialog.getByLabel("Kind of team", { exact: true });
  await kind.selectOption("Finance");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "This workspace already has a team for Finance.",
  );
  await kind.selectOption("Other");
  const other = dialog.getByLabel("What kind of team");
  for (const words of ["finance", "General"]) {
    await other.fill(words);
    await dialog.getByRole("button", { name: "Create team" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(
      `This workspace already has a team for ${words}.`,
    );
  }
  expect(await createdTeams()).toEqual([
    {
      workspaceId: organizationWorkspaceId,
      name: "Finance",
      type: "Finance",
    },
  ]);
});

test("a plain member of an organization is offered no Create a team; an admin is, and is refused in words once made a plain member with the dialog open (build 10)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto("/account/teams");
  await expect(page.getByRole("link", { name: /general/ })).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: "Create a team" }),
  ).toHaveCount(0);

  await presentSession(page, "admin");
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await dialog
    .getByLabel("Kind of team", { exact: true })
    .selectOption("Legal");
  await presentSession(page, "member");
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Only an owner or admin can create a team here.",
  );
  expect(await createdTeams()).toEqual([]);
});

test("Create a team on a page whose workspace was switched away in another tab says so, and creates nothing (register F57, F28)", async ({
  page,
  context,
}) => {
  await page.goto("/account/teams");
  await page
    .locator("main")
    .getByRole("button", { name: "Create a team" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Create a team" });
  await dialog.getByLabel("Kind of team", { exact: true }).selectOption("HR");
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
  await dialog.getByRole("button", { name: "Create team" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The active workspace changed in another tab. Reload this page before continuing.",
  );
  // Neither the organization the page showed nor the workspace now active.
  expect(await createdTeams()).toEqual([]);
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
    picker.getByText("Everyone in this organization is already on the team."),
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
    page.locator("main").getByRole("button", { name: "Leave team" }),
  ).toBeVisible();

  await presentSession(page, "admin");
  await page.goto(fixtureProject);
  await expect(
    page.getByText(
      "Fixture Organization · You see every team as an organization admin",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Asking to join" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add members" })).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: "Leave team" }),
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

test("Leave team's dialog gives focus back to Leave team when it closes (register F75)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(fixtureProject);
  const trigger = page
    .locator("main")
    .getByRole("button", { name: "Leave team" });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Leave “general”?",
  });
  await expect(dialog.getByLabel("Confirmation")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Leave team's dialog holds while the platform decides, and says its refusal (register F76)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(fixtureProject);
  await page
    .locator("main")
    .getByRole("button", { name: "Leave team" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Leave “general”?",
  });
  await dialog.getByLabel("Confirmation").fill("DELETE");
  const leave = await holdRequest(page, `**${fixtureProject}`, isServerAction);
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Leave team" }).click();
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
      name: /^(Connect|Reconnect|Disconnect|Replace account)$/,
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
