import { expect, test, type Page } from "@playwright/test";
import {
  FLOWS,
  automationCard,
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  presentSession,
  runForm,
} from "./helpers";

/**
 * Round 21, Stage 2 on the website, against the loopback fixture Edge, reset
 * before each test (its surfaces: `e2e/fixtures/health-data.ts`): the health
 * data agreement in Set up's "Contract and accept" (builds 37 and 39, wave 2;
 * backend ADR-0049 amendment 2) — an Add that opens Set up, every state of
 * the section, the owner's one press that accepts then turns on — and on
 * Start run and an item's upload (C3) — the dialog for the workspace's owner,
 * the one line for anyone else, the run or item sent again under the refused
 * one's key — the organization's Documents and one signed copy, and a batch
 * run's steps by name (wave 2, item 10). Connect your EHR (ADR-0050, D1) is
 * `e2e/ehr-connect.spec.ts`. Every word is the spec's
 * (`lib/health-agreement.ts`).
 */

// An item's file goes straight to the fixture's object store, whose
// certificate is the fixture's own, as e2e/flow-items.spec.ts's do.
test.use({
  storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE,
  ignoreHTTPSErrors: true,
});
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

test.beforeEach(async () => {
  await fixtureControl("reset");
});

type Health = {
  healthRequests: {
    path: "subscriptions" | "runs" | "items";
    key: string | null;
    accepted: boolean;
  }[];
  acceptances: { key: string | null; body: Record<string, unknown> }[];
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

/** Adds Invoice Processing, the flow that carries health data here, and lands on its Set up. */
async function addToSetup(page: Page) {
  await fixtureControl("invoice-not-added");
  await page.goto("/account/flows");
  await automationCard(page, "Invoice Processing")
    .getByRole("button", { name: "Add" })
    .click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}/setup$`, "u"));
  await expect(agreement(page)).toHaveCount(0);
  return page.getByTestId("setup-contract");
}

const turnOn = (page: Page) =>
  page.locator("main").getByRole("button", { name: "Turn on" });

/** Ticks the box and fills the two fields of Set up's section. */
async function sign(section: ReturnType<Page["getByTestId"]>) {
  await section
    .getByRole("checkbox", {
      name: "I'm authorized to sign for Fixture Organization",
    })
    .check();
  await section.getByLabel("Full name").fill("Dana Owner");
  await section.getByLabel("Title", { exact: true }).fill("Practice manager");
}

test("wave 2: the owner's Add of a flow that carries health data opens Set up — no dialog, nothing refused — and its 03 Contract and accept shows the text, its organization and today filled, the box, Full name and Title; Turn on waits for all three", async ({
  page,
}) => {
  await fixtureControl("health-data");
  const section = await addToSetup(page);
  await expect(section.getByText("03", { exact: true })).toBeVisible();
  await expect(
    section.getByRole("heading", { name: "Contract and accept", level: 3 }),
  ).toBeVisible();
  const text = section.getByRole("region", { name: "Health data agreement" });
  await expect(text).toContainText(
    /This agreement is between Fixture Organization and Autom8x, effective \d{4}-\d{2}-\d{2}\./u,
  );
  await expect(text).not.toContainText("{Covered Entity}");
  await expectNoAxeViolations(page);
  // Each of the three alone, or two of them, leaves Turn on disabled.
  await expect(turnOn(page)).toBeDisabled();
  const box = section.getByRole("checkbox", {
    name: "I'm authorized to sign for Fixture Organization",
  });
  await box.check();
  await expect(turnOn(page)).toBeDisabled();
  await section.getByLabel("Full name").fill("Dana Owner");
  await expect(turnOn(page)).toBeDisabled();
  await section.getByLabel("Title", { exact: true }).fill("Practice manager");
  await expect(turnOn(page)).toBeEnabled();
  await box.uncheck();
  await expect(turnOn(page)).toBeDisabled();
  expect((await health()).healthRequests).toEqual([]);
});

test("wave 2: the owner's one press of Turn on accepts first — the version, the text's hash, the name, the title, authorized, under its key — then turns the flow on, and its page opens", async ({
  page,
}) => {
  await fixtureControl("health-data");
  const section = await addToSetup(page);
  await sign(section);
  await turnOn(page).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  const seen = await health();
  expect(seen.acceptances).toHaveLength(1);
  expect(seen.acceptances[0].key).toMatch(/^agreement-/u);
  expect(seen.acceptances[0].body).toMatchObject({
    kind: "health-data",
    version: 1,
    signerName: "Dana Owner",
    signerTitle: "Practice manager",
    authorized: true,
  });
  // The acceptance was taken before the turn-on reached the platform.
  expect(
    seen.healthRequests.map(({ path, accepted }) => [path, accepted]),
  ).toEqual([["turn-on", true]]);
});

test("wave 2: accepted once — a press after the turn-on was refused sends the turn-on alone, and the agreement is signed once", async ({
  page,
}) => {
  await fixtureControl("agreement-repeat-refused-once");
  const section = await addToSetup(page);
  await sign(section);
  await turnOn(page).click();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Could not turn it on. Try again.",
  );
  await expect(section).toContainText("Accepted · Version 1 ·");
  await expect(section).toContainText("Dana Owner, Practice manager");
  await turnOn(page).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  const seen = await health();
  expect(seen.acceptances).toHaveLength(1);
  expect(seen.healthRequests.map(({ accepted }) => accepted)).toEqual([
    true,
    true,
  ]);
});

test("wave 2: a text changed since it was read (409) is read again — the box unticked, the name and title kept, nothing turned on; ticked again, one press accepts and turns on", async ({
  page,
}) => {
  await fixtureControl("agreement-changed-once");
  const section = await addToSetup(page);
  await sign(section);
  await turnOn(page).click();
  const box = section.getByRole("checkbox", {
    name: "I'm authorized to sign for Fixture Organization",
  });
  await expect(box).not.toBeChecked();
  await expect(section.getByLabel("Full name")).toHaveValue("Dana Owner");
  await expect(turnOn(page)).toBeDisabled();
  expect((await health()).healthRequests).toEqual([]);
  await box.check();
  await turnOn(page).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  expect((await health()).acceptances).toHaveLength(1);
});

test("wave 2: before a version is published, Set up says The agreement is being finalized. and Turn on stays disabled", async ({
  page,
}) => {
  await fixtureControl("agreement-unpublished");
  const section = await addToSetup(page);
  await expect(section).toContainText("The agreement is being finalized.");
  await expect(
    section.getByRole("region", { name: "Health data agreement" }),
  ).toHaveCount(0);
  await expect(turnOn(page)).toBeDisabled();
});

test("wave 2: once accepted, Set up says Accepted · Version 1 · its day and its signer, and Turn on turns it on with nothing more signed", async ({
  page,
}) => {
  await fixtureControl("agreement-accepted");
  const section = await addToSetup(page);
  await expect(section).toContainText("Accepted · Version 1 · Aug 12, 2026");
  await expect(section).toContainText("Fixture Owner, Owner");
  await expect(section.getByRole("checkbox")).toHaveCount(0);
  await turnOn(page).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  const seen = await health();
  expect(seen.acceptances).toHaveLength(0);
  expect(seen.healthRequests.map(({ path }) => path)).toEqual(["turn-on"]);
});

test("wave 2: an admin's Set up asks the owner in the section, and Turn on stays disabled", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await fixtureControl("health-data");
  const section = await addToSetup(page);
  await expect(section).toContainText(ASK_OWNER);
  await expect(section.getByRole("checkbox")).toHaveCount(0);
  await expect(turnOn(page)).toBeDisabled();
});

test("wave 2: a member's Set up of it asks the owner, never read, with no Turn on", async ({
  page,
}) => {
  await fixtureControl("health-data");
  await addToSetup(page);
  await presentSession(page, "member");
  await page.reload();
  const section = page.getByTestId("setup-contract");
  await expect(section).toContainText(ASK_OWNER);
  await expect(turnOn(page)).toHaveCount(0);
  await expect(
    page.getByText("Only an owner or admin can change this flow."),
  ).toBeVisible();
});

test("wave 2: a read that fails says Unavailable in the section, the rest of Set up drawn, and Turn on stays disabled", async ({
  page,
}) => {
  await fixtureControl("agreement-read-failing");
  const section = await addToSetup(page);
  await expect(section).toContainText("Unavailable");
  await expect(page.locator("main").getByLabel("Approval limit")).toBeVisible();
  await expect(turnOn(page)).toBeDisabled();
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

/** The made-up flow with items (e2e/flow-items.spec.ts's): its upload card, named and its file ready. */
async function readyUpload(page: Page) {
  await fixtureControl("items-flow");
  await page.goto("/account/flows/b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1");
  await page.getByRole("button", { name: "Upload batch" }).click();
  const card = page.getByTestId("item-upload");
  // The file first: "Ready" is drawn by the card's own state, so the page is hydrated before
  // Name is typed. Typed first, Firefox once lost it to hydration (Stage 2 audit, 2026-11-04).
  await card.getByLabel("Batch file").setInputFiles({
    name: "entry.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 fixture entry"),
  });
  await expect(card.getByText(/^Ready: entry\.pdf/u)).toBeVisible();
  const name = card.getByLabel("Name");
  await name.fill("Health list");
  await expect(name).toHaveValue("Health list");
  return card;
}

test("C3-b: the owner's upload of an item to a flow that carries health data opens the agreement over the card, and Accept and start run makes the same item under the same key", async ({
  page,
}) => {
  await fixtureControl("health-data");
  const card = await readyUpload(page);
  await card.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(agreement(page)).toBeVisible();
  await expect(card.getByText(ASK_OWNER)).toHaveCount(0);
  await accept(page, "Accept and start run");
  await expect(agreement(page)).toHaveCount(0);
  await expect(card).toHaveCount(0);
  const seen = await health();
  expect(seen.acceptances).toHaveLength(1);
  expect(
    seen.healthRequests.map(({ path, accepted }) => [path, accepted]),
  ).toEqual([
    ["items", false],
    ["items", true],
  ]);
  const [refused, repeated] = seen.healthRequests;
  expect(refused.key).toMatch(/^item-/u);
  expect(repeated.key).toBe(refused.key);
});

test("C3-b: an admin's upload of it says Ask your workspace owner… on the card — no dialog, nothing more sent", async ({
  page,
}) => {
  await presentSession(page, "admin");
  await fixtureControl("health-data");
  const card = await readyUpload(page);
  await card.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(card.getByText(ASK_OWNER)).toBeVisible();
  await expect(agreement(page)).toHaveCount(0);
  expect((await health()).healthRequests).toHaveLength(1);
});

test("C3-b: a member's upload of it is refused first as a member's: only an owner or admin can, never the agreement", async ({
  page,
}) => {
  await fixtureControl("health-data");
  const card = await readyUpload(page);
  await presentSession(page, "member");
  await card.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(
    card.getByText("Only an owner or admin can do this."),
  ).toBeVisible();
  await expect(card.getByText(ASK_OWNER)).toHaveCount(0);
  await expect(agreement(page)).toHaveCount(0);
  expect((await health()).healthRequests).toHaveLength(0);
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

test("C3: with none signed, Documents says No documents yet.; a document of another workspace, or an id that is not one, is not found", async ({
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
  // The platform answers 400 for an id that is not a UUID: not found too.
  const typo = await page.goto("/account/organization/documents/d0c0-typo");
  expect(typo?.status()).toBe(404);
});

test("C3: the owner's acceptance in Set up is the newest of the Documents", async ({
  page,
}) => {
  await fixtureControl("health-data");
  const section = await addToSetup(page);
  await sign(section);
  await turnOn(page).click();
  await expect(page).toHaveURL(new RegExp(`${FLOWS.invoice}$`, "u"));
  await page.goto("/account/organization");
  const rows = page.getByTestId("org-documents").getByRole("link");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Accepted by Dana Owner");
});

test("wave 2: a batch run's steps, by its flow's batch steps in order — 1 · Pages counted Done, 2 · Pages sorted Working…, 3 and 4 Waiting — never its groups", async ({
  page,
}) => {
  await fixtureControl("invoice-batch");
  await page.goto("/account/runs/fixture-run-batch-steps");
  const steps = page.locator("main").getByTestId("run-steps").locator("li");
  await expect(steps).toHaveCount(4);
  for (const [index, title, state, words] of [
    [0, "1 · Pages counted", "done", "Done"],
    [1, "2 · Pages sorted", "working", "Working…"],
    [2, "3 · Visits found", "waiting", "Waiting"],
    [3, "4 · Visits queued", "waiting", "Waiting"],
  ] as const) {
    await expect(steps.nth(index)).toContainText(title);
    await expect(steps.nth(index)).toContainText(words);
    await expect(steps.nth(index)).toHaveAttribute("data-state", state);
  }
  await expect(page.locator("main")).not.toContainText("Upload invoice");
});
