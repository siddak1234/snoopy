import { expect, test, type Page } from "@playwright/test";
import {
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  presentSession,
  runForm,
} from "./helpers";

/**
 * A flow's items (Round 19, plan §5; backend ADR-0046) against the loopback
 * fixture Edge, reset before each test, as the other fixture specs run: the
 * flow page's items grouped and its run start form gone, the upload card
 * with "Other" and the values typed before, an item's page with its runs
 * ranked and what was read, a run headed by its title and score with its
 * sections, Archive — the buttons an owner's alone — and WCAG 2.2 AA on each.
 * The fixture's flow is made-up ("Batches" of "Entries"): every word here is
 * the platform's, none the website's.
 */

// The browser PUTs a file straight to the fixture's object store, whose
// certificate is the fixture's own, as the other specs' file tests do.
test.use({
  storageState: process.env.PLAYWRIGHT_AUTH_STORAGE_STATE,
  ignoreHTTPSErrors: true,
});
test.skip(
  process.env.E2E_PUBLIC_EDGE_FIXTURE !== "1",
  "requires the local public Edge fixture",
);

const FLOW = "/account/flows/b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";
const READY_ITEM = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const ITEM = `${FLOW}/items/${READY_ITEM}`;
const SCORED_RUN = "/account/runs/c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1";
const WORD_FILE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const wordFile = {
  name: "delta.docx",
  mimeType: WORD_FILE,
  buffer: Buffer.from("PK fixture word file"),
};
const entryPdf = {
  name: "entry.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.4 fixture entry"),
};

test.beforeEach(async () => {
  await fixtureControl("reset");
  await fixtureControl("items-flow");
});

/** The flow page's items: each group's header and its rows' text, in order. */
async function drawnGroups(page: Page) {
  const list = page.getByTestId("flow-items");
  await expect(list).toBeVisible();
  return list.locator(":scope > div").evaluateAll((groups) =>
    groups.map((group) => ({
      title: group.querySelector("h3")?.textContent ?? null,
      rows: [...group.querySelectorAll("li")].map((row) =>
        (row.textContent ?? "").trim(),
      ),
    })),
  );
}

