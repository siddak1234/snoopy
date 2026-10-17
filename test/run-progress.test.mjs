import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY,
  groupState,
  heldDecision,
  runDuration,
  runLabel,
  runResultLine,
  stepStates,
  stepsDone,
  timeOfDay,
  trackerRows,
} from "../lib/run-progress.ts";

/**
 * A run's STEPS (Build 21, spec A7; the session's S14; the owner's build 20
 * item 10: "It shoukd show all the steps and a live tracker of which ones are
 * done … We have pre determined steps and it should ahow where we are"): every
 * declared row from the start, each with where the run is — never a step's own
 * summary, never a step id (B6). The same tables as the app's
 * (snoopy-mobile `__tests__/build21-views.test.ts`), from the same shared
 * fixtures: run 793eef82 as it ran, a v3 run of three receipts, a held run, a
 * continuation, a failed run.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

// Invoice Processing v3 as its manifest declares it (snoopy-automations
// manifests/invoice-processing.v3.json): four groups, 22 steps.
const step = (id, group, title) => ({ id, group, title });
const V3 = {
  version: 3,
  groups: [
    { id: "received", title: "Received" },
    { id: "read", title: "Read" },
    { id: "checked", title: "Checked" },
    { id: "done", title: "Done" },
  ],
  pipeline: [
    step("receive", "received", "Document received"),
    step("extract", "read", "Documents read"),
    step("check-documents", "read", "Documents checked"),
    step("verify-read", "read", "Read again"),
    step("read-company", "checked", "QuickBooks checked"),
    step("read-preferences", "checked", "QuickBooks settings read"),
    step("find-accounts", "checked", "Accounts read"),
    step("find-vendors", "checked", "Vendors looked up"),
    step("find-names", "checked", "Names checked"),
    step("find-duplicates", "checked", "Duplicates checked"),
    step("find-related", "checked", "Related records looked up"),
    step("decide", "checked", "Ready to record?"),
    step("create-vendors", "done", "Vendors added"),
    step("create-records", "done", "Recorded in QuickBooks"),
    step("save-documents", "done", "Details saved"),
    step("ask-approval", "done", "Needs your approval"),
    step("confirm-company", "done", "Company checked again"),
    step("confirm-vendors", "done", "Vendors checked again"),
    step("create-approved-vendors", "done", "Approved vendors added"),
    step("confirm-no-duplicates", "done", "Duplicates checked again"),
    step("create-approved-records", "done", "Approved documents recorded"),
    step("save-approved", "done", "Approved details saved"),
  ],
};

const at = (minute) => new Date(Date.UTC(2026, 9, 15, 1, minute)).toISOString();
const steps = (...reported) =>
  reported.map(([stepId, outcome, minute], n) => ({
    stepId,
    outcome,
    summary: `${stepId} said this`,
    occurredAt: at(minute ?? n),
  }));
const clock = (iso) => iso.slice(11, 16);
const titles = ["1 · Received", "2 · Read", "3 · Checked", "4 · Done"];

for (const [name, run, reported, states] of [
  [
    "nothing reported, pending",
    { status: "pending" },
    [],
    ["working", "waiting", "waiting", "waiting"],
  ],
  [
    "running, received done",
    { status: "running" },
    steps(["receive", "ok"]),
    ["done", "working", "waiting", "waiting"],
  ],
  // A three-receipt run with None: QuickBooks' lookups never ran — skipped, not waiting.
  [
    "succeeded on None: lookups skipped",
    { status: "succeeded" },
    steps(
      ["receive", "ok"],
      ["extract", "ok"],
      ["check-documents", "ok"],
      ["decide", "ok"],
      ["save-documents", "ok"],
    ),
    ["done", "done", "done", "done"],
  ],
  [
    "held at ask-approval",
    { status: "held" },
    steps(
      ["receive", "ok"],
      ["extract", "ok"],
      ["check-documents", "ok"],
      ["decide", "ok"],
      ["ask-approval", "held"],
    ),
    ["done", "done", "done", "held"],
  ],
  [
    "failed while reading",
    {
      status: "failed",
      failureReason: "The document can't be read. Try a clearer photo.",
    },
    steps(["receive", "ok"], ["extract", "failed"]),
    ["done", "failed", "stopped", "stopped"],
  ],
  [
    "cancelled before it read",
    { status: "cancelled" },
    steps(["receive", "ok"]),
    ["done", "stopped", "stopped", "stopped"],
  ],
  [
    "a continuation: the groups before its first step done",
    { status: "succeeded", origin: "approval-continuation" },
    steps(["confirm-company", "ok"], ["create-approved-records", "ok"]),
    ["done", "done", "done", "done"],
  ],
]) {
  test(`the tracker, every group from the start: ${name}`, () => {
    const rows = trackerRows(reported, V3.pipeline, V3.groups, run, clock);
    assert.deepEqual(
      rows.map((row) => row.state),
      states,
    );
    assert.deepEqual(
      rows.map((row) => row.title),
      titles,
    );
  });
}

test("each state in words — never a step's own summary, never a step id", () => {
  const rows = trackerRows(
    [
      ...steps(["receive", "ok", 32], ["extract", "ok", 33]),
      {
        stepId: "ask-approval",
        outcome: "held",
        summary: "held said",
        occurredAt: at(34),
        heldReason: "Document 2: the total can't be read.",
      },
    ],
    V3.pipeline,
    V3.groups,
    { status: "held" },
    clock,
  );
  assert.deepEqual(
    rows.map((row) => [row.title, row.state, row.sub]),
    [
      ["1 · Received", "done", "Done · 01:32"],
      ["2 · Read", "done", "Done · 01:33"],
      ["3 · Checked", "skipped", "Skipped"],
      [
        "4 · Done",
        "held",
        "Waiting for approval: Document 2: the total can't be read.",
      ],
    ],
  );
  for (const row of rows)
    assert.doesNotMatch(row.sub, /said|receive|extract|ask-approval/u);
});

test("run 793eef82 as it ran (v2): never '34 accounts read', the failure on its step, the rest stopped", () => {
  const v2 = (id, group) => ({ id, group, title: id });
  const pipeline = [
    v2("receive", "received"),
    v2("read-company", "received"),
    v2("read-preferences", "received"),
    v2("find-accounts", "received"),
    v2("extract", "read"),
    v2("check-document", "checked"),
    v2("save-details", "done"),
    v2("notify", "emailed"),
  ];
  const groups = [
    { id: "received", title: "Received" },
    { id: "read", title: "Read" },
    { id: "checked", title: "Checked" },
    { id: "done", title: "Done" },
    { id: "emailed", title: "Emailed" },
  ];
  const reported = steps(
    ["receive", "ok"],
    ["read-company", "ok"],
    ["read-preferences", "ok"],
    ["find-accounts", "ok"],
    ["extract", "ok"],
    ["check-document", "failed"],
  );
  reported[3].summary = "34 accounts read";
  const rows = trackerRows(
    reported,
    pipeline,
    groups,
    { status: "failed", failureReason: "Add one document per file." },
    clock,
  );
  assert.deepEqual(
    rows.map((row) => [row.state, row.sub]),
    [
      ["done", "Done · 01:03"],
      ["done", "Done · 01:04"],
      ["failed", "Add one document per file."],
      ["stopped", "Stopped"],
      ["stopped", "Stopped"],
    ],
  );
  assert.equal(
    rows.some((row) => row.sub.includes("34 accounts read")),
    false,
  );
});

test('Steps done counts the groups done or skipped over every group — at the start 0 of them, never "1 / 1" while running', () => {
  const start = trackerRows([], V3.pipeline, V3.groups, { status: "pending" });
  assert.equal(stepsDone(start), "0 / 4");
  const running = trackerRows(
    steps(["receive", "ok"]),
    V3.pipeline,
    V3.groups,
    {
      status: "running",
    },
  );
  assert.equal(stepsDone(running), "1 / 4");
  const done = trackerRows(
    steps(["receive", "ok"], ["save-documents", "ok"]),
    V3.pipeline,
    V3.groups,
    { status: "succeeded" },
  );
  assert.equal(stepsDone(done), "4 / 4");
  assert.equal(stepsDone([]), EMPTY);
});

test("each step on its own: one the run passed over is Skipped — never Waiting — and after a hold the rest wait", () => {
  const byId = (states) =>
    Object.fromEntries(
      V3.pipeline.map((declared, index) => [declared.id, states[index].state]),
    );
  const none = byId(
    stepStates(
      V3.pipeline,
      steps(
        ["receive", "ok"],
        ["extract", "ok"],
        ["check-documents", "ok"],
        ["decide", "ok"],
        ["save-documents", "ok"],
      ),
      { status: "succeeded" },
    ),
  );
  for (const [id, state] of Object.entries({
    receive: "done",
    "verify-read": "skipped",
    "read-company": "skipped",
    "find-accounts": "skipped",
    "find-related": "skipped",
    decide: "done",
    "create-records": "skipped",
    "save-documents": "done",
    "ask-approval": "skipped",
    "save-approved": "skipped",
  }))
    assert.equal(none[id], state, id);
  const held = byId(
    stepStates(
      V3.pipeline,
      steps(["receive", "ok"], ["decide", "ok"], ["ask-approval", "held"]),
      { status: "held" },
    ),
  );
  for (const [id, state] of Object.entries({
    extract: "skipped",
    "ask-approval": "held",
    "confirm-company": "waiting",
    "save-approved": "waiting",
  }))
    assert.equal(held[id], state, id);
});

test("a group is working over held over failed over all-waiting over any-done", () => {
  assert.equal(groupState(["held", "failed"]), "held");
  assert.equal(groupState(["failed", "working"]), "working");
  assert.equal(groupState(["done", "working", "waiting"]), "working");
  assert.equal(groupState(["done", "held"]), "held");
  assert.equal(groupState(["done", "failed", "stopped"]), "failed");
  assert.equal(groupState(["waiting", "waiting"]), "waiting");
  assert.equal(groupState(["skipped", "done", "skipped"]), "done");
  assert.equal(groupState(["skipped", "skipped"]), "skipped");
  assert.equal(groupState(["stopped", "skipped"]), "stopped");
});

test('a run of another version is drawn by what it reported, titled from the catalog where it names the step, else "Step n"', () => {
  const rows = trackerRows(
    steps(["receive", "ok"], ["find-payer", "ok"]),
    undefined,
    undefined,
    { status: "running" },
    clock,
    V3.pipeline,
  );
  assert.deepEqual(
    rows.map((row) => [row.title, row.sub]),
    [
      ["1 · Document received", "Done · 01:00"],
      ["2 · Step 2", "Done · 01:01"],
      ["3 · Step 3", "Working…"],
    ],
  );
});

test("a version without groups is one row per declared step, numbered", () => {
  const rows = trackerRows(
    steps(["trigger", "ok"]),
    [{ id: "trigger", title: "Fixture trigger" }],
    undefined,
    { status: "succeeded" },
    clock,
  );
  assert.deepEqual(
    rows.map((row) => [row.title, row.state, row.sub]),
    [["1 · Fixture trigger", "done", "Done · 01:00"]],
  );
});

test("a run is named by its FULL id — never the request id, never the first eight (spec A8; the owner's D4 and AM2)", () => {
  const id = "793eef82-102d-81be-a2d3-9e8d4e2b2c36";
  assert.equal(runLabel(id), `Run ${id}`);
  // Every page that names a run names it so, and none shows the request id.
  for (const path of [
    "app/account/runs/[runId]/RunLive.tsx",
    "app/account/runs/page.tsx",
    "app/account/page.tsx",
    "app/account/approvals/page.tsx",
  ]) {
    assert.match(read(path), /runLabel\(/u, path);
  }
  for (const path of [
    "app/account/runs/[runId]/RunLive.tsx",
    "app/account/runs/[runId]/page.tsx",
    "app/account/runs/page.tsx",
    "app/account/page.tsx",
    "app/account/approvals/page.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /\.requestId|slice\(0, 8\)/u, path);
    assert.doesNotMatch(source, /· v\{run\.templateVersion\}/u, path);
  }
});

test("the time a step was done, its duration and its result line, in the app's words", () => {
  assert.equal(timeOfDay("2026-10-15T14:32:09.000Z"), "2:32 PM");
  assert.equal(timeOfDay("2026-10-15T00:05:00.000Z"), "12:05 AM");
  assert.equal(timeOfDay("not a time"), "");
  assert.equal(runDuration(at(0), null), EMPTY);
  assert.equal(
    runDuration("2026-10-15T01:00:00.000Z", "2026-10-15T01:00:19.000Z"),
    "19s",
  );
  assert.equal(
    runDuration("2026-10-15T01:00:00.000Z", "2026-10-15T01:04:00.000Z"),
    "4m",
  );
  assert.equal(
    runDuration("2026-10-15T01:00:00.000Z", "2026-10-15T03:00:00.000Z"),
    "2h",
  );
  const held = { id: "r1", status: "held" };
  const approval = (status) => [{ runId: "r1", status }];
  assert.equal(runResultLine(held, []), "Waiting for approval.");
  assert.equal(
    runResultLine(held, approval("pending")),
    "Waiting for approval.",
  );
  assert.equal(
    runResultLine(held, approval("approved")),
    "Approved — continued in a new run",
  );
  assert.equal(runResultLine(held, approval("rejected")), "Rejected");
  assert.equal(
    runResultLine(held, approval("expired")),
    "No longer awaiting approval",
  );
  assert.equal(heldDecision(held, approval("expired")), "closed");
  assert.equal(
    runResultLine({ id: "r", status: "succeeded", resultSummary: "Done." }, []),
    "Done.",
  );
  assert.equal(
    runResultLine({ id: "r", status: "failed", failureReason: "Nope." }, []),
    "Nope.",
  );
  assert.equal(runResultLine({ id: "r", status: "running" }, []), null);
});

test("the run page draws the tracker's rows and words alone — never a step's summary, never its id — and reads the run again while it goes on", () => {
  const live = read("app/account/runs/[runId]/RunLive.tsx");
  assert.match(live, /const tracker = trackerRows\(/u);
  assert.match(live, /\{row\.title\}/u);
  assert.match(live, /\{row\.sub\}/u);
  assert.doesNotMatch(live, /\.summary\b|\.stepId\b|heldReason/u);
  // Live: every 2 s while pending or running, one read at a time.
  assert.match(
    live,
    /if \(!going\) return;[\s\S]*?setTimeout\([\s\S]*?RUN_REREAD_MS\)/u,
  );
  assert.match(live, /\[going, reads, workspaceId, run\.id\]/u);
  // The sections in the spec's order: Steps, Documents (or Details), the facts.
  const order = ["Steps", "Documents", "Details"].map((name) =>
    live.search(new RegExp(`>\\s*${name}\\s*</h2>`, "u")),
  );
  assert.ok(
    order.every((index) => index > 0),
    String(order),
  );
  assert.ok(order[0] < order[1] && order[1] < order[2], String(order));
  assert.ok(
    live.indexOf('label: "Run ID", value: run.id') > 0,
    "the facts end with the full Run ID",
  );
});
