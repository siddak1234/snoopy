import { expect, test, type Page } from "@playwright/test";

const requesterUserId = "66666666-6666-4666-8666-666666666666";
const organizationWorkspaceId = "11111111-1111-4111-8111-111111111111";

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test("the pasted-key 409 retry preserves the original connection intent", async ({
  page,
}) => {
  const serverActionRequests: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") serverActionRequests.push(request.url());
  });
  await page.goto("/account/connections");
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.locator('input[name="idempotencyKey"]')).not.toHaveValue(
    "",
  );
  await page.getByLabel("API key").fill("fixture-value");
  await page.getByRole("button", { name: "Verify and connect" }).click();
  await expect(
    page.getByText("This request may still be in progress"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry verification" }).click();
  await expect.poll(() => serverActionRequests.length).toBe(2);
  await expect(page.getByText("Fixture account")).toBeVisible();
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

test("a live automation offers Pause and no manual run — the Run-now dialog is retired", async ({
  page,
}) => {
  // Paired with Pause so the card's presence is proved, not just the button's
  // absence: a card that failed to render would also have no "Run now".
  await page.goto("/account/automations");
  const card = page
    .getByRole("heading", { name: "Manual input automation" })
    .locator("xpath=../../..");
  await expect(card.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Run now" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

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
  // Restore the organization as active: later fixture tests depend on it.
  await trigger.click();
  await page.getByRole("button", { name: /Fixture Organization/ }).click();
  await expect(trigger).toContainText("Fixture Organization");
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

test("keyboard reaches dashboard navigation and preserves a visible focus target", async ({
  page,
}) => {
  await page.goto("/account/connections");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  // An earlier test connected the key provider, so its card now offers
  // "Reconnect" rather than "Connect".
  await page.getByRole("button", { name: "Reconnect", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Connect Fixture key provider" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Reconnect", exact: true }),
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
  // Runs while the workspace is still on the free floor (before the purchase
  // below). The organization is restored as active in `finally`, through the
  // same published operation the switcher uses, so a failure here cannot
  // leave every later fixture test on the personal workspace.
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
    const restored = await context.request.patch(
      "/api/platform/v1/session/active-workspace",
      {
        data: { workspaceId: organizationWorkspaceId },
        headers: { origin: "http://127.0.0.1:3001" },
      },
    );
    expect(restored.status()).toBe(200);
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
  await expect(page).toHaveURL(/\/login\?deleted=1$/);
});
