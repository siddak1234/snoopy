import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  expectNoAxeViolations,
  fixtureControl,
  fixtureRead,
  presentSession,
  runForm,
} from "./helpers";

/**
 * A flow's items (Round 19, plan §5; backend ADR-0046; build 28's screens,
 * plan §3) against the loopback fixture Edge, reset before each test, as the
 * other fixture specs run: the Flows list by department; the flow page's
 * items grouped A–Z under its group filter, with no Dashboard, no Steps and
 * no run start form; the upload card with its drop-down, "Other" and the
 * values typed before; an item's page with its runs ranked in compact rows;
 * a run headed by its title and score with its sections under "{Run word}
 * details" and its Run details page; Archive — the buttons an owner's alone —
 * and WCAG 2.2 AA on each.
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

test("the Flows list: grouped by department, the departments A–Z, each keeping the catalog's order (build 28, item 1)", async ({
  page,
}) => {
  await page.goto("/account/flows");
  // The catalog lists Operations' flows first and Customer Support's last:
  // A–Z puts Accounting first and Customer Support second.
  const departments = page.getByTestId("flows-department");
  await expect(departments.locator("h2")).toHaveText([
    "Accounting",
    "Customer Support",
    "Operations",
  ]);
  await expect(departments.nth(0).locator("h3")).toHaveText([
    "Invoice Processing",
  ]);
  // A department of two words names its section (the review's finding 4).
  await expect(
    page.getByRole("region", { name: "Customer Support" }).locator("h3"),
  ).toHaveText(["Item automation"]);
  const operations = departments.nth(2).locator("h3");
  await expect(operations.first()).toHaveText("Plan-limit automation");
  await expect(operations.last()).toHaveText("Team draft automation");
  await expectNoAxeViolations(page);
});

test("a flow with items: no Dashboard, no Steps; its items grouped A–Z, rows A–Z, each its line; the group filter; no run start form; Upload for an owner; axe", async ({
  page,
}) => {
  await page.goto(FLOW);
  await expect(
    page.getByRole("heading", { level: 2, name: "Batches" }),
  ).toBeVisible();
  // Its items are the page (build 28, items 2 and 3).
  for (const gone of ["Dashboard", "Steps"])
    await expect(
      page.getByRole("heading", { level: 2, name: gone }),
    ).toHaveCount(0);
  await expect(page.getByTestId("flow-stat-Runs")).toHaveCount(0);
  // The options' order (North, South) and the platform's (newest first)
  // are not what is drawn: A–Z.
  expect(await drawnGroups(page)).toEqual([
    { title: "Coastal", rows: ["Harbour listCouldn't read"] },
    {
      title: "North",
      rows: ["Autumn intake0 entries", "Winter intakeReading…"],
    },
    { title: "South", rows: ["Spring intake4 entries · Top 91"] },
  ]);
  // A run needs an item: no run start form, no Start run.
  await expect(runForm(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start run" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upload batch" }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  // The group filter: All {field, many} first, then the values A–Z; a
  // choice draws its group alone, under no header.
  const filter = page.getByRole("combobox", { name: "Area" });
  await expect(filter).toHaveText("All areas");
  await expect(page.locator("main select")).toHaveCount(0);
  await filter.click();
  const menu = page.getByRole("listbox", { name: "Area" });
  await expect(menu.getByRole("option")).toHaveText([
    "All areas",
    "Coastal",
    "North",
    "South",
  ]);
  await expect(menu.getByRole("option", { name: "All areas" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(menu.getByRole("option", { name: "All areas" })).toBeFocused();
  await expectNoAxeViolations(page);
  await menu.getByRole("option", { name: "North" }).click();
  await expect(menu).toHaveCount(0);
  await expect(filter).toHaveText("North");
  await expect(filter).toBeFocused();
  expect(await drawnGroups(page)).toEqual([
    { title: null, rows: ["Autumn intake0 entries", "Winter intakeReading…"] },
  ]);
  // By keys: opened on the chosen one, Down to the next, Enter takes it.
  await filter.press("ArrowDown");
  await expect(menu.getByRole("option", { name: "North" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(filter).toHaveText("South");
  expect(await drawnGroups(page)).toEqual([
    { title: null, rows: ["Spring intake4 entries · Top 91"] },
  ]);
  // Escape closes it and keeps the choice; a press outside closes it too.
  await filter.click();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(filter).toBeFocused();
  await filter.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(menu).toHaveCount(0);
  await expect(filter).toHaveText("South");
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
  // The website's drop-down, never the browser's own select (decision 7).
  await expect(card.locator("select")).toHaveCount(0);
  const select = card.getByRole("combobox", { name: "Area" });
  await expect(select).toHaveText("North");
  await select.click();
  const choices = card.getByRole("listbox", { name: "Area" });
  await expect(choices.getByRole("option")).toHaveText([
    "North",
    "South",
    "Coastal",
    "Inland",
    "Other",
  ]);
  await expect(choices.getByRole("option", { name: "North" })).toBeFocused();
  await expectNoAxeViolations(page);
  // Escape closes the drop-down alone, never the card.
  await page.keyboard.press("Escape");
  await expect(choices).toHaveCount(0);
  await expect(card).toBeVisible();
  await expect(select).toBeFocused();
  // The file's types, offered and said.
  await expect(card.getByLabel("Batch file")).toHaveAttribute(
    "accept",
    `application/pdf,${WORD_FILE},image/jpeg,image/png`,
  );
  await expect(card.getByText("PDF, Word file or photo")).toBeVisible();
  await expect(card.getByRole("textbox", { name: "Other" })).toHaveCount(0);
  await select.click();
  await choices.getByRole("option", { name: "Other" }).click();
  await expect(select).toHaveText("Other");
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
  expect(groups.map((group) => group.title)).toEqual([
    "Coastal",
    "Delta",
    "North",
    "South",
  ]);
  expect(groups[1]).toEqual({
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
  // The typed value is saved, and offered next time; a saved value picked
  // is sent in its own words.
  await page.reload();
  await page.getByRole("button", { name: "Upload batch" }).click();
  const again = page.getByTestId("item-upload");
  await again.getByRole("combobox", { name: "Area" }).click();
  const offered = again.getByRole("listbox", { name: "Area" });
  await expect(offered.getByRole("option")).toHaveText([
    "North",
    "South",
    "Coastal",
    "Delta",
    "Inland",
    "Other",
  ]);
  await offered.getByRole("option", { name: "Inland" }).click();
  await again.getByLabel("Name").fill("Inland list");
  await again.getByLabel("Batch file").setInputFiles(entryPdf);
  await expect(again.getByText(/^Ready: entry\.pdf/u)).toBeVisible();
  await again.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(again).toHaveCount(0);
  const sent = await fixtureRead<{ creates: Record<string, unknown>[] }>(
    "items",
  );
  expect(sent.creates).toHaveLength(2);
  expect(sent.creates[1]).toMatchObject({
    fields: { area: "Inland", name: "Inland list" },
  });
});

test("an item's page: its runs ranked as the platform answers in compact rows the height of a section's, a failure dimmed; no sections; Add entry takes the run's types and stays here, the new run Reading…; axe", async ({
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
  ).toEqual(["1Ada LaneScore 91", "2Ben ItoScore 64", "3Reading…", "4Failed"]);
  await expect(page.getByTestId("item-run-4")).toHaveAttribute(
    "data-dim",
    "true",
  );
  await expect(page.getByTestId("item-run-1")).not.toHaveAttribute(
    "data-dim",
    "true",
  );
  // What was read from its file is not on its page (build 28, item 4).
  await expect(
    page.getByRole("heading", { level: 2, name: "What AI read" }),
  ).toHaveCount(0);
  await expect(page.getByTestId("item-section-1")).toHaveCount(0);
  await expect(page.getByText("Three must-haves.")).toHaveCount(0);
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
    "1Ada LaneScore 91",
    "2Ben ItoScore 64",
    "3Reading…",
    "4Reading…",
    "5Failed",
  ]);
  // A compact row is a closed section's height (build 28, item 5: "the size
  // of the must haves drop down").
  const rowHeight = (await page.getByTestId("item-run-1").boundingBox())
    ?.height;
  await page.goto(SCORED_RUN);
  const sectionHeight = (await page.getByTestId("run-section-2").boundingBox())
    ?.height;
  expect(rowHeight).toBeGreaterThan(0);
  expect(Math.abs((rowHeight ?? 0) - (sectionHeight ?? 0))).toBeLessThan(1);
});

test('a run with a title and a score is headed by them; its sections first, under "{Run word} details", rows, the first open; a link only when http or https, opening outside; then Run details, its page the result line, the steps and the facts; axe', async ({
  page,
}) => {
  await page.goto(SCORED_RUN);
  await expect(
    page.getByRole("heading", { level: 1, name: "Ada Lane" }),
  ).toBeVisible();
  await expect(page.getByTestId("run-score")).toHaveText("Score 91");
  // "{Run word} details" over its sections; no result line here (build 28,
  // items 7 and 8: "Instead of strong match 6 of 6").
  await expect(
    page.getByRole("heading", { level: 2, name: "Entry details" }),
  ).toBeVisible();
  await expect(page.getByTestId("run-result")).toHaveCount(0);
  await expect(page.getByText("Strong fit · 3 of 3")).toHaveCount(0);
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
  // The sections, then Run details, then View flow (build 28, item 9).
  const order = await page.evaluate(() => {
    const at = (selector: string) => document.querySelector(selector);
    const section = at('[data-testid="run-section-1"]');
    const row = at('[data-testid="run-details-row"]');
    const flow = [...document.querySelectorAll("main a")].find(
      (link) => link.textContent?.trim() === "View flow",
    );
    const follows = (
      a: Element | null | undefined,
      b: Element | null | undefined,
    ) =>
      a && b
        ? Boolean(
            a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
          )
        : false;
    return follows(section, row) && follows(row, flow);
  });
  expect(order).toBe(true);
  await expect(page.getByTestId("run-steps")).toHaveCount(0);
  await page.getByTestId("run-section-2").locator("summary").click();
  await expect(page.getByText("Ran the example team.")).toBeVisible();
  await expectNoAxeViolations(page);
  // Its details page: how it went, the tiles, the steps and the facts.
  await page.getByRole("link", { name: "Run details" }).click();
  await expect(page).toHaveURL(new RegExp(`${SCORED_RUN}/details$`, "u"));
  await expect(
    page.getByRole("heading", { level: 1, name: "Run details" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText("Ada Lane");
  // Its result line is gone, not moved: its sections said it.
  await expect(page.getByTestId("run-result")).toHaveCount(0);
  await expect(page.getByTestId("run-steps")).toBeVisible();
  await expect(page.getByTestId("run-tile-Steps done")).toBeVisible();
  await expect(page.getByTestId("run-fact-Run ID")).toHaveText(
    SCORED_RUN.split("/").at(-1) ?? "",
  );
  await expect(page.getByTestId("run-section-1")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

// Build 28 (plan §1, §3): the fixture's files behind their signed links.
const ITEM_FILE_LINK =
  "https://127.0.0.1:3443/__fixture/run-file?id=d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1&name=spring-intake.pdf";
const ENTRY_FILE = "d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2";
const ENTRY_FILE_LINK = `https://127.0.0.1:3443/__fixture/run-file?id=${ENTRY_FILE}&name=ada-lane.pdf`;

/** The share sheet, stood in for: what it was handed is kept on the page. */
async function standInShareSheet(page: Page) {
  await page.addInitScript(() => {
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: ShareData) => {
        const file = data.files?.[0];
        Object.assign(window, {
          shared: file
            ? { name: file.name, type: file.type, size: file.size }
            : null,
        });
      },
    });
  });
}

