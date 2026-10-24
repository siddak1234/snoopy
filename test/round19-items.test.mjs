import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * Round 19's website guards that are not one module's (plan §5; backend
 * ADR-0046): a flow with items draws them in place of its run start form; the
 * buttons that make, add to and archive an item are an owner's or admin's;
 * sections are rows that open and close, the first open on a run's page and
 * none on an item's; a run of an item names it; the item's page is read per
 * request through lib/platform-server.ts; and the privacy page says what
 * Candidate Reviewer has read. `test/flow-items.test.mjs` holds the rules;
 * `e2e/flow-items.spec.ts` what a browser draws.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
/** A source file's code alone: what its comments say is not what it does. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

const FLOW_PAGE = "app/account/flows/[subscriptionId]/page.tsx";
const FLOW_ITEMS = "app/account/flows/FlowItems.tsx";
const ITEM_PAGE = "app/account/flows/[subscriptionId]/items/[itemId]/page.tsx";
const ITEM_LIVE =
  "app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx";
const RUN_LIVE = "app/account/runs/[runId]/RunLive.tsx";
const SECTION_ROWS = "components/dashboard/SectionRows.tsx";

test("a flow with items draws them after its steps, and its run start form gets no fields — Turn on only (plan §5.1)", () => {
  const page = code(read(FLOW_PAGE));
  assert.match(page, /const declaredItems = subscription\.items;/u);
  assert.match(
    page,
    /runInput=\{declaredItems \? \[\] : \(subscription\.runInput \?\? \[\]\)\}/u,
  );
  assert.match(
    page,
    /\{declaredItems && items \? \(\s*<FlowItems[\s\S]*?declared=\{declaredItems\}[\s\S]*?canManage=\{canManage\}/u,
  );
  // RunStart draws nothing for a live flow with no fields, and Turn on for one off.
  const start = code(read("app/account/flows/RunStart.tsx"));
  assert.match(
    start,
    /const canRun = live && available && runInput\.length > 0;/u,
  );
  assert.match(start, /if \(live && !canRun\) return null;/u);
});

test("Upload, Add and Archive are an owner's or admin's: drawn only under canManage, which the pages read from the role (plan §5)", () => {
  const items = code(read(FLOW_ITEMS));
  assert.match(
    items,
    /\{canManage \? \(\s*<Button[\s\S]*?data-testid="item-upload-open"/u,
  );
  const live = code(read(ITEM_LIVE));
  assert.match(
    live,
    /\{canManage && item\.status === "ready" && !archived \? \(\s*<section aria-labelledby="item-add-title"/u,
  );
  assert.match(
    live,
    /\{canManage && !archived \? \(\s*<div className="py-5">\s*<ArchiveItem/u,
  );
  assert.match(
    code(read(FLOW_PAGE)),
    /const canManage = administers\(role\);/u,
  );
  assert.match(code(read(ITEM_PAGE)), /canManage=\{administers\(role\)\}/u);
});

test("sections open and close: every one closed but the first on a run's page, every one closed on an item's (plan §5.3, §5.4)", () => {
  const rows = code(read(SECTION_ROWS));
  assert.match(rows, /<details[\s\S]*?open=\{firstOpen && index === 0\}/u);
  assert.match(rows, /firstOpen = false,/u);
  assert.match(
    code(read(RUN_LIVE)),
    /<SectionRows sections=\{sections\} firstOpen testId="run-section" \/>/u,
  );
  const live = code(read(ITEM_LIVE));
  assert.match(
    live,
    /<SectionRows sections=\{item\.sections\} testId="item-section" \/>/u,
  );
  assert.doesNotMatch(live, /firstOpen/u);
});

test("a section's link is drawn only through sectionLink, opening outside with noopener noreferrer", () => {
  const rows = code(read(SECTION_ROWS));
  assert.match(rows, /const link = sectionLink\(entry\.url\);/u);
  assert.match(
    rows,
    /\{link \? \(\s*<a\s+href=\{link\}\s+target="_blank"\s+rel="noopener noreferrer"/u,
  );
  assert.doesNotMatch(rows, /href=\{entry\.url\}/u);
});

test("a run with a title and a score is headed by them, the full id kept among its facts; its sections come before its steps (plan §5.4)", () => {
  const live = code(read(RUN_LIVE));
  assert.match(
    live,
    /const headed = run\.title !== undefined && run\.score !== undefined;/u,
  );
  assert.match(
    live,
    /title=\{headed && run\.title \? run\.title : runLabel\(run\.id\)\}/u,
  );
  assert.match(live, /data-testid="run-score"/u);
  assert.match(live, /\{ label: "Run ID", value: run\.id \}/u);
  assert.ok(
    live.indexOf('testId="run-section"') < live.indexOf('id="run-steps-title"'),
  );
});

test("a run started on an item's page names it, and the platform's item refusals are said in words (backend ADR-0046)", () => {
  const actions = code(read("app/account/flows/actions.ts"));
  assert.match(
    actions,
    /const itemId = String\(formData\.get\("itemId"\) \?\? ""\);/u,
  );
  assert.match(actions, /\.\.\.\(itemId \? \{ itemId \} : \{\}\),/u);
  assert.match(
    actions,
    /item_not_ready: "It is still being read\. Try again in a moment\.",/u,
  );
  assert.match(
    actions,
    /item_archived: "It was archived, so it takes no new runs\.",/u,
  );
  const start = code(read("app/account/flows/RunStart.tsx"));
  assert.match(
    start,
    /\{itemId \? <input type="hidden" name="itemId" value=\{itemId\} \/> : null\}/u,
  );
  // An item is made through lib/automations.ts with the card's own key.
  const automations = code(read("lib/automations.ts"));
  assert.match(
    automations,
    /export function createItem\([\s\S]*?\{ method: "POST", body: JSON\.stringify\(body\), idempotencyKey \}/u,
  );
  assert.match(
    code(read("app/account/flows/UploadItemCard.tsx")),
    /idempotencyKey: itemKey,/u,
  );
});

test("an item's page reads the platform through lib/platform-server.ts per request, with the dashboard's parts and their one empty row (AGENTS.md rules 2 and 4; register F29, F62)", () => {
  const page = code(read(ITEM_PAGE));
  assert.match(page, /from "@\/lib\/platform-server"/u);
  assert.match(page, /export const dynamic = "force-dynamic"/u);
  assert.match(page, /readItem\(workspaceId, itemId\)/u);
  // Another flow's item is the same not found.
  assert.match(
    page,
    /if \(answer\.item\.subscriptionId !== subscriptionId\) notFound\(\);/u,
  );
  for (const path of [ITEM_PAGE, ITEM_LIVE, FLOW_ITEMS])
    assert.doesNotMatch(code(read(path)), /\bfetch\(/u, path);
  const live = code(read(ITEM_LIVE));
  assert.match(live, /<SectionCard\b/u);
  assert.match(live, /<EmptyRow text=\{noneYet\(declared\.runWords\)\} \/>/u);
  assert.match(
    code(read(FLOW_ITEMS)),
    /<EmptyRow text=\{noneYet\(declared\.words\)\} \/>/u,
  );
});

test("the privacy page says Candidate Reviewer has an AI model read the job description and each resume, through OpenRouter, with nothing else from the workspace (plan §5.6)", () => {
  const text = read("app/(marketing)/privacy/page.tsx")
    .replace(/\{" "\}/gu, " ")
    .replace(/&apos;/gu, "'")
    .replace(/\s+/gu, " ");
  for (const said of [
    "Candidate Reviewer has an AI model read the job description given to it when a job is uploaded, and each resume given to that job's runs,",
    "to OpenRouter in the same way and under the same rules;",
    "and nothing else from your workspace: not your name, email address or other account details, and not the flow's settings.",
  ])
    assert.ok(text.includes(said), said);
});
