import { expect, test, type Page } from "@playwright/test";
import {
  FLOWS,
  automationCard,
  connectionRow,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  presentSession,
  runForm,
} from "./helpers";

/**
 * Round 21, Stage 2 on the website, against the loopback fixture Edge, reset
 * before each test (its surfaces: `e2e/fixtures/health-data.ts`): the health
 * data agreement on Add and on Start run (backend ADR-0049, C3) — the dialog
 * for the workspace's owner, the one line for anyone else, the add or run
 * sent again under the refused one's key — and the organization's Documents
 * and one signed copy; and Connect your EHR (ADR-0050, D1): the key form with
 * the clinic's FHIR address, a vendor picker only for two or more vendors,
 * each refusal in words, and the row named by the clinic's host. Every word
 * is the spec's (`lib/health-agreement.ts`, `lib/smart-backend.ts`) or the
 * platform's (the provider's own fields).
 */

test.use({ storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE });
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test.beforeEach(async () => {
  await fixtureControl("reset");
});

type Health = {
  healthRequests: {
    path: "subscriptions" | "runs";
    key: string | null;
    accepted: boolean;
  }[];
  acceptances: { key: string | null; body: Record<string, unknown> }[];
  ehrConnects: { key: string | null; credentials: Record<string, unknown> }[];
};
const health = async () =>
  (await fixtureRead<{ health: Health }>("counts")).health;

const ASK_OWNER =
  "Ask your workspace owner to accept the health data agreement.";

/** The dialog, open. */
const agreement = (page: Page) =>
  page.getByRole("dialog", { name: "Health data agreement" });

/** Reads, ticks and signs the open dialog, then presses its button. */
async function accept(page: Page, button: string) {
  const dialog = agreement(page);
  await dialog
    .getByRole("checkbox", {
      name: "I'm authorized to sign for Fixture Organization",
    })
    .check();
  await dialog.getByLabel("Full name").fill("Dana Owner");
  await dialog.getByLabel("Title", { exact: true }).fill("Practice manager");
  await dialog.getByRole("button", { name: button }).click();
}

