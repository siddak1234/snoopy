import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page, type Request } from "@playwright/test";
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

test("a subscription pinned to an older version moves to the newest in place, confirmed first (backend §12.1 #126)", async ({
  page,
}) => {
  await page.goto("/account/automations");
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
  await page.goto("/account/automations");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "An approval for this automation is still waiting. Decide it first, then move.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(card).toContainText("This runs v1; v2 is available.");
});

test("a move refused while a run of the automation is still going is said in words, and the subscription stays where it was (backend §12.1 #126, 23.6.3)", async ({
  page,
}) => {
  await fixtureControl("runs-in-flight-on-move");
  await page.goto("/account/automations");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "A run of this automation is still going. Wait for it to finish, then move.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(card).toContainText("This runs v1; v2 is available.");
});

test("each refusal of a move the platform names is said in its words, one it does not name by its title, and the subscription stays where it was (backend §12.1 #126)", async ({
  page,
}) => {
  await page.goto("/account/automations");
  const card = automationCard(page, "Webhook automation");
  await card.getByRole("button", { name: "Move to v2" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  const move = dialog.getByRole("button", { name: "Move to v2" });
  for (const [status, reason, words] of [
    [409, "version_unavailable", "That version is no longer available."],
    [409, "subscription_archived", "An archived automation cannot move."],
    [
      422,
      "invalid_config",
      "Its settings do not fit that version. Open Set up, fix them, then move.",
    ],
    [
      422,
      "unmet_connections",
      "That version needs an account this workspace has not connected. Connect it first, or pause the automation and move.",
    ],
    [
      422,
      "setup_incomplete",
      "That version needs a setting this automation does not have yet. Pause it, move, then finish Set up.",
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
  await page.goto("/account/automations");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Move to v2" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Move Webhook automation to v2?",
  });
  const move = await holdRequest(
    page,
    "**/account/automations",
    isServerAction,
  );
  await dialog.getByRole("button", { name: "Move to v2" }).click();
  await move.arrived;
  // Neither Escape nor the backdrop closes it while the answer is on its way.
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  move.release();
  await expect(dialog.getByRole("alert")).toHaveText(
    "An approval for this automation is still waiting. Decide it first, then move.",
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
  await page.goto("/account/automations");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Move to v2" })
    .click();
  const move = await holdRequest(
    page,
    "**/account/automations",
    isServerAction,
  );
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
  await page.goto("/account/automations");
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
  await expect(
    dialog.getByText("This automation has no address yet."),
  ).toBeVisible();
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
  await page.goto("/account/automations");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Webhook address" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await expect(
    dialog.getByText("This automation has no address yet."),
  ).toBeVisible();
  const issue = await holdRequest(
    page,
    "**/account/automations",
    isServerAction,
  );
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
  await page.goto("/account/automations");
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
  await page.goto("/account/automations");
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
  await page.goto("/account/automations");
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
  await page.goto("/account/automations");
  await automationCard(page, "Webhook automation")
    .getByRole("button", { name: "Webhook address" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Webhook address" });
  await expect(
    dialog.getByText("This automation has no address yet."),
  ).toBeVisible();
  const create = dialog.getByRole("button", { name: "Create address" });
  for (const [reason, words] of [
    ["trigger_kind_mismatch", "This automation is not started by a webhook."],
    ["subscription_archived", "An archived automation has no address."],
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
  await page.goto("/account/automations");
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
  await page.goto("/account/automations");
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
      "This automation does not accept that type of file.",
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
        "The file is larger than this automation accepts.",
      ],
      [
        "open",
        409,
        "subscription_not_live",
        "Go live first; a paused automation takes no files.",
      ],
      ["open", 409, "no_file_input", "This automation does not take a file."],
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
        "The file is larger than this automation accepts.",
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
  await page.goto("/account/automations");
  const archive = automationCard(page, "Archivable automation").getByRole(
    "button",
    { name: "Archive" },
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
  await expect(figure("Automations")).toHaveText("4");
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
  await expect(figure("Automations")).toHaveText("4");
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
});

test("taking someone off a team is confirmed first, a refusal keeps them on it, and the team's list follows (backend §12.1 #174)", async ({
  page,
}) => {
  await page.goto(operationsTeam);
  const members = page.locator("main li");
  await expect(members).toHaveCount(1);
  const remove = members
    .filter({ hasText: "Fixture Member" })
    .getByRole("button", { name: "Remove" });
  await remove.click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Fixture Member from Operations?",
  });
  await expect(dialog).toContainText(
    "They lose any project access the team gave them.",
  );
  await expectNoAxeViolations(page);
  // Cancel changes nothing and hands focus back.
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(remove).toBeFocused();
  await expect(members).toHaveCount(1);
  // A refusal is said in the dialog, and the person is still on the team.
  await remove.click();
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(busy);
  await presentSession(page, "owner");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("No one is on this team yet.")).toBeVisible();
  // The row took its button with it; focus is on the list's heading, not
  // dropped on the page.
  await expect(page.getByRole("heading", { name: "Members" })).toBeFocused();
});

test("a removal's dialog cannot be dismissed while the platform decides, so its refusal is not lost (backend §12.1 #174)", async ({
  page,
}) => {
  await page.goto(operationsTeam);
  await page
    .locator("main li")
    .filter({ hasText: "Fixture Member" })
    .getByRole("button", { name: "Remove" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Fixture Member from Operations?",
  });
  const removal = await holdRequest(
    page,
    `**${operationsTeam}`,
    isServerAction,
  );
  await presentSession(page, "throttled");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await removal.arrived;
  await page.keyboard.press("Escape");
  await page.mouse.click(4, 4);
  await expect(dialog).toBeVisible();
  removal.release();
  await expect(dialog.getByRole("alert")).toHaveText(busy);
});

test("a team's manager who takes themselves off it goes back to their teams, not to a page they can no longer see (backend §12.1 #174)", async ({
  page,
}) => {
  // A plain member sees a team only while on it.
  await presentSession(page, "member");
  await page.goto(operationsTeam);
  await page
    .locator("main li")
    .filter({ hasText: "Fixture Member" })
    .getByRole("button", { name: "Remove" })
    .click();
  await page
    .getByRole("dialog", { name: "Remove Fixture Member from Operations?" })
    .getByRole("button", { name: "Remove" })
    .click();
  await expect(page).toHaveURL(/\/account\/teams$/);
  await expect(page.getByText("You are not on a team yet.")).toBeVisible();
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

test("a project's owner removes a team's access, confirmed first, and a plain member on the project is offered no removal (backend §12.1 #174)", async ({
  page,
}) => {
  const project = "/account/projects/33333333-3333-4333-8333-333333333333";
  await page.goto(project);
  await page
    .getByLabel("Team", { exact: true })
    .selectOption({ label: "Operations" });
  await page.getByLabel("Role on this project").selectOption("member");
  await page.getByRole("button", { name: "Give access" }).click();
  const granted = page.locator("main li").filter({ hasText: "Operations" });
  await expect(granted).toContainText(/member/i);

  // A plain member reads the grant and is offered nothing to change it.
  await presentSession(page, "member");
  await page.reload();
  await expect(granted).toContainText(/member/i);
  await expect(granted.getByRole("button", { name: "Remove" })).toHaveCount(0);

  await presentSession(page, "owner");
  await page.reload();
  await granted.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Operations's access to Fixture Project?",
  });
  await expect(dialog).toContainText(
    "Its members keep any access they hold on their own.",
  );
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Remove access" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("No team has access to this project."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Teams with access" }),
  ).toBeFocused();
});

test("a team's access the platform will not withdraw stays — a busy platform, and a project no longer found, are said in the dialog (backend §12.1 #174)", async ({
  page,
}) => {
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await page
    .getByLabel("Team", { exact: true })
    .selectOption({ label: "Operations" });
  await page.getByLabel("Role on this project").selectOption("member");
  await page.getByRole("button", { name: "Give access" }).click();
  const granted = page.locator("main li").filter({ hasText: "Operations" });
  await expect(granted).toContainText(/member/i);
  await granted.getByRole("button", { name: "Remove" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Remove Operations's access to Fixture Project?",
  });
  const remove = dialog.getByRole("button", { name: "Remove access" });
  await presentSession(page, "throttled");
  await remove.click();
  await expect(dialog.getByRole("alert")).toHaveText(busy);
  // The project gone from every list the person can read.
  await presentSession(page, "owner");
  await fixtureControl("org-without-projects");
  await remove.click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "The project is unavailable.",
  );
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Read at the platform: the grant was never withdrawn.
  expect(
    (await fixtureRead<{ projectTeamGrants: number }>("counts"))
      .projectTeamGrants,
  ).toBe(1);
});

