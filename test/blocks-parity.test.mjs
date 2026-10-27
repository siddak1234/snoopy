import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import { spacingClasses } from "../lib/spacing.ts";
import {
  elements,
  loadBlocks,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";
import { spacingTokens } from "./spacing-scan.mjs";

/**
 * Word parity with the app (backend ADR-0048 decision 9): every fixture the
 * platform publishes (`packages/contracts/fixtures/blocks`, generated into
 * `lib/generated/platform-contracts/block-fixtures.ts` with its sha256),
 * drawn by `BlockList`, says exactly its `text` — its visible words in
 * reading order, closed sections left out. The app asserts the same fixtures
 * (`snoopy-mobile/__tests__/blocks-parity.test.tsx`), so the two clients say
 * the same words when their headers name the same sha. And the same space:
 * the renderers use only the table's classes (`lib/spacing.ts`), and the
 * table, the words and the search and sort cases are the platform's, its
 * folder's sha in `block-rules.ts`'s header.
 */

const root = resolve(import.meta.dirname, "..");
const backendRoot = resolve(
  root,
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
const RULES = join(backendRoot, "packages/contracts/fixtures/block-rules");

let blocks;
before(async () => {
  blocks = await loadBlocks();
});
after(() => blocks?.cleanup());

test("the platform publishes the fixtures this site draws: 26 of them in block set 2", () => {
  assert.equal(BLOCK_FIXTURES.length, 26, `${BLOCK_FIXTURES.length} fixtures`);
  assert.ok(BLOCK_FIXTURES.every((fixture) => fixture.blockSetVersion === 2));
  for (const name of [
    "long-list",
    "long-table",
    "ranked-runs-searchable",
    "reviewer-item-verdicts",
    "reviewer-candidate-grouped",
    "reviewer-item-scores",
  ])
    assert.ok(
      BLOCK_FIXTURES.some((fixture) => fixture.name === name),
      name,
    );
});

test("the scores chart is drawn as an image read aloud as the fixture's alt", () => {
  const scores = BLOCK_FIXTURES.find(
    (fixture) => fixture.name === "reviewer-item-scores",
  );
  const chart = scores.blocks.find((block) => block.type === "chart");
  const [box] = elements(parse(blocks.render(scores.blocks))).filter(
    (node) => node.attrs["data-testid"] === "block-chart",
  );
  assert.equal(box.attrs.role, "img");
  assert.equal(box.attrs["aria-label"], chart.alt);
});

test("the renderers use only the spacing table's classes", () => {
  const allowed = new Set(spacingClasses());
  for (const name of readdirSync(join(root, "components/blocks")).filter(
    (file) => /\.tsx$/u.test(file),
  )) {
    const off = spacingTokens(
      readFileSync(join(root, "components/blocks", name), "utf8"),
    ).filter((token) => !allowed.has(token));
    assert.deepEqual(off, [], name);
  }
});

test(
  "the generated block rules name the sha256 of the platform's block-rules folder, its files in name order",
  {
    skip: existsSync(RULES)
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    const hash = createHash("sha256");
    for (const name of readdirSync(RULES)
      .filter((file) => file.endsWith(".json"))
      .sort())
      hash.update(readFileSync(join(RULES, name)));
    const first = readFileSync(
      join(root, "lib/generated/platform-contracts/block-rules.ts"),
      "utf8",
    ).split("\n")[0];
    assert.equal(
      first,
      `// From snoopy-backend packages/contracts/fixtures/block-rules/*.json, sha256 ${hash.digest("hex")}.`,
    );
  },
);

for (const fixture of BLOCK_FIXTURES) {
  test(`${fixture.name}: ${fixture.about} — drawn, it says exactly its text`, () => {
    assert.deepEqual(visibleWords(blocks.render(fixture.blocks)), [
      ...fixture.text,
    ]);
  });
}
