import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { BLOCK_SPACING } from "../lib/generated/platform-contracts/block-rules.ts";
import { NONE, SPACING, spacingClasses } from "../lib/spacing.ts";
import { offTable, spacingSources, spacingTokens } from "./spacing-scan.mjs";

/**
 * The spacing table (backend `BLOCK_SPACING`, ADR-0048 amendment 1; the
 * owner's F3 and Q8) on this site: every class `lib/spacing.ts` names is its
 * name's number at Tailwind's 4 px a step, and every padding, margin and gap
 * class under components/ and app/account is one of them — but for the
 * classes written before the table, counted file by file in
 * `test/spacing-baseline.json`, which may only go down. So a new `py-5`
 * anywhere fails here, and a part the table spaces (the page card, the
 * titles, the rows, the tiles, the lists, the blocks) holds none.
 */

const root = resolve(import.meta.dirname, "..");
const BASELINE = JSON.parse(
  readFileSync(join(root, "test/spacing-baseline.json"), "utf8"),
).files;

/** A class's number in pixels: its last step, 4 px each. */
const pixels = (token) => Number(/-(\d+(?:\.\d+)?)$/u.exec(token)[1]) * 4;

test("every class in lib/spacing.ts is its name's number in the platform's table, at 4 px a step", () => {
  assert.deepEqual(
    Object.keys(SPACING).sort(),
    Object.keys(BLOCK_SPACING).sort(),
  );
  for (const [name, forms] of Object.entries(SPACING))
    for (const token of Object.values(forms))
      assert.equal(pixels(token), BLOCK_SPACING[name], `${name}: ${token}`);
  for (const token of NONE) assert.equal(pixels(token), 0, token);
  assert.deepEqual(BLOCK_SPACING, {
    edge: 20,
    edgeWide: 24,
    group: 16,
    title: 8,
    inner: 8,
    rowY: 12,
    rowX: 16,
    rowMinHeight: 44,
    card: 16,
    cardWide: 24,
    bottom: 24,
  });
});

/** Where each source's off-table classes go over what the baseline allows. */
function overBaseline(found) {
  const over = [];
  for (const [path, classes] of Object.entries(found))
    for (const [token, count] of Object.entries(classes)) {
      const allowed = BASELINE[path]?.[token] ?? 0;
      if (count > allowed)
        over.push(`${path}: ${token} ×${count} (allowed ${allowed})`);
    }
  return over;
}

test("the spacing check: no padding, margin or gap class under components/ and app/account outside the table's, past the baseline", () => {
  assert.ok(
    spacingSources().length > 100,
    `${spacingSources().length} sources`,
  );
  assert.deepEqual(overBaseline(offTable(spacingClasses())), []);
  // The baseline names only sources that are there.
  const sources = new Set(spacingSources());
  for (const path of Object.keys(BASELINE)) assert.ok(sources.has(path), path);
});

test("the parts the table spaces hold no class of their own: the page card, the shell, the titles, the rows, the tiles, the lists and the blocks", () => {
  for (const path of [
    "app/account/layout.tsx",
    "components/dashboard/SectionCard.tsx",
    "components/dashboard/SectionTitle.tsx",
    "components/dashboard/Group.tsx",
    "components/dashboard/SectionRows.tsx",
    "components/dashboard/PageRow.tsx",
    "components/dashboard/Tile.tsx",
    "components/dashboard/FileActions.tsx",
    "components/dashboard/FileView.tsx",
    "components/blocks/BlockList.tsx",
    "components/blocks/renderers.tsx",
    "components/blocks/GroupCard.tsx",
    "components/blocks/Paged.tsx",
    "components/blocks/ListTools.tsx",
    "components/blocks/Picture.tsx",
    "app/account/runs/page.tsx",
    "app/account/runs/ActivityControls.tsx",
    "app/account/flows/FlowItems.tsx",
    "app/account/settings/page.tsx",
  ]) {
    assert.equal(BASELINE[path], undefined, `${path} is in the baseline`);
    assert.ok(spacingSources().includes(path), path);
  }
});

test("a planted py-5 fails the check, in a part and in a screen alike", () => {
  const read = (path) => readFileSync(join(root, path), "utf8");
  for (const target of [
    "components/blocks/renderers.tsx",
    "app/account/settings/page.tsx",
    "components/marketing/ScrollStory.tsx",
  ]) {
    const planted = offTable(spacingClasses(), (path) =>
      path === target ? `${read(path)}\nconst planted = "py-5";\n` : read(path),
    );
    assert.deepEqual(
      overBaseline(planted).filter((line) => line.startsWith(target)),
      [
        `${target}: py-5 ×${(BASELINE[target]?.["py-5"] ?? 0) + 1} (allowed ${BASELINE[target]?.["py-5"] ?? 0})`,
      ],
      target,
    );
  }
  // What the reader takes as a class, and what it leaves.
  assert.deepEqual(
    spacingTokens(
      'className={`flex ${SPACING.inner.gap} py-3 sm:px-8`} title="gap-2 a"',
    ),
    ["py-3", "sm:px-8", "gap-2"],
  );
  assert.deepEqual(spacingTokens('"min-h-11 h-4 w-6 top-2 space-x-2"'), [
    "space-x-2",
  ]);
});
