import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import { BLOCK_WORDS } from "../lib/generated/platform-contracts/block-rules.ts";

/**
 * One source for search, sort and pages' words (backend ADR-0048 amendment
 * 1, decision 8): the platform's `BLOCK_WORDS`, generated into
 * `block-rules.ts`, and never typed here. No value of it is a string literal
 * under components/blocks, in a flow's items (`FlowItems.tsx`) or on
 * Activity (`app/account/runs/page.tsx`, `ActivityControls.tsx`) — the app
 * holds the same test — so neither client can drift from the owner's words.
 */

const root = resolve(import.meta.dirname, "..");
const PLACES = [
  ...readdirSync(join(root, "components/blocks"))
    .filter((name) => /\.tsx?$/u.test(name))
    .map((name) => `components/blocks/${name}`),
  "app/account/flows/FlowItems.tsx",
  "app/account/runs/page.tsx",
  "app/account/runs/ActivityControls.tsx",
];

/** A source's literal text: its strings, its templates' text and its JSX text — never its comments. */
function literals(source) {
  const file = ts.createSourceFile(
    "source.tsx",
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const out = [];
  const walk = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      out.push(node.text);
    else if (ts.isJsxText(node)) out.push(node.text.trim());
    ts.forEachChild(node, walk);
  };
  walk(file);
  return out;
}

/** Each `BLOCK_WORDS` value a source types as a literal: a string, a template's text or JSX text. */
export function typedWords(source) {
  const typed = literals(source);
  return Object.values(BLOCK_WORDS).filter((words) =>
    typed.some((text) => text === words),
  );
}

test("the platform publishes exactly the owner's new words for search, sort and pages", () => {
  assert.deepEqual(BLOCK_WORDS, {
    search: "Search",
    searchItems: "Search {items}",
    searchRuns: "Search runs",
    clearSearch: "Clear search",
    noMatch: 'Nothing matches "{query}".',
    sort: "Sort",
    defaultOrder: "Default order",
    aToZ: "A to Z",
    newestFirst: "Newest first",
    oldestFirst: "Oldest first",
    highToLow: "{label}: high to low",
    columnAToZ: "{column}: A to Z",
    columnHighToLow: "{column}: high to low",
    previous: "Previous",
    next: "Next",
    pageOf: "Page {n} of {total}",
    previousPage: "Previous page",
    nextPage: "Next page",
  });
});

test("no BLOCK_WORDS value is typed as a literal in the blocks, a flow's items or Activity", () => {
  assert.ok(PLACES.length >= 10, PLACES.join(", "));
  const found = PLACES.flatMap((path) =>
    typedWords(readFileSync(join(root, path), "utf8")).map(
      (words) => `${path}: ${words}`,
    ),
  );
  assert.deepEqual(found, []);
  // Each place reads them from the platform's file.
  for (const path of [
    "components/blocks/ListTools.tsx",
    "components/blocks/Paged.tsx",
    "app/account/flows/FlowItems.tsx",
    "app/account/runs/page.tsx",
    "app/account/runs/ActivityControls.tsx",
  ])
    assert.match(
      readFileSync(join(root, path), "utf8"),
      /from "@\/lib\/generated\/platform-contracts\/block-rules";/u,
      path,
    );
});

test("a planted literal fails it: quoted, in a template, or as JSX text", () => {
  for (const planted of [
    'const hint = "Search runs";',
    "placeholder={'Default order'}",
    "label: `Oldest first`,",
    "<span>Next</span>",
    "<Button>\n  Previous\n</Button>",
  ])
    assert.equal(typedWords(planted).length, 1, planted);
  assert.deepEqual(
    typedWords(
      '// Says "Search runs".\nconst z = <b>{BLOCK_WORDS.next}</b>;\n/* "Sort" */',
    ),
    [],
    "comments and the words read from the file are not literals",
  );
});