test("C3: the owner's Add of a flow that carries health data opens the agreement — its title, Version 1, the text to scroll, the checkbox, Full name and Title — and Accept and add flow signs once and adds it under the refused add's key, then Set up opens", async ({
  page,
}) => {
  await fixtureControl("health-data");
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  await automationCard(page, "Invoice Processing")
    .getByRole("button", { name: "Add" })
    .click();
  const dialog = agreement(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Version 1");
  const text = dialog.getByRole("region", { name: "Health data agreement" });
  await expect(text).toContainText("Business Associate Agreement");
  await expect(text).toContainText("{Covered Entity}");
  // Nothing was added, and the page says nothing else of it.
  await expect(page.getByText(ASK_OWNER)).toHaveCount(0);
  await expectNoAxeViolations(page);
  await accept(page, "Accept and add flow");
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}/setup$`, "u"));
  const seen = await health();
  expect(seen.acceptances).toHaveLength(1);
  expect(seen.acceptances[0].body).toMatchObject({
    kind: "health-data",
    version: 1,
    signerName: "Dana Owner",
    signerTitle: "Practice manager",
    authorized: true,
  });
  expect(
    seen.healthRequests.map(({ path, accepted }) => [path, accepted]),
  ).toEqual([
    ["subscriptions", false],
    ["subscriptions", true],
  ]);
  const [refused, repeated] = seen.healthRequests;
  expect(refused.key).toMatch(/^subscribe-/u);
  expect(repeated.key).toBe(refused.key);
});

test("C3: an admin's Add of it is refused in the one line — no dialog, nothing more sent", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await fixtureControl("health-data");
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  const card = automationCard(page, "Invoice Processing");
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.getByRole("alert")).toHaveText(ASK_OWNER);
  await expect(agreement(page)).toHaveCount(0);
  expect((await health()).healthRequests).toHaveLength(1);
});

test("C3: before a version is published, the owner's Add says so and opens nothing", async ({
  page,
}) => {
  await fixtureControl("agreement-unpublished");
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  const card = automationCard(page, "Invoice Processing");
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.getByRole("alert")).toHaveText(
    "The health data agreement isn't available yet.",
  );
  await expect(agreement(page)).toHaveCount(0);
});

/** Fills the manual flow's run form, as the other run tests do. */
async function fillRun(page: Page) {
  const form = runForm(page);
  await form.getByLabel("Vendor").fill("Acme Supplies");
  await form.getByLabel("Amount").fill("10");
  await form.getByLabel("Invoice reference").fill("R-1");
  return form;
}

test("C3-b: the owner's Start run of it opens the agreement, and Accept and start run starts the same run under the same key, then its page opens", async ({
  page,
}) => {
  await fixtureControl("health-data");
  await page.goto(FLOWS.manual);
  const form = await fillRun(page);
  await form.getByRole("button", { name: "Start run" }).click();
  await expect(agreement(page)).toBeVisible();
  await accept(page, "Accept and start run");
  await expect(page).toHaveURL(/\/account\/runs\/[^/]+$/u);
  const seen = await health();
  expect(seen.acceptances).toHaveLength(1);
  expect(
    seen.healthRequests.map(({ path, accepted }) => [path, accepted]),
  ).toEqual([
    ["runs", false],
    ["runs", true],
  ]);
  expect(seen.healthRequests[1].key).toBe(seen.healthRequests[0].key);
  const starts =
    await fixtureRead<{ key: string; status: number }[]>("run-starts");
  expect(starts.map(({ key }) => key)).toEqual([seen.healthRequests[0].key]);
});

test("C3-b: a member's Start run of it is refused in the one line, the form kept", async ({
  page,
}) => {
  await presentSession(page, "member");
  await fixtureControl("health-data");
  await page.goto(FLOWS.manual);
  const form = await fillRun(page);
  await form.getByRole("button", { name: "Start run" }).click();
  await expect(form.getByRole("alert")).toHaveText(ASK_OWNER);
  await expect(agreement(page)).toHaveCount(0);
  await expect(form.getByLabel("Vendor")).toHaveValue("Acme Supplies");
});

test("C3: the organization's Documents list each signed document — Business Associate Agreement · Version 1, Accepted by its signer on the day — and one opens its signed copy, headed the same, with the way back", async ({
  page,
}) => {
  await page.goto("/account/organization");
  const list = page.getByTestId("org-documents");
  await expect(
    page.getByRole("heading", { name: "Documents", exact: true }),
  ).toBeVisible();
  const row = list.getByRole("link");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Business Associate Agreement · Version 1");
  await expect(row).toContainText("Accepted by Fixture Owner on Aug 12, 2026");
  await row.click();
  await expect(page).toHaveURL(
    /\/account\/organization\/documents\/d0c0d0c0-d0c0-4d0c-8d0c-d0c0d0c0d0c0$/u,
  );
  const main = page.locator("main");
  await expect(
    main.getByRole("heading", {
      name: "Business Associate Agreement · Version 1",
      level: 1,
    }),
  ).toBeVisible();
  await expect(main).toContainText("Accepted by Fixture Owner on Aug 12, 2026");
  const copy = page.getByTestId("document-copy");
  await expect(copy).toContainText(
    "This agreement is between Fixture Organization and Autom8x",
  );
  await expect(copy).toContainText(
    "Authorized to sign for Fixture Organization.",
  );
  await expectNoAxeViolations(page);
  await main.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/account\/organization$/u);
});

test("C3: with none signed, Documents says No documents yet.; a document of another workspace is not found", async ({
  page,
}) => {
  await fixtureControl("documents-none");
  await page.goto("/account/organization");
  await expect(
    page.getByText("No documents yet.", { exact: true }),
  ).toBeVisible();
  const response = await page.goto(
    "/account/organization/documents/d0c0d0c0-d0c0-4d0c-8d0c-d0c0d0c0d0c0",
  );
  expect(response?.status()).toBe(404);
});

test("C3: the owner's acceptance is the newest of the Documents", async ({
  page,
}) => {
  await fixtureControl("health-data");
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  await automationCard(page, "Invoice Processing")
    .getByRole("button", { name: "Add" })
    .click();
  await accept(page, "Accept and add flow");
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}/setup$`, "u"));
  await page.goto("/account/organization");
  const rows = page.getByTestId("org-documents").getByRole("link");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Accepted by Dana Owner");
});