test("a flow with items: its items grouped in the options' order, then typed values, each row its line; no run start form; Upload for an owner; axe", async ({
  page,
}) => {
  await page.goto(FLOW);
  await expect(
    page.getByRole("heading", { level: 2, name: "Batches" }),
  ).toBeVisible();
  expect(await drawnGroups(page)).toEqual([
    {
      title: "North",
      rows: ["Autumn intake0 entries", "Winter intakeReading…"],
    },
    { title: "South", rows: ["Spring intake4 entries · Top 91"] },
    { title: "Coastal", rows: ["Harbour listCouldn't read"] },
  ]);
  // A run needs an item: no run start form, no Start run.
  await expect(runForm(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start run" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upload batch" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
});

test("a member sees the items and an item's runs, without Upload, Add or Archive", async ({
  page,
}) => {
  await presentSession(page, "member");
  await page.goto(FLOW);
  await expect(page.getByTestId("flow-items")).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload batch" })).toHaveCount(
    0,
  );
  await page.goto(ITEM);
  await expect(
    page.getByRole("heading", { level: 1, name: "Spring intake" }),
  ).toBeVisible();
  await expect(page.getByTestId("item-runs")).toBeVisible();
  await expect(page.getByTestId("item-add")).toHaveCount(0);
  await expect(page.getByTestId("item-archive")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("the upload card: the options, the values typed before and Other; a typed value and a Word file make an item that reads Reading…, and its value is offered next time", async ({
  page,
}) => {
  await page.goto(FLOW);
  await page.getByRole("button", { name: "Upload batch" }).click();
  const card = page.getByTestId("item-upload");
  await expect(
    card.getByRole("heading", { name: "Upload batch" }),
  ).toBeVisible();
  const select = card.getByRole("combobox", { name: "Area" });
  expect(
    await select
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.textContent)),
  ).toEqual(["North", "South", "Coastal", "Inland", "Other"]);
  await expect(select).toHaveValue("option:0");
  // The file's types, offered and said.
  await expect(card.getByLabel("Batch file")).toHaveAttribute(
    "accept",
    `application/pdf,${WORD_FILE},image/jpeg,image/png`,
  );
  await expect(card.getByText("PDF, Word file or photo")).toBeVisible();
  await expect(card.getByRole("textbox", { name: "Other" })).toHaveCount(0);
  await select.selectOption({ label: "Other" });
  // Its own name, Other — not the select's.
  const other = card.getByRole("textbox", { name: "Other" });
  await expect(other).toHaveAttribute("maxlength", "40");
  await other.fill("Delta");
  await card.getByLabel("Name").fill("Delta list");
  await card.getByLabel("Batch file").setInputFiles(wordFile);
  await expect(card.getByText(/^Ready: delta\.docx/u)).toBeVisible();
  await expectNoAxeViolations(page);
  await card.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(card).toHaveCount(0);
  const made = await fixtureRead<{ creates: Record<string, unknown>[] }>(
    "items",
  );
  expect(made.creates).toHaveLength(1);
  expect(made.creates[0]).toMatchObject({
    fields: { area: "Delta", name: "Delta list" },
  });
  expect(typeof made.creates[0]?.file).toBe("string");
  const groups = await drawnGroups(page);
  expect(groups.at(-1)).toEqual({
    title: "Delta",
    rows: ["Delta listReading…"],
  });
  // Read again while it is read: once the run that reads it ends, the row says so.
  await fixtureControl("items-read");
  await expect(
    page.getByTestId("flow-items").getByText("Delta list"),
  ).toBeVisible();
  await expect(
    page
      .getByTestId("flow-items")
      .locator("li", { hasText: "Delta list" })
      .getByText("0 entries"),
  ).toBeVisible();
  // The typed value is saved, and offered next time.
  await page.reload();
  await page.getByRole("button", { name: "Upload batch" }).click();
  expect(
    await page
      .getByTestId("item-upload")
      .getByRole("combobox", { name: "Area" })
      .locator("option")
      .evaluateAll((options) => options.map((option) => option.textContent)),
  ).toEqual(["North", "South", "Coastal", "Delta", "Inland", "Other"]);
});

test("an item's page: its runs ranked as the platform answers, a failure dimmed; What AI read closed; Add entry takes the run's types and stays here, the new run Reading…; axe", async ({
  page,
}) => {
  await page.goto(ITEM);
  await expect(
    page.getByRole("heading", { level: 1, name: "Spring intake" }),
  ).toBeVisible();
  await expect(page.getByText("South · Ready")).toBeVisible();
  const runs = page.getByTestId("item-runs");
  expect(
    await runs
      .locator("li")
      .evaluateAll((rows) => rows.map((row) => (row.textContent ?? "").trim())),
  ).toEqual([
    "1Ada LaneStrong fit · 3 of 3Score 91",
    "2Ben ItoFair fit · 2 of 3Score 64",
    "3Reading…",
    "4FailedThe file could not be read.",
  ]);
  await expect(page.getByTestId("item-run-4")).toHaveAttribute(
    "data-dim",
    "true",
  );
  await expect(page.getByTestId("item-run-1")).not.toHaveAttribute(
    "data-dim",
    "true",
  );
  // What was read from its file: every section closed.
  await expect(
    page.getByRole("heading", { level: 2, name: "What AI read" }),
  ).toBeVisible();
  await expect(page.getByTestId("item-section-1")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.getByTestId("item-section-2")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByTestId("item-section-1").locator("summary").click();
  await expect(page.getByText("Three must-haves.")).toBeVisible();
  await expectNoAxeViolations(page);

  const add = page.getByTestId("item-add");
  await expect(
    page.getByRole("heading", { level: 2, name: "Add entry" }),
  ).toBeVisible();
  await expect(add.getByLabel("Entry file")).toHaveAttribute(
    "accept",
    `application/pdf,${WORD_FILE}`,
  );
  await expect(add.getByText("PDF or Word file")).toBeVisible();
  await add.getByLabel("Entry file").setInputFiles(entryPdf);
  await expect(add.getByText(/^Ready: entry\.pdf/u)).toBeVisible();
  await add.getByRole("button", { name: "Start" }).click();
  await expect(page.getByTestId("item-run-5")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${ITEM}$`, "u"));
  const started = await fixtureRead<{ runStarts: Record<string, unknown>[] }>(
    "items",
  );
  expect(started.runStarts).toHaveLength(1);
  expect(started.runStarts[0]).toMatchObject({ itemId: READY_ITEM });
  expect(
    await runs
      .locator("li")
      .evaluateAll((rows) => rows.map((row) => (row.textContent ?? "").trim())),
  ).toEqual([
    "1Ada LaneStrong fit · 3 of 3Score 91",
    "2Ben ItoFair fit · 2 of 3Score 64",
    "3Reading…",
    "4Reading…",
    "5FailedThe file could not be read.",
  ]);
});

test("a run with a title and a score is headed by them; its sections are rows, the first open; a link only when http or https, opening outside; axe", async ({
  page,
}) => {
  await page.goto(SCORED_RUN);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ada Lane" }),
  ).toBeVisible();
  await expect(page.getByTestId("run-score")).toHaveText("Score 91");
  await expect(page.getByTestId("run-section-1")).toHaveAttribute("open", "");
  await expect(page.getByTestId("run-section-2")).not.toHaveAttribute(
    "open",
    "",
  );
  await expect(page.getByTestId("run-section-3")).not.toHaveAttribute(
    "open",
    "",
  );
  const link = page
    .getByTestId("run-section-1")
    .getByRole("link", { name: "https://example.test/ada" });
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(page.getByText("Not a link")).toBeVisible();
  await expect(page.getByTestId("run-section-1").getByRole("link")).toHaveCount(
    1,
  );
  // The sections come before the steps.
  const order = await page.evaluate(() => {
    const section = document.querySelector('[data-testid="run-section-1"]');
    const steps = document.querySelector('[data-testid="run-steps"]');
    return section && steps
      ? section.compareDocumentPosition(steps) &
          Node.DOCUMENT_POSITION_FOLLOWING
      : 0;
  });
  expect(order).toBeTruthy();
  await page.getByTestId("run-section-2").locator("summary").click();
  await expect(page.getByText("Ran the example team.")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Archive batch asks first, then the item leaves its flow's list", async ({
  page,
}) => {
  await page.goto(ITEM);
  await page.getByRole("button", { name: "Archive batch" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Archive Spring intake?" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Archive" }).click();
  await expect(page).toHaveURL(new RegExp(`${FLOW}$`, "u"));
  await expect(
    page.getByTestId("flow-items").getByText("Spring intake"),
  ).toHaveCount(0);
});

test("an item list the platform cannot answer reads Unavailable, never None yet", async ({
  page,
}) => {
  await fixtureControl("items-failing");
  await page.goto(FLOW);
  const section = page.locator("section", {
    has: page.getByRole("heading", { level: 2, name: "Batches" }),
  });
  await expect(section.getByText("Unavailable")).toBeVisible();
  await expect(section.getByText("No batches yet.")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

// A member's press, refused by the platform (403, `requiredRole`): the page
// was drawn for an owner, and the session is a member's by the time of the
// press — each said in the same words.
const OWNERS_AND_ADMINS = "Only an owner or admin can do this.";

test("Upload refused for a member says only an owner or admin can", async ({
  page,
}) => {
  await page.goto(FLOW);
  await page.getByRole("button", { name: "Upload batch" }).click();
  const card = page.getByTestId("item-upload");
  await card.getByLabel("Name").fill("Member list");
  await card.getByLabel("Batch file").setInputFiles(entryPdf);
  await expect(card.getByText(/^Ready: entry\.pdf/u)).toBeVisible();
  await presentSession(page, "member");
  await card.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(card.getByText(OWNERS_AND_ADMINS)).toBeVisible();
});

test("Start refused for a member says only an owner or admin can", async ({
  page,
}) => {
  await page.goto(ITEM);
  const add = page.getByTestId("item-add");
  await add.getByLabel("Entry file").setInputFiles(entryPdf);
  await expect(add.getByText(/^Ready: entry\.pdf/u)).toBeVisible();
  await presentSession(page, "member");
  await add.getByRole("button", { name: "Start" }).click();
  await expect(add.getByText(OWNERS_AND_ADMINS)).toBeVisible();
});

test("Archive refused for a member says only an owner or admin can", async ({
  page,
}) => {
  await page.goto(ITEM);
  await presentSession(page, "member");
  await page.getByRole("button", { name: "Archive batch" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Archive" }).click();
  await expect(dialog.getByText(OWNERS_AND_ADMINS)).toBeVisible();
});
