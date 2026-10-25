import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { byDepartment } from "../app/account/flows/departments.ts";
import {
  RUN_DETAILS,
  runDetailsPath,
  runSectionsHeading,
} from "../lib/run-progress.ts";

/**
 * Build 28's screens on the website (Round 19, plan §3; the owner's build 28
 * items 1–9): the Flows list by department A–Z; a flow with items with no
 * Dashboard and no Steps; every select the website's drop-down, never the
 * browser's own; an item's runs in compact rows and its sections off its
 * page; a run's page with "{Run word} details" first and the Run details row
 * for every run, its details page holding the result line, the tiles, the
 * steps and the facts. `test/flow-items.test.mjs` holds the item rules,
 * `e2e/flow-items.spec.ts` what a browser draws. The fixtures are made up.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
/** A source file's code alone: its comments — where gone words are struck through — left out. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

const FLOW_PAGE = "app/account/flows/[subscriptionId]/page.tsx";
const RUN_LIVE = "app/account/runs/[runId]/RunLive.tsx";
const DROPDOWN = "components/ui/Dropdown.tsx";

test("the Flows list is grouped by department, the departments A–Z, each keeping the catalog's order (item 1)", () => {
  // The catalog's order, which an A–Z sort of the departments changes, and
  // within one department an order a sort by name would change.
  const entry = (name, category) => ({ name, category });
  const groups = byDepartment([
    entry("Zeta report", "Operations"),
    entry("Bills", "Accounting"),
    entry("Alpha report", "Operations"),
    entry("Hiring", "HR"),
    entry("Audit", "accounting"),
  ]);
  assert.deepEqual(
    groups.map((group) => [
      group.department,
      group.entries.map((each) => each.name),
    ]),
    [
      ["Accounting", ["Bills"]],
      ["accounting", ["Audit"]],
      ["HR", ["Hiring"]],
      ["Operations", ["Zeta report", "Alpha report"]],
    ],
  );
  assert.deepEqual(byDepartment([]), []);
  // The page draws them so, its card no longer saying its category.
  const page = code(read("app/account/flows/page.tsx"));
  assert.match(
    page,
    /byDepartment\(catalog\.automations\)\.map\(\(\{ department, entries \}\) => \(/u,
  );
  assert.doesNotMatch(page, /\{automation\.category\}/u);
});

test("a flow with items has no Dashboard and no Steps: its items are its page, Turn on and what it is owed above them (items 2 and 3)", () => {
  const page = code(read(FLOW_PAGE));
  const items = page.indexOf("{declaredItems ? (");
  const dashboard = page.indexOf('aria-labelledby="flow-dashboard-title"');
  const steps = page.indexOf('aria-labelledby="flow-steps-title"');
  const fallback = page.indexOf(") : (", items);
  assert.ok(items > 0, "the page asks whether the flow has items");
  // The Dashboard and the Steps are drawn only on the other side of it.
  assert.ok(fallback > items && dashboard > fallback && steps > dashboard);
  assert.match(
    page,
    /\{declaredItems \? \(\s*!live \|\| owed\.length > 0 \|\| notResponding \? \(\s*<div className="py-5 first:pt-0">\s*\{notResponding\}\s*\{stepOne\}/u,
  );
});

test("the website's drop-down is a select-only combobox over a listbox of glass, never the browser's own select; the upload card and the item filter use it (decision 7)", () => {
  const dropdown = code(read(DROPDOWN));
  assert.match(dropdown, /role="combobox"/u);
  assert.match(dropdown, /aria-haspopup="listbox"/u);
  assert.match(dropdown, /role="listbox"/u);
  assert.match(dropdown, /role="option"\s+aria-selected=\{selected\}/u);
  // Glass: the surface at 80 % over a blur, as `.bubble-soft`.
  assert.match(
    dropdown,
    /bg-\[color-mix\(in_srgb,var\(--color-surface\)_80%,transparent\)\][^"]*backdrop-blur-\[8px\]/u,
  );
  // Escape closes it alone, before a dialog hears it.
  assert.match(
    dropdown,
    /document\.addEventListener\("keydown", onKeyDown, true\);/u,
  );
  const card = code(read("app/account/flows/UploadItemCard.tsx"));
  assert.doesNotMatch(card, /<select\b|<option\b/u);
  assert.match(
    card,
    /<Dropdown\s+id=\{id\}\s+labelledBy=\{`\$\{id\}-label`\}/u,
  );
  // A choice made in it is a change of value: a new key, as a typed one.
  assert.match(
    card,
    /onPick=\{\(value\) => \{\s*setPicked\(\(current\) => \(\{ \.\.\.current, \[field\.key\]: value \}\)\);\s*newItemKey\(\);/u,
  );
  const items = code(read("app/account/flows/FlowItems.tsx"));
  assert.match(items, /<Dropdown\s+id=\{filterId\}\s+look="pill"/u);
  assert.match(items, /groupItems\(list\.items, groupField, shown\)/u);
});

test("an item's page draws no sections, and its runs as rows the height of a section's (items 4 and 5)", () => {
  const live = code(
    read("app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx"),
  );
  assert.doesNotMatch(live, /SectionRows|item\.sections/u);
  assert.match(
    live,
    /<PageRow\s+href=\{`\/account\/runs\/\$\{encodeURIComponent\(row\.id\)\}`\}/u,
  );
  const row = code(read("components/dashboard/PageRow.tsx"));
  assert.match(row, /className=\{`\$\{SECTION_ROW\} \$\{SECTION_BAR\} /u);
  assert.match(
    code(read("components/dashboard/SectionRows.tsx")),
    /className=\{`\$\{SECTION_BAR\} cursor-pointer/u,
  );
});

test("Run details: its row on every run's page, its page the tiles, the steps and the facts; the result line only for a run that read no sections (items 8 and 9)", () => {
  assert.equal(RUN_DETAILS, "Run details");
  assert.equal(runDetailsPath("r 1/2"), "/account/runs/r%201%2F2/details");
  assert.equal(runSectionsHeading("Entry"), "Entry details");
  assert.equal(runSectionsHeading(undefined), "Details");
  const live = code(read(RUN_LIVE));
  const split = live.indexOf('if (view === "details") {');
  const runPage = live.indexOf("return (", live.indexOf("\n  }\n", split));
  assert.ok(split > 0 && runPage > split);
  const details = live.slice(split, runPage);
  const run = live.slice(runPage, live.indexOf("type PackageFormat"));
  for (const drawn of [
    'label="Duration"',
    'label="Steps done"',
    'data-testid="run-steps"',
    "<ApprovalDecision",
    "data-testid={`run-fact-${fact.label}`}",
  ]) {
    assert.ok(details.includes(drawn), `the details page draws ${drawn}`);
    assert.ok(!run.includes(drawn), `the run's page does not draw ${drawn}`);
  }
  // How it went stays for a run that read no sections; sections take its
  // place (item 8: "Instead of strong match 6 of 6").
  assert.ok(!details.includes('data-testid="run-result"'));
  assert.match(
    run,
    /\{result && !hasSections \? \(\s*<div className="py-5 first:pt-0">\s*<p\s+data-testid="run-result"/u,
  );
  // The row is drawn for every run, under no condition, before View flow.
  assert.match(
    run,
    /<div className="py-5 first:pt-0">\s*(?:\{\s*\}\s*)?<PageRow href=\{runDetailsPath\(run\.id\)\} testId="run-details-row">/u,
  );
  assert.ok(run.indexOf("run-details-row") < run.indexOf("View flow"));
  // What it read comes first, under the flow's word for a run.
  assert.match(run, /\{runSectionsHeading\(flow\?\.runWord\)\}/u);
  assert.ok(
    run.indexOf('testId="run-section"') < run.indexOf("run-documents-title"),
  );
  // Both pages read the run as the other does.
  for (const path of [
    "app/account/runs/[runId]/page.tsx",
    "app/account/runs/[runId]/details/page.tsx",
  ]) {
    const page = code(read(path));
    assert.match(page, /readRunPage\(\s*workspaceId,\s*runId,\s*\)/u, path);
    assert.match(page, /resolveActiveWorkspaceId/u, path);
  }
  assert.match(
    code(read("app/account/runs/[runId]/details/page.tsx")),
    /view="details"/u,
  );
  assert.match(code(read("app/account/runs/[runId]/page.tsx")), /view="run"/u);
});
