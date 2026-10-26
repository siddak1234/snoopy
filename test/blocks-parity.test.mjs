import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import { loadBlocks, visibleWords } from "./blocks-harness.mjs";

/**
 * Word parity with the app (backend ADR-0048 decision 9): every fixture the
 * platform publishes (`packages/contracts/fixtures/blocks`, generated into
 * `lib/generated/platform-contracts/block-fixtures.ts` with its sha256),
 * drawn by `BlockList`, says exactly its `text` — its visible words in
 * reading order, closed sections left out. The app asserts the same fixtures
 * (`snoopy-mobile/__tests__/blocks-parity.test.tsx`), so the two clients say
 * the same words when their headers name the same sha.
 */

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());

test("the platform publishes the fixtures this site draws", () => {
  assert.ok(BLOCK_FIXTURES.length >= 15, `${BLOCK_FIXTURES.length} fixtures`);
});

for (const fixture of BLOCK_FIXTURES) {
  test(`${fixture.name}: ${fixture.about} — drawn, it says exactly its text`, () => {
    assert.deepEqual(visibleWords(blocks.render(fixture.blocks)), [
      ...fixture.text,
    ]);
  });
}
