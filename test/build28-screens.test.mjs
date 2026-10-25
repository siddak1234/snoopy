import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { byDepartment } from "../app/account/flows/departments.ts";
import { TOTAL, itemTiles } from "../lib/flow-items.ts";
import {
  FILE_GONE,
  FILE_WORD,
  RUN_FILE_MAXIMUM_BYTES,
  fileLine,
  fileViewHref,
  itemFilePath,
  runFilePath,
  runFileRows,
  shownInPlace,
  sizeInWords,
  viewFileLabel,
} from "../lib/run-files.ts";
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
 * steps and the facts; phase B, on the contract (backend cf17dbb): an item's
 * tiles and its file page, a run's "View {file}" and its file page, each file
 * read through this site's own route. `test/flow-items.test.mjs` holds the item rules,
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
    entry("Tickets", "Customer Support"),
  ]);
  assert.deepEqual(
    groups.map((group) => [
      group.department,
      group.id,
      group.entries.map((each) => each.name),
    ]),
    [
      ["Accounting", "department-1", ["Bills"]],
      ["accounting", "department-2", ["Audit"]],
      ["Customer Support", "department-3", ["Tickets"]],
      ["HR", "department-4", ["Hiring"]],
      ["Operations", "department-5", ["Zeta report", "Alpha report"]],
    ],
  );
  // An id by place: one word, never a department's name with its space.
  for (const group of groups) assert.match(group.id, /^department-\d+$/u);
  assert.deepEqual(byDepartment([]), []);
  // The page draws them so, its card no longer saying its category.
  const page = code(read("app/account/flows/page.tsx"));
  assert.match(
    page,
    /byDepartment\(catalog\.automations\)\.map\(\(\{ department, id, entries \}\) => \(\s*<section\s+key=\{id\}\s+aria-labelledby=\{id\}/u,
  );
  assert.match(page, /<h2\s+id=\{id\}/u);
  assert.doesNotMatch(page, /department-\$\{department\}/u);
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

test("Run details: its row on every run's page, after the package's buttons and over Cancel run and View flow; its page the tiles, the steps and the facts; the result line only for a run that read no sections, a held job's decision under it (items 8 and 9; the review's findings 1 and 2)", () => {
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
    /\{\(result && !hasSections\) \|\| waiting \? \(\s*<div className="py-5 first:pt-0">\s*\{result && !hasSections \? \(\s*<p\s+data-testid="run-result"/u,
  );
  // A held job's Approve and Deny, under the result line on the run's page;
  // its details page keeps the step's state alone (finding 1).
  assert.ok(!details.includes("<ApprovalDecision"));
  assert.match(
    live,
    /const waiting =\s*run\.status === "held" &&\s*decided === "pending" &&\s*decision\?\.approval\.status === "pending";/u,
  );
  const result = run.indexOf('data-testid="run-result"');
  const decision = run.indexOf('data-testid="run-decision"');
  assert.ok(
    result > 0 && result < decision,
    "the decision under the result line",
  );
  assert.ok(decision < run.indexOf("<ApprovalDecision"));
  assert.ok(
    run.indexOf("<ApprovalDecision") < run.indexOf('testId="run-section"'),
  );
  // The row is drawn for every run, under no condition: after the package's
  // buttons, directly over Cancel run and View flow (finding 2).
  const packaged = run.indexOf("<PackageActions");
  const row = run.indexOf(
    '<PageRow href={runDetailsPath(run.id)} testId="run-details-row">',
  );
  assert.ok(
    packaged > 0 && packaged < row,
    "the package's buttons, then Run details",
  );
  assert.match(
    run.slice(row),
    /^<PageRow href=\{runDetailsPath\(run\.id\)\} testId="run-details-row">[\s\S]*?<\/PageRow>\s*<div className="mt-5 flex flex-wrap items-center gap-2">\s*(?:\{\s*\}\s*)?\{going \? \(\s*<CancelRunButton/u,
  );
  assert.ok(run.indexOf("CancelRunButton") < run.indexOf("View flow"));
  assert.ok(
    !run
      .slice(0, row)
      .match(
        /\{(?:going|headed|hasSections|waiting|files\.length > 0) \? \(\s*<PageRow href=\{runDetailsPath/u,
      ),
  );
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

test("an item's tiles: Total, then the flow's verdict words with its tallies; none for a flow that declares no words (item 6)", () => {
  const item = { runCount: 7, positiveCount: 3, negativeCount: 2 };
  assert.deepEqual(itemTiles(item, { positive: "Keep", negative: "Drop" }), [
    { key: "total", label: TOTAL, value: 7 },
    { key: "positive", label: "Keep", value: 3 },
    { key: "negative", label: "Drop", value: 2 },
  ]);
  assert.equal(TOTAL, "Total");
  assert.deepEqual(itemTiles(item, undefined), []);
  // Green and red, on top, then the file's row, before Add and the runs.
  const live = code(
    read("app/account/flows/[subscriptionId]/items/[itemId]/ItemLive.tsx"),
  );
  assert.match(
    live,
    /const tiles = itemTiles\(item, declared\.verdictWords\);/u,
  );
  assert.match(live, /positive: "text-\[var\(--success-text\)\]",/u);
  assert.match(live, /negative: "text-\[var\(--error-text\)\]",/u);
  const tiles = live.indexOf('data-testid="item-tiles"');
  const file = live.indexOf('testId="item-file-row"');
  assert.ok(tiles > 0 && tiles < file, "the tiles, then the file's row");
  assert.ok(file < live.indexOf('aria-labelledby="item-add-title"'));
  assert.ok(file < live.indexOf('data-testid="item-runs"'));
  assert.match(
    live,
    /<PageRow\s+href=\{itemFilePath\(subscriptionId, item\.id\)\}\s+testId="item-file-row"\s*>\s*<span[^>]*>\s*\{declared\.file\.title\}/u,
  );
});

test("a file's page: its paths, its words, shown in place only when a browser draws it (items 4 and 7)", () => {
  assert.equal(viewFileLabel("Entry file"), "View entry file");
  assert.equal(viewFileLabel("NDA"), "View NDA");
  assert.equal(runFilePath("r/1", "f 2"), "/account/runs/r%2F1/files/f%202");
  assert.equal(
    itemFilePath("s 1", "i/2"),
    "/account/flows/s%201/items/i%2F2/file",
  );
  assert.equal(fileViewHref("/account/x"), "/account/x/view");
  for (const type of [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "IMAGE/PNG",
  ])
    assert.equal(shownInPlace(type), true, type);
  for (const type of [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/heic",
    "text/html",
    "",
  ])
    assert.equal(shownInPlace(type), false, type);
  assert.equal(sizeInWords(900), "900 bytes");
  assert.equal(sizeInWords(24 * 1024), "24 KB");
  assert.equal(sizeInWords(1.25 * 1024 * 1024), "1.3 MB");
  assert.equal(
    fileLine({ format: "PDF", pages: 2, sizeBytes: 2048 }),
    "PDF · 2 pages · 2 KB",
  );
  assert.equal(
    fileLine({ format: "PNG", pages: 1, sizeBytes: 10 }),
    "PNG · 1 page · 10 bytes",
  );
  assert.equal(
    fileLine({ format: "DOCX", pages: null, sizeBytes: 10 }),
    "DOCX · 10 bytes",
  );
  assert.equal(RUN_FILE_MAXIMUM_BYTES, 25 * 1024 * 1024);
  assert.equal(FILE_GONE, "This file is no longer kept.");
});

test("a run's files, named as the app's runFileRows: by its flow's file fields in order, files that share a word say which, \"File\" when the flow names none (item 7; the review's finding 3)", () => {
  const photo = { control: "artifact", title: "Photo" };
  const notes = { control: "text", title: "Notes" };
  const entry = { control: "artifact", title: "Entry file" };
  assert.deepEqual(runFileRows([{ id: "f1" }], [notes, entry]), [
    { id: "f1", title: "Entry file", label: "View entry file" },
  ]);
  assert.deepEqual(runFileRows([{ id: "f1" }, { id: "f2" }], [photo]), [
    { id: "f1", title: "Photo", label: "View photo 1 of 2" },
    { id: "f2", title: "Photo", label: "View photo 2 of 2" },
  ]);
  assert.deepEqual(
    runFileRows([{ id: "f1" }, { id: "f2" }], [photo, entry]).map(
      (row) => row.label,
    ),
    ["View photo", "View entry file"],
  );
  assert.deepEqual(runFileRows([{ id: "f1" }], undefined), [
    { id: "f1", title: FILE_WORD, label: "View file" },
  ]);
  assert.deepEqual(runFileRows([{ id: "f1" }], [notes]), [
    { id: "f1", title: "File", label: "View file" },
  ]);
  assert.deepEqual(runFileRows(undefined, [entry]), []);
  assert.equal(FILE_WORD, "File");
});

test("a file is handed on by this site's own route: inline only in a type a browser draws, else an attachment of no type; never cached, nosniff, framed by this site, asked only by its pages (items 4 and 7)", () => {
  const view = code(read("lib/file-view.ts"));
  assert.match(
    view,
    /if \(fetchSite !== "same-origin" && fetchSite !== "none"\)\s*return said\(403/u,
  );
  assert.match(
    view,
    /platformSignedFile\(downloadUrl, RUN_FILE_MAXIMUM_BYTES\)/u,
  );
  assert.match(view, /const inPlace = shownInPlace\(file\.contentType\);/u);
  assert.match(
    view,
    /"content-type": inPlace\s*\? file\.contentType\.toLowerCase\(\)\s*: "application\/octet-stream",/u,
  );
  assert.match(view, /\$\{inPlace \? "inline" : "attachment"\}/u);
  assert.match(view, /"x-content-type-options": "nosniff",/u);
  assert.match(view, /"content-security-policy": "frame-ancestors 'self'",/u);
  assert.match(view, /"cache-control": "private, no-store",/u);
  // Each route reads its own operation; an item of another flow is not found.
  assert.match(
    code(read("app/account/runs/[runId]/files/[fileId]/view/route.ts")),
    /readRunFile\(workspaceId, runId, fileId\)/u,
  );
  const item = code(
    read(
      "app/account/flows/[subscriptionId]/items/[itemId]/file/view/route.ts",
    ),
  );
  assert.match(
    item,
    /if \(item\.subscriptionId !== subscriptionId\)\s*throw new PlatformServerError\("Not Found", 404\);\s*return readItemFile\(workspaceId, itemId\);/u,
  );
  // Download: the platform's link, asked when pressed, followed only when
  // https; Share: the bytes from this site's route, never a hand-written fetch.
  const file = code(read("components/dashboard/FileView.tsx"));
  assert.match(
    file,
    /const link = await platformApiJson<RunFileLink>\(linkPath\);\s*if \(!followSignedLink\(link\.downloadUrl\)\) setError\(DOWNLOAD_FAILED\);/u,
  );
  assert.match(file, /const blob = await siteFileBlob\(viewHref\);/u);
  assert.doesNotMatch(file, /\bfetch\(/u);
  assert.match(file, /\{shownInPlace\(file\.contentType\) \? \(\s*<iframe/u);
  const api = code(read("lib/platform-api.ts"));
  assert.match(
    api,
    /export async function siteFileBlob\(path: string\): Promise<Blob> \{\s*if \(!path\.startsWith\("\/account\/"\)\)/u,
  );
});

test("a run of an item has its file's row first, in the flow's word; the item's file page its sections, all closed (items 4 and 7)", () => {
  const live = code(read(RUN_LIVE));
  assert.match(
    live,
    /const files = run\.itemId\s*\? runFileRows\(detail\.files, flow\?\.fileFields\)\s*: \[\];/u,
  );
  const runPage = live.slice(live.lastIndexOf("<SectionCard"));
  const row = runPage.indexOf("runFilePath(run.id, file.id)");
  assert.ok(row > 0, "the run's page draws the file's row");
  assert.ok(row < runPage.indexOf('data-testid="run-result"'));
  assert.ok(row < runPage.indexOf('testId="run-section"'));
  assert.match(runPage, /\{file\.label\}/u);
  assert.doesNotMatch(live, /View \$\{file\.filename\}/u);
  assert.match(
    code(read("app/account/runs/[runId]/run-page-data.ts")),
    /const fileFields = subscription\?\.runInput\s*\?\.filter\(\(field\) => field\.control === "artifact"\)/u,
  );
  // The file's page is headed by the same word as its row.
  const page = code(read("app/account/runs/[runId]/files/[fileId]/page.tsx"));
  assert.match(
    page,
    /const row = runFileRows\(detail\.files, flow\?\.fileFields\)\.find\(\s*\(candidate\) => candidate\.id === fileId,\s*\);\s*if \(!file \|\| !row\) notFound\(\);/u,
  );
  assert.match(page, /title=\{row\.title\}/u);
  assert.doesNotMatch(page, /file\.filename\}/u);
  const itemFile = code(
    read("app/account/flows/[subscriptionId]/items/[itemId]/file/page.tsx"),
  );
  assert.match(
    itemFile,
    /if \(item\.subscriptionId !== subscriptionId\) notFound\(\);/u,
  );
  assert.match(
    itemFile,
    /<SectionRows sections=\{item\.sections\} testId="item-section" \/>/u,
  );
  assert.doesNotMatch(itemFile, /firstOpen/u);
  assert.match(itemFile, /return FILE_GONE;/u);
});