/** WCAG 2.2 AA on a file's page; its frame holds the file, not this site's page. */
async function expectNoAxeViolationsBesideTheFile(page: Page) {
  await expect(page).toHaveTitle(/\S/u);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .exclude('[data-testid="file-frame"]')
    .analyze();
  expect(results.violations).toEqual([]);
}

/** How this site's file route answers its own page, and a request from nowhere. */
async function viewAnswers(page: Page, path: string) {
  const own = await page.evaluate(async (href) => {
    const answer = await fetch(href);
    return {
      status: answer.status,
      type: answer.headers.get("content-type"),
      disposition: answer.headers.get("content-disposition"),
      nosniff: answer.headers.get("x-content-type-options"),
      frame: answer.headers.get("content-security-policy"),
      start: (await answer.text()).slice(0, 8),
    };
  }, path);
  const elsewhere = await page.request.get(path, { maxRedirects: 0 });
  return { own, elsewhere: elsewhere.status() };
}

test("an item's tiles: Total, then the flow's verdict words — green and red — then its file's row; the file page: the file in place, Download to its signed link, Share the file, then what was read, closed; axe (build 28, items 4 and 6)", async ({
  page,
}) => {
  await standInShareSheet(page);
  await page.goto(ITEM);
  const tiles = page.getByTestId("item-tiles");
  await expect(tiles.locator("dt")).toHaveText(["Total", "Keep", "Drop"]);
  await expect(page.getByTestId("item-tile-total")).toHaveText("4");
  await expect(page.getByTestId("item-tile-positive")).toHaveText("1");
  await expect(page.getByTestId("item-tile-negative")).toHaveText("1");
  await expect(page.getByTestId("item-tile-positive")).toHaveClass(
    /text-\[var\(--success-text\)\]/u,
  );
  await expect(page.getByTestId("item-tile-negative")).toHaveClass(
    /text-\[var\(--error-text\)\]/u,
  );
  // Tiles, the file's row, then Add and the runs.
  const order = await page.evaluate(() =>
    ["item-tiles", "item-file-row", "item-add", "item-runs"].map((id) => {
      const at = document.querySelector(`[data-testid="${id}"]`);
      return at
        ? [...document.querySelectorAll("[data-testid]")].indexOf(at)
        : -1;
    }),
  );
  expect(
    order.every((at, n) => at >= 0 && (n === 0 || at > order[n - 1]!)),
  ).toBe(true);
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Batch file" }).click();
  await expect(page).toHaveURL(new RegExp(`${ITEM}/file$`, "u"));
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Batch file",
  );
  await expect(main).toContainText("Spring intake");
  await expect(main.getByText("spring-intake.pdf")).toBeVisible();
  await expect(page.getByTestId("file-line")).toHaveText(
    /^PDF · 1 page · \d+ bytes$/u,
  );
  // The file itself, through this site's route: inline, its own type, for
  // this site's pages alone.
  await expect(page.getByTestId("file-frame")).toHaveAttribute(
    "src",
    `${ITEM}/file/view`,
  );
  const answers = await viewAnswers(page, `${ITEM}/file/view`);
  expect(answers.own).toEqual({
    status: 200,
    type: "application/pdf",
    disposition: 'inline; filename="spring-intake.pdf"',
    nosniff: "nosniff",
    frame: "frame-ancestors 'self'",
    start: "%PDF-1.4",
  });
  expect(answers.elsewhere).toBe(403);
  // What was read from it, each section closed.
  await expect(page.getByTestId("item-section-1")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.getByTestId("item-section-1").locator("summary").click();
  await expect(page.getByText("Three must-haves.")).toBeVisible();
  await expectNoAxeViolationsBesideTheFile(page);
  // Download: the platform's signed link; Share: the file itself.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    main.getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.url()).toBe(ITEM_FILE_LINK);
  await expect(page).toHaveURL(new RegExp(`${ITEM}/file$`, "u"));
  await main.getByRole("button", { name: "Share" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { shared?: unknown }).shared),
    )
    .toMatchObject({ name: "spring-intake.pdf", type: "application/pdf" });
  // Back goes to the item.
  await main.getByRole("link", { name: "Back" }).click();
  await expect(page).toHaveURL(new RegExp(`${ITEM}$`, "u"));
});

