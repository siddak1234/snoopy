import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { OUTCOME_WORDS, WORKING, progressRows } from "../lib/run-progress.ts";

/**
 * A run's progress (spec §3.E; backend ADR-0037, BUILD-PLAN 25.4.22): one row
 * per visible group of the flow's steps that has a reported step, in the
 * groups' order — never one per step, never a step's id, never "Not run" (the
 * owner's build-19 feedback #6: "Look at this no one would want to use this at
 * all").
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

// Invoice Processing v2's groups and a few of its steps, as its manifest
// declares them (spec §2.1–§2.2).
const v2 = {
  version: 2,
  groups: [
    {
      id: "received",
      title: "Received",
      description: "You add a PDF or photo.",
    },
    { id: "read", title: "Read", description: "AI reads the details." },
    {
      id: "checked",
      title: "Checked",
      description: "Totals and duplicates are checked.",
    },
    {
      id: "done",
      title: "Done",
      description: "Saved, or recorded in QuickBooks.",
    },
    {
      id: "emailed",
      title: "Emailed",
      description: "A summary goes to Also email.",
    },
  ],
  pipeline: [
    { id: "receive", title: "Document received", group: "received" },
    { id: "read-company", title: "QuickBooks checked", group: "received" },
    { id: "extract", title: "Document read", group: "read" },
    { id: "check-document", title: "Details checked", group: "checked" },
    { id: "verify-read", title: "Read again", group: "read" },
    { id: "find-vendor", title: "Vendor looked up", group: "checked" },
    { id: "decide", title: "Record in QuickBooks?", group: "checked" },
    { id: "save-details", title: "Details saved", group: "done" },
    { id: "notify", title: "Summary emailed", group: "emailed" },
  ],
};

let at = 0;
const step = (stepId, summary, outcome = "ok", extra = {}) => ({
  id: `s-${(at += 1)}`,
  stepId,
  outcome,
  summary,
  occurredAt: `2026-10-14T12:00:0${at % 10}.000Z`,
  ...extra,
});

test("a grouped run shows one row per group that ran, in the groups' order, each titled by its group and lined by its latest step", () => {
  const steps = [
    step("receive", "PDF, 2 pages"),
    step("extract", "Read: Bill from Acme, $120.00"),
    step("check-document", "Totals off"),
    // A group revisited: the second read follows the check.
    step("verify-read", "Second read matches"),
    step("save-details", "Saved: Acme, $120.00"),
  ];
  const rows = progressRows({
    steps,
    manifest: v2,
    runVersion: 2,
    running: false,
  });
  assert.deepEqual(
    rows.map(({ title, sub, outcome }) => [title, sub, outcome]),
    [
      ["Received", "PDF, 2 pages", "ok"],
      ["Read", "Second read matches", "ok"],
      ["Checked", "Totals off", "ok"],
      ["Done", "Saved: Acme, $120.00", "ok"],
    ],
  );
  // No row for a group that did not run (Emailed), and never "Not run".
  assert.ok(!rows.some((row) => row.title === "Emailed"));
  assert.ok(!JSON.stringify(rows).includes("Not run"));
  // Never a step's id.
  for (const row of rows) {
    for (const { id } of v2.pipeline) assert.notEqual(row.title, id);
  }
});

test("a row's icon is its latest step's outcome, a held step keeps its reason, and a run still going ends with Working…", () => {
  const rows = progressRows({
    steps: [
      step("receive", "PDF, 1 page"),
      step(
        "find-vendor",
        "Not recorded in QuickBooks: QuickBooks didn't answer",
        "failed",
      ),
      step("decide", "Waiting for approval", "held", {
        heldReason: "Over the $500 limit, new vendor.",
      }),
    ],
    manifest: v2,
    runVersion: 2,
    running: true,
  });
  assert.deepEqual(
    rows.map(({ title, outcome, heldReason }) => [title, outcome, heldReason]),
    [
      ["Received", "ok", undefined],
      ["Checked", "held", "Over the $500 limit, new vendor."],
      [WORKING, "working", undefined],
    ],
  );
  assert.equal(WORKING, "Working…");
  assert.equal(rows.at(-1).sub, undefined);
});

test("groups are the run's own version's only; a step is still titled from the catalog's pipeline, and one it does not title is its own line — never its id", () => {
  const rows = progressRows({
    steps: [
      step("receive", "PDF, 1 page"),
      step("find-payer", "Paid by the company"),
    ],
    // The catalog lists v2; this run ran v1.
    manifest: v2,
    runVersion: 1,
    running: false,
  });
  assert.deepEqual(
    rows.map(({ title, sub }) => [title, sub]),
    [
      ["Document received", "PDF, 1 page"],
      ["Paid by the company", undefined],
    ],
  );
  // No catalog entry at all: each step its own line.
  assert.deepEqual(
    progressRows({
      steps: [step("validate-input", "Input validated.")],
      manifest: undefined,
      runVersion: 1,
      running: false,
    }).map(({ title }) => title),
    ["Input validated."],
  );
});

test("the run page draws Progress from these rows and Details from the run's own lines — never a step id, never a kicker, never Not run", () => {
  const page = read("app/account/runs/[runId]/page.tsx");
  assert.match(page, /const rows = progressRows\(\{/u);
  assert.match(
    page,
    /running: run\.status === "pending" \|\| run\.status === "running",/u,
  );
  assert.match(page, />\s*Progress\s*</u);
  assert.match(page, />\s*Details\s*</u);
  assert.match(page, /\{details && details\.length > 0 \? \(/u);
  assert.match(page, />\s*Waiting for approval\.\s*</u);
  assert.doesNotMatch(page, /step\.stepId|<Kicker|Not run|>\s*Steps\s*</u);
  // The flow by its name, never its template id and version.
  assert.match(page, /subheader=\{entry\?\.name\}/u);
  assert.doesNotMatch(page, /run\.templateId\} · v/u);
  // Icons 24 (spec §3.0 rule 2).
  assert.match(
    page,
    /const common = \{ size: 24, "aria-hidden": true \} as const;/u,
  );
});

test("a finished row says its outcome in words to a screen reader — its icon is hidden from one — and the working row says Working… alone", () => {
  assert.deepEqual(OUTCOME_WORDS, {
    ok: "Succeeded",
    held: "Held",
    failed: "Failed",
  });
  const page = read("app/account/runs/[runId]/page.tsx");
  assert.match(
    page,
    /\{row\.outcome === "working" \? null : \(\s*<span className="sr-only">\{OUTCOME_WORDS\[row\.outcome\]\}<\/span>\s*\)\}/u,
  );
});
