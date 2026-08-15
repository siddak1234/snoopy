import { expect, test } from "@playwright/test";

const requesterUserId = "66666666-6666-4666-8666-666666666666";

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