test("anyone on a project reads the teams granted to it, and only its owner or admin is offered the grant (backend ADR-0010)", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await expect(
    page.getByRole("heading", { name: "Teams with access" }),
  ).toBeVisible();
  await expect(
    page.getByText("No team has access to this project."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Give access" })).toHaveCount(
    0,
  );
});

test("an organization with no team yet tells its owner where teams are made, not which teams they can see", async ({
  page,
}) => {
  await fixtureControl("org-without-teams");
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await expect(
    page.getByText("This organization has no teams yet."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Teams page" })).toHaveAttribute(
    "href",
    "/account/teams",
  );
  await expect(page.getByText("the teams you are on")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Give access" })).toHaveCount(
    0,
  );
});

test("an organization with no project yet creates its first team project, in the organization being worked in (register F57)", async ({
  page,
}) => {
  await fixtureControl("org-without-projects");
  await page.goto("/account/projects");
  await expect(page.getByText("No projects yet.")).toBeVisible();
  await page.getByRole("button", { name: "Create project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /team/i })).toBeEnabled();
  await dialog
    .locator("label")
    .filter({ hasText: /^\s*team\s*$/i })
    .click();
  await expect(
    dialog.getByText("Created in Fixture Organization."),
  ).toBeVisible();
  await dialog.getByLabel(/Project name/).fill("First team project");
  await dialog.getByLabel(/Project type/).fill("Invoices");
  await dialog.getByRole("button", { name: "Create project" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture Organization Team Projects" }),
  ).toBeVisible();
  await expect(page.getByText("First team project")).toBeVisible();
});

test("working in a personal workspace, a team project is not offered until the organization is (register F57)", async ({
  page,
}) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  await page.goto("/account/projects");
  await page.getByRole("button", { name: "Create project" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("radio", { name: /team/i })).toBeDisabled();
  await expect(
    dialog.getByText(
      "Switch to your organization to create a team project in it.",
    ),
  ).toBeVisible();
});

test("Create team on a page whose workspace was switched away in another tab says so, and creates nothing", async ({
  page,
  context,
}) => {
  await page.goto("/account/teams");
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
  await page.getByLabel("Team name").fill("Stale tab team");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "The active workspace changed in another tab. Reload this page before continuing.",
  );
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Organization/ }).click();
  await expect(trigger).toContainText("Fixture Organization");
  await page.goto("/account/teams");
  await expect(page.getByRole("link", { name: "Operations" })).toBeVisible();
  await expect(page.getByText("Stale tab team")).toHaveCount(0);
});

test("a grant on a project from a workspace that is not the active one goes to the project's own workspace", async ({
  page,
}) => {
  await page.goto("/account");
  const trigger = page.getByRole("button", { name: "Switch workspace" });
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Personal/ }).click();
  await expect(trigger).toContainText("Fixture Personal");
  await page.goto("/account/projects/33333333-3333-4333-8333-333333333333");
  await page
    .getByLabel("Team", { exact: true })
    .selectOption({ label: "Operations" });
  await page.getByLabel("Role on this project").selectOption("member");
  await page.getByRole("button", { name: "Give access" }).click();
  await expect(
    page.locator("main li").filter({ hasText: "Operations" }),
  ).toContainText(/member/i);
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
    page.getByRole("button", { name: /^(Prepare export|Export everything)$/ }),
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
