import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BLOCK_SEARCH,
  BLOCK_SORT,
  BLOCK_WORDS,
} from "../lib/generated/platform-contracts/block-rules.ts";
import {
  asNumber,
  listChoices,
  matches,
  pageCount,
  pageRows,
  pageWithin,
  search,
  sortList,
  sortTable,
  tableChoices,
} from "../lib/block-sort.ts";

/**
 * Search and sort as both clients do them (backend ADR-0048 amendment 1,
 * decision 4): every case the platform publishes
 * (`snoopy-backend/packages/contracts/fixtures/block-rules/search.json` and
 * `sort.json`, generated into
 * `block-rules.ts`), list values included, passes here exactly as written —
 * the app runs the same cases, so the two clients find and order alike.
 */

test("the platform publishes the cases and one page size", () => {
  assert.equal(BLOCK_SEARCH.pageSize, 25);
  assert.equal(BLOCK_SEARCH.queryLength, 80);
  assert.ok(BLOCK_SEARCH.cases.length >= 9, `${BLOCK_SEARCH.cases.length}`);
  assert.ok(BLOCK_SORT.cases.length >= 12, `${BLOCK_SORT.cases.length}`);
});

for (const item of BLOCK_SEARCH.cases) {
  test(`search: ${item.name}`, () => {
    const found = item.rows
      .map((row, at) => (matches(item.query, row) ? at : -1))
      .filter((at) => at >= 0);
    assert.deepEqual(found, [...item.matches]);
    assert.deepEqual(
      search(item.rows, item.query, (row) => row),
      item.matches.map((at) => item.rows[at]),
    );
  });
}

for (const item of BLOCK_SORT.cases) {
  test(`sort (${item.kind}): ${item.name}`, () => {
    const choices =
      item.kind === "list"
        ? listChoices(item.rows, BLOCK_WORDS)
        : tableChoices(
            item.columns.map((title) => ({ title })),
            item.rows,
            BLOCK_WORDS,
          );
    assert.deepEqual(
      choices.map((choice) => choice.label),
      [...item.choices],
    );
    const choice = choices.find((one) => one.label === item.choice);
    assert.ok(choice, item.choice);
    const order =
      item.kind === "list"
        ? sortList(item.rows, choice.value)
        : sortTable(item.rows, choice.value);
    assert.deepEqual(order, [...item.order]);
  });
}

test("the number rule: money, commas, spaces and one trailing percent; nothing else", () => {
  assert.equal(asNumber("$1,204.50"), 1204.5);
  assert.equal(asNumber("€ 2,010"), 2010);
  assert.equal(asNumber("12%"), 12);
  assert.equal(asNumber("-3.5"), -3.5);
  assert.equal(asNumber("12%%"), null);
  assert.equal(asNumber("n/a"), null);
  assert.equal(asNumber(""), null);
  assert.equal(asNumber(undefined), null);
});

test("pages: 25 a page, at least one, a page held to the last", () => {
  const rows = Array.from({ length: 30 }, (_, at) => at);
  assert.equal(pageCount(30, 25), 2);
  assert.equal(pageCount(0, 25), 1);
  assert.deepEqual(pageRows(rows, 2, 25), [25, 26, 27, 28, 29]);
  assert.equal(pageWithin(9, 30, 25), 2);
  assert.equal(pageWithin(0, 30, 25), 1);
  assert.equal(pageWithin(Number.NaN, 30, 25), 1);
});