/** Connections' EHR row, its Connect pressed: the key form, open. */
async function openEhrForm(page: Page) {
  await page.goto("/account/connections");
  await connectionRow(page, "ehr-fhir")
    .getByRole("button", { name: "Connect EHR" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect EHR" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("D1: with two vendors, the EHR's Connect opens the key form — a picker of Epic (test system) and Epic, the FHIR address with its help — and Verify and connect sends the vendor picked and the address; the row then names the clinic's host", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=2");
  const dialog = await openEhrForm(page);
  const vendors = dialog.getByRole("radiogroup", { name: "EHR" });
  await expect(vendors.getByRole("radio")).toHaveCount(2);
  await expect(vendors).toContainText("Epic (test system)");
  await expect(dialog).toContainText("Your EHR team gives you this address.");
  await expectNoAxeViolations(page);
  await vendors.getByRole("radio", { name: "Epic", exact: true }).check();
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.clinic.example.test/api/FHIR/R4");
  await dialog.getByRole("button", { name: "Verify and connect" }).click();
  await expect(dialog).toHaveCount(0);
  const row = connectionRow(page, "ehr-fhir");
  await expect(row).toContainText("fhir.clinic.example.test");
  await expect(
    row.getByRole("button", { name: "Disconnect EHR" }),
  ).toBeVisible();
  expect(
    (await health()).ehrConnects.map(({ credentials }) => credentials),
  ).toEqual([
    {
      vendor: "epic",
      fhirBaseUrl: "https://fhir.clinic.example.test/api/FHIR/R4",
    },
  ]);
});

test("D1: with one vendor there is no picker, and that vendor is sent unseen", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  const dialog = await openEhrForm(page);
  await expect(dialog.getByRole("radiogroup")).toHaveCount(0);
  await expect(dialog.getByRole("radio")).toHaveCount(0);
  await dialog
    .getByLabel("FHIR address")
    .fill("https://fhir.clinic.example.test/api/FHIR/R4");
  await dialog.getByRole("button", { name: "Verify and connect" }).click();
  await expect(connectionRow(page, "ehr-fhir")).toContainText(
    "fhir.clinic.example.test",
  );
  expect((await health()).ehrConnects[0].credentials.vendor).toBe("epic-test");
});

test("D1: each address the EHR's connect will not use is said in its words, in the form, which keeps what was typed", async ({
  page,
}) => {
  await fixtureControl("ehr-offered?vendors=1");
  const dialog = await openEhrForm(page);
  const address = dialog.getByLabel("FHIR address");
  for (const [typed, said] of [
    [
      "http://fhir.clinic.example.test/api/FHIR/R4",
      "Use the https address your EHR team gave you.",
    ],
    [
      "https://silent.example.test/fhir",
      "That address didn't answer as a FHIR server.",
    ],
    [
      "https://inactive.example.test/fhir",
      "Your EHR hasn't turned on Autom8x yet. Ask your EHR team to activate it.",
    ],
  ]) {
    await address.fill(typed);
    await dialog.getByRole("button", { name: "Verify and connect" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(said);
    await expect(address).toHaveValue(typed);
  }
  await expect(connectionRow(page, "ehr-fhir")).toContainText("Not connected");
});
