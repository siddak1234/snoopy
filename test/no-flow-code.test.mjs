import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import { loadBlocks, visibleWords } from "./blocks-harness.mjs";

/**
 * No code for one flow (backend BUILD-PLAN 27.5.2; MASTER-PLAN §3.4). The owner,
 * 2026-10-21: "if i create a new automation, automation and backend update
 * should show up on the app ... eventually app wouldnt need updates." A page
 * draws what the platform sends — the catalog entry's manifest fields, a
 * run's steps, details and documents — so no source here compares a flow's
 * `templateId` with an id written in it, or switches on one. The app holds the
 * same test (`snoopy-mobile/__tests__/no-flow-code.test.ts`).
 *
 * And since the blocks (backend ADR-0048 decision 11), three more: the run,
 * item and file pages and `components/blocks` read none of the fields a page
 * once drew by kind — documents, sections, details, or a flow's document,
 * verdict or run words — but for the one Archive line, by its exact text;
 * the renderer draws the contract's thirteen types and the fallback for any
 * other; and no block is ever drawn as markup.
 */

const root = resolve(import.meta.dirname, "..");
const FOLDERS = ["app", "components", "lib", "hooks"];
const SKIP = new Set(["lib/generated"]);

/** A comparison of `templateId` with a written string, either way round, or a switch on it. */
export const FLOW_CODE = [
  /\btemplateId\s*(?:===|!==|==|!=)\s*["'`]/u,
  /["'`][^"'`\n]*["'`]\s*(?:===|!==|==|!=)\s*[\w.?]*\btemplateId\b/u,
  /switch\s*\([^)]*\btemplateId\b[^)]*\)/u,
];

function sources(folder) {
  const out = [];
  for (const name of readdirSync(join(root, folder))) {
    const path = join(folder, name);
    if (SKIP.has(path)) continue;
    if (statSync(join(root, path)).isDirectory()) out.push(...sources(path));
    else if (/\.(?:ts|tsx|mjs|js)$/u.test(name)) out.push(path);
  }
  return out;
}

export function flowCode(text) {
  return text
    .split("\n")
    .map((line, at) => ({ line, at: at + 1 }))
    .filter(({ line }) => FLOW_CODE.some((pattern) => pattern.test(line)));
}

test("no source compares a flow's templateId with a written id, or switches on it", () => {
  const found = FOLDERS.flatMap((folder) => sources(folder)).flatMap((path) =>
    flowCode(readFileSync(join(root, path), "utf8")).map(
      ({ at, line }) =>
        `${relative(root, join(root, path))}:${at}: ${line.trim()}`,
    ),
  );
  assert.deepEqual(found, []);
});

test("the guard sees each shape it refuses", () => {
  for (const planted of [
    'if (entry.templateId === "invoice-processing") return "Invoice";',
    "const isInvoices = 'invoice-processing' === run.templateId;",
    "switch (flow.templateId) {",
    "return run?.templateId !== `invoice-processing`;",
  ])
    assert.equal(flowCode(planted).length, 1, planted);
  for (const allowed of [
    "(candidate) => candidate.templateId === templateId,",
    "catalog.automations.find((a) => a.templateId === run.templateId)",
    '(entry) => entry.templateId === templateId && entry.status !== "archived",',
  ])
    assert.equal(flowCode(allowed).length, 0, allowed);
});

/** The pages that draw blocks, and the blocks themselves. */
const BLOCK_PAGES = [
  "app/account/runs/[runId]",
  "app/account/flows/[subscriptionId]/items",
  "components/blocks",
];

/** A read of what a page once drew by kind, or of a flow's own words. */
export const KIND_READS = [
  /\.documents\b/u,
  /\.sections\b/u,
  /\.details\b/u,
  /\bdocumentWords\b/u,
  /\bverdictWords\b/u,
  /\brunWords\b/u,
];

/** The one line allowed: Archive's sentence names the flow's runs (ItemLive). */
const KIND_READS_ALLOWED = new Map([
  [
    "app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx",
    "runsWord={declared.runWords.plural}",
  ],
]);

export function kindReads(path, text) {
  return text
    .split("\n")
    .map((line, at) => ({ line, at: at + 1 }))
    .filter(
      ({ line }) =>
        KIND_READS.some((pattern) => pattern.test(line)) &&
        KIND_READS_ALLOWED.get(path) !== line.trim(),
    );
}

test("the run, item and file pages and the blocks read no documents, sections, details or a flow's words — the Archive line alone, by its text (ADR-0048 decision 11)", () => {
  const found = BLOCK_PAGES.flatMap((folder) => sources(folder)).flatMap(
    (path) =>
      kindReads(path, readFileSync(join(root, path), "utf8")).map(
        ({ at, line }) => `${path}:${at}: ${line.trim()}`,
      ),
  );
  assert.deepEqual(found, []);
  const item = "app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx";
  assert.ok(
    readFileSync(join(root, item), "utf8")
      .split("\n")
      .some((line) => line.trim() === KIND_READS_ALLOWED.get(item)),
    "the allowed Archive line is still there",
  );
});

test("the kind-read guard sees each read it refuses, and allows only the exact Archive line", () => {
  const page = "app/account/runs/[runId]/RunLive.tsx";
  for (const planted of [
    "const { documents } = detail; const cards = detail.documents;",
    "{detail.sections?.map((section) => section.title)}",
    "details={detail.details}",
    "heading={flow?.documentWords?.singular}",
    "const tiles = tilesOf(item, declared.verdictWords);",
    "{addRunLabel(declared.runWords)}",
  ])
    assert.equal(kindReads(page, planted).length, 1, planted);
  const item = "app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx";
  assert.equal(
    kindReads(item, "runsWord={declared.runWords.plural}").length,
    0,
  );
  assert.equal(
    kindReads(item, "runsWord={declared.runWords.singular}").length,
    1,
    "only the exact line",
  );
  assert.equal(
    kindReads(page, "runsWord={declared.runWords.plural}").length,
    1,
  );
});

/** Markup made from a block's words: never in the blocks. */
export const MARKUP =
  /dangerouslySetInnerHTML|\.innerHTML\s*=|insertAdjacentHTML/u;

test("no block is drawn as markup: no dangerouslySetInnerHTML under components/blocks (ADR-0048, Security)", () => {
  const found = sources("components/blocks").filter((path) =>
    MARKUP.test(readFileSync(join(root, path), "utf8")),
  );
  assert.deepEqual(found, []);
  for (const planted of [
    "<p dangerouslySetInnerHTML={{ __html: block.text }} />",
    "node.innerHTML = block.text;",
  ])
    assert.equal(MARKUP.test(planted), true, planted);
});

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());

test("the renderer draws exactly the contract's types, and the fallback for any it does not know (test/blocks-render.test.mjs)", () => {
  const generated = readFileSync(
    join(root, "lib/generated/platform-contracts/automations.d.ts"),
    "utf8",
  );
  const union = generated.slice(
    generated.indexOf("\n    Block:\n"),
    generated.indexOf("\n    FlowPages:"),
  );
  assert.deepEqual(
    Object.keys(blocks.RENDERERS).sort(),
    [...union.matchAll(/^ {10}type: "([a-z-]+)";$/gmu)]
      .map((match) => match[1])
      .sort(),
  );
  for (const name of ["unknown-type", "unknown-form", "unknown-target"]) {
    const fixture = BLOCK_FIXTURES.find((candidate) => candidate.name === name);
    assert.ok(fixture, name);
    assert.deepEqual(visibleWords(blocks.render(fixture.blocks)), [
      ...fixture.text,
    ]);
  }
});
