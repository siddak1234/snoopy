import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import {
  elements,
  loadBlocks,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Round 19's website guards that are not one module's (plan §5; backend
 * ADR-0046): a flow with items draws them in place of its run start form; the
 * buttons that make, add to and archive an item are an owner's or admin's;
 * sections are rows that open and close, the first open on a run's page and
 * none on an item's; a run of an item names it; the item's page is read per
 * request through lib/platform-server.ts; and the privacy page says what
 * Candidate Reviewer has read. `test/flow-items.test.mjs` holds the rules;
 * `e2e/flow-items.spec.ts` what a browser draws. Since Round 21 (backend
 * ADR-0048) a run's and an item's bodies are the platform's blocks, read
 * here from its fixtures as `BlockList` draws them.
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
const RENDERERS = "components/blocks/renderers.tsx";

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());
const fixture = (name) => {
  const found = BLOCK_FIXTURES.find((candidate) => candidate.name === name);
  assert.ok(found, name);
  return found;
};

test("a flow with items draws them, and its run start form gets no fields — Turn on only (plan §5.1; no steps since build 28: test/build28-screens.test.mjs)", () => {
  const page = code(read(FLOW_PAGE));
  assert.match(page, /const declaredItems = subscription\.items;/u);
  assert.match(
    page,
    /runInput=\{declaredItems \? \[\] : \(subscription\.runInput \?\? \[\]\)\}/u,
  );
  assert.match(
    page,
    /\{declaredItems && items !== undefined \? \(\s*<FlowItems[\s\S]*?declared=\{declaredItems\}[\s\S]*?canManage=\{canManage\}/u,
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
  // Add only where a run can start (`canAddRun`, finding 3 of the review):
  // the platform's run form drawn by RunStart under that gate alone.
  assert.match(
    live,
    /const canAdd = canAddRun\(\{\s*canManage,\s*item,\s*live,\s*available,\s*runInputs: runInput\.length,\s*\}\);/u,
  );
  assert.match(
    live,
    /run: \(form\) =>\s*canAdd \? \(\s*<div data-testid="item-add">\s*<RunStart/u,
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

test("sections open and close: every one closed but the first on a run's page; all closed in an item's reading (plan §5.3, §5.4; build 28, item 4; backend ADR-0048)", () => {
  const openOf = (name) =>
    elements(parse(blocks.render(fixture(name).blocks)))
      .filter((node) => node.tag === "details")
      .map((node) => "open" in node.attrs);
  assert.deepEqual(openOf("reviewer-candidate"), [true, false]);
  assert.deepEqual(openOf("reviewer-item-reading"), [false, false]);
  assert.match(
    code(read(RENDERERS)),
    /<details\s+data-testid="block-section"\s+open=\{block\.open === true\}/u,
  );
  const live = code(read(ITEM_LIVE));
  assert.doesNotMatch(live, /<SectionRows\b|firstOpen/u);
});

test("a section's link is drawn only when https, opening outside with noopener noreferrer; an http address its words alone (backend ADR-0048)", () => {
  const renderers = code(read(RENDERERS));
  assert.match(renderers, /const link = httpsLink\(item\.url\);/u);
  assert.match(
    renderers,
    /link \? \(\s*<a\s+href=\{link\.href\}\s+target="_blank"\s+rel="noopener noreferrer"/u,
  );
  assert.doesNotMatch(renderers, /href=\{item\.url\}/u);
  const markup = blocks.render(fixture("reviewer-candidate").blocks);
  const anchors = elements(parse(markup)).filter(
    (node) => node.tag === "a" && node.attrs.target,
  );
  assert.deepEqual(
    anchors.map((node) => [node.attrs.href, node.attrs.rel]),
    [["https://school.example.test/accounting", "noopener noreferrer"]],
  );
});

test("a run with a title and a score is headed by them, the full id kept among its facts; its sections come first, in its result line's place, the steps on its details page (plan §5.4; build 28, items 8 and 9)", () => {
  const live = code(read(RUN_LIVE));
  assert.match(
    live,
    /const headed = run\.title !== undefined && run\.score !== undefined;/u,
  );
  assert.match(
    live,
    /const name = headed && run\.title \? run\.title : runLabel\(run\.id\);/u,
  );
  assert.match(live, /<SectionCard\s+title=\{name\}/u);
  assert.match(live, /data-testid="run-score"/u);
  assert.match(live, /\{ label: "Run ID", value: run\.id \}/u);
  // The details page's tiles and steps, then the run's page: its body.
  const details = live.indexOf('if (view === "details") {');
  assert.ok(
    details > 0 &&
      details < live.indexOf('label="Duration"') &&
      live.indexOf('label="Duration"') < live.indexOf('id="run-steps-title"') &&
      live.indexOf('id="run-steps-title"') < live.indexOf("<BlockList"),
  );
  // First on the run's page, under "{Run word} details", in the result
  // line's place (build 28's items 7 and 8).
  assert.deepEqual(
    visibleWords(blocks.render(fixture("reviewer-candidate").blocks)).slice(
      1,
      3,
    ),
    ["Candidate details", "Experience"],
  );
});

test("an item list the platform could not answer is Unavailable, never None yet (finding 2 of the review)", () => {
  const page = code(read(FLOW_PAGE));
  assert.match(
    page,
    /async function readItems\([^)]*\): Promise<ListItemsResponse \| null> \{\s*try \{\s*return await listItems\(workspaceId, subscriptionId\);\s*\} catch \(error\) \{\s*if \([^)]*\)\s*return null;/u,
  );
  assert.match(page, /\{declaredItems && items !== undefined \? \(/u);
  assert.match(
    code(read(FLOW_ITEMS)),
    /<EmptyRow\s+text=\{list \? noneYet\(declared\.words\) : EMAIL_UNAVAILABLE\}/u,
  );
});

test("the upload card's Other box has its own visible name, Other — never the select's (finding 6 of the review)", () => {
  const card = code(read("app/account/flows/UploadItemCard.tsx"));
  assert.match(card, /<FormInput\s+id=\{`\$\{id\}-other`\}\s+label=\{OTHER\}/u);
  assert.doesNotMatch(card, /aria-label=\{field\.title\}/u);
});

test("the item refusals are one set of words with the app's: Nothing was uploaded, Try again in a moment, the archive line in the flow's run word (finding 9 of the review)", () => {
  const actions = code(read("app/account/flows/actions.ts"));
  assert.match(
    actions,
    /const ITEM_VALUES_REFUSED =\s*"Nothing was uploaded\. Check each value and try again\.";/u,
  );
  assert.match(actions, /error: ITEM_VALUES_REFUSED,/u);
  assert.match(
    actions,
    /const ITEM_REFUSED = "Nothing was uploaded\. Try again\.";/u,
  );
  assert.doesNotMatch(actions, /It was not made/u);
  const live = code(read(ITEM_LIVE));
  assert.match(
    live,
    /It leaves the list and takes no new \{inSentence\(runsWord\)\}\. Its\{" "\}\s*\{inSentence\(runsWord\)\} stay\./u,
  );
  // A refused field says so under it.
  assert.match(
    code(read("app/account/flows/UploadItemCard.tsx")),
    /refused\.includes\(field\.key\) \? CHECK_THIS : undefined/u,
  );
});

test("a run started on an item's page names it, and the platform's item refusals are said in words (backend ADR-0046)", () => {
  const actions = code(read("app/account/flows/actions.ts"));
  assert.match(
    actions,
    /const itemId = String\(formData\.get\("itemId"\) \?\? ""\);/u,
  );
  assert.match(actions, /\.\.\.\(itemId \? \{ itemId \} : \{\}\),/u);
  assert.match(actions, /item_not_ready: "Try again in a moment\.",/u);
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
  assert.match(live, /<BlockList\s+blocks=\{detail\.blocks\}/u);
  // Its one empty row: the platform's, drawn by EmptyRow.
  assert.deepEqual(
    visibleWords(blocks.render(fixture("empty-item").blocks)).at(-1),
    "No candidates yet.",
  );
  assert.match(code(read(RENDERERS)), /<EmptyRow text=\{block\.empty\} \/>/u);
});

test("the privacy page says Resume Screening, and Candidate Reviewer its first version, has an AI model read the job description and each resume, through OpenRouter, with nothing else from the workspace (plan §5.6; v2's name, 2026-10-25)", () => {
  const text = read("app/(marketing)/privacy/page.tsx")
    .replace(/\{" "\}/gu, " ")
    .replace(/&apos;/gu, "'")
    .replace(/\s+/gu, " ");
  for (const said of [
    "Resume Screening (and Candidate Reviewer, its first version) has an AI model read the job description given to it when a job is uploaded, and each resume given to that job's runs,",
    "to OpenRouter in the same way and under the same rules;",
    "and nothing else from your workspace: not your name, email address or other account details, and not the flow's settings.",
  ])
    assert.ok(text.includes(said), said);
});