test("an item's file under another flow's path is not found, and a member reads it and downloads it (build 28, item 4)", async ({
  page,
}) => {
  const elsewhere = await page.goto(
    `/account/flows/99999999-9999-4999-8999-999999999999/items/${READY_ITEM}/file`,
  );
  expect(elsewhere?.status()).toBe(404);
  const view = await page.evaluate(
    async (href) => (await fetch(href)).status,
    `/account/flows/99999999-9999-4999-8999-999999999999/items/${READY_ITEM}/file/view`,
  );
  expect(view).toBe(404);
  await presentSession(page, "member");
  await page.goto(`${ITEM}/file`);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("main").getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.url()).toBe(ITEM_FILE_LINK);
});

test("a run of an item: View {file} first, in the flow's word; its file page: the file in place, Download to its signed link; a file not the job's is not found; axe (build 28, item 7)", async ({
  page,
}) => {
  await page.goto(SCORED_RUN);
  const row = page.getByRole("link", { name: "View entry file" });
  await expect(row).toBeVisible();
  const first = await page.evaluate(() => {
    const row = document.querySelector('[data-testid^="run-file-"]');
    const heading = [...document.querySelectorAll("main h2")].find(
      (h) => h.textContent === "Entry details",
    );
    return row && heading
      ? Boolean(
          row.compareDocumentPosition(heading) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : false;
  });
  expect(first).toBe(true);
  await row.click();
  const filePage = `${SCORED_RUN}/files/${ENTRY_FILE}`;
  await expect(page).toHaveURL(new RegExp(`${filePage}$`, "u"));
  const main = page.locator("main");
  await expect(main.getByRole("heading", { level: 1 })).toHaveText(
    "Entry file",
  );
  await expect(main).toContainText("Ada Lane");
  await expect(page.getByTestId("file-frame")).toHaveAttribute(
    "src",
    `${filePage}/view`,
  );
  const answers = await viewAnswers(page, `${filePage}/view`);
  expect(answers.own).toMatchObject({
    status: 200,
    type: "application/pdf",
    disposition: 'inline; filename="ada-lane.pdf"',
  });
  expect(answers.elsewhere).toBe(403);
  await expectNoAxeViolationsBesideTheFile(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    main.getByRole("button", { name: "Download" }).click(),
  ]);
  expect(download.url()).toBe(ENTRY_FILE_LINK);
  // Another file id is not this job's: not found, and so is its route.
  const other = await page.goto(
    `${SCORED_RUN}/files/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee`,
  );
  expect(other?.status()).toBe(404);
  await page.goto(filePage);
  expect(
    await page.evaluate(
      async (href) => (await fetch(href)).status,
      `${SCORED_RUN}/files/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/view`,
    ),
  ).toBe(404);
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
