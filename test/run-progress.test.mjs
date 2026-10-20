import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMPTY,
  groupState,
  heldDecision,
  newestApproval,
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
 * (`snoopy-mobile/__tests__/build21-views.test.ts`), from the same shared
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
  // A job is its first run (Build 24, P9; backend ADR-0044): held, approved
  // and done, its whole timeline in one list — the held step done once it
  // went on. ~~A continuation's groups before its first step done~~.
  [
    "a job approved and done: its whole timeline, one list",
    { status: "succeeded" },
    steps(
      ["receive", "ok"],
      ["extract", "ok"],
      ["check-documents", "ok"],
      ["decide", "ok"],
      ["ask-approval", "held"],
      ["confirm-company", "ok"],
      ["create-approved-records", "ok"],
    ),
    ["done", "done", "done", "done"],
  ],
  // Its continuation's steps alone are no longer a job's whole story.
  [
    "only a continuation's steps: what they say, and no more",
    { status: "succeeded", origin: "approval-continuation" },
    steps(["confirm-company", "ok"], ["create-approved-records", "ok"]),
    ["skipped", "skipped", "skipped", "done"],
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
    // Approvals' rows (Build 24, P7: they leave as they are decided).
    "app/account/approvals/ApprovalDecision.tsx",
  ]) {
    assert.match(read(path), /runLabel\(/u, path);
  }
  for (const path of [
    "app/account/runs/[runId]/RunLive.tsx",
    "app/account/runs/[runId]/page.tsx",
    "app/account/runs/page.tsx",
    "app/account/page.tsx",
    "app/account/approvals/page.tsx",
    "app/account/approvals/ApprovalDecision.tsx",
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
  // The job goes on under its own id (ADR-0044): ~~"Approved — continued in
  // a new run"~~ until Build 24.
  assert.equal(runResultLine(held, approval("approved")), "Approved");
  assert.doesNotMatch(
    read("lib/run-progress.ts").replace(/~~[\s\S]*?~~/gu, ""),
    /continued in a new run/u,
  );
  // Denied (Build 24, P6; the session's S6: the owner's word), ~~Rejected~~.
  assert.equal(runResultLine(held, approval("rejected")), "Denied");
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

// Invoice Processing v4 (snoopy-automations manifests/invoice-processing.v4.json;
// spec §3): v3's 22 steps in five groups — receive in Upload invoice; extract,
// check-documents and verify-read in AI processing; the other 18 in step 4 —
// the connect group a setting step, the email group the platform's.
const V4_GROUP = (id) =>
  id === "receive"
    ? "upload"
    : ["extract", "check-documents", "verify-read"].includes(id)
      ? "process"
      : "record";
const V4 = {
  groups: [
    { id: "upload", title: "Upload invoice" },
    { id: "connect", title: "Connect integration" },
    { id: "process", title: "AI processing" },
    { id: "record", title: "Details saved" },
    { id: "email", title: "Email sent", platform: "email" },
  ],
  pipeline: V3.pipeline.map((declared) => ({
    ...declared,
    group: V4_GROUP(declared.id),
  })),
};
// The flow as its run's page read it: QuickBooks chosen (spec §4's fixtures).
const quickbooksFlow = {
  titles: { record: "QuickBooks updated" },
  settings: { connect: "QuickBooks Online" },
};
const v4Rows = (reported, run, email, flow = quickbooksFlow) =>
  trackerRows(reported, V4.pipeline, V4.groups, run, timeOfDay, V4.pipeline, {
    flow,
    email,
  });
const words = (rows) => rows.map((row) => `${row.title}  ${row.sub}`);
const ran = (...ids) =>
  ids.map((stepId, n) => ({
    stepId,
    outcome: "ok",
    summary: `${stepId} said this`,
    occurredAt: `2026-10-17T14:3${n}:00.000Z`,
  }));

test("a v4 run running: 1 Done · its time, 2 the integration chosen, 3 Working…, 4 and 5 Waiting — step 4 titled by the flow's choice (spec §4; S23, S24)", () => {
  const rows = v4Rows(ran("receive"), { status: "running" });
  assert.deepEqual(words(rows), [
    "1 · Upload invoice  Done · 2:30 PM",
    "2 · Connect integration  QuickBooks Online",
    "3 · AI processing  Working…",
    "4 · QuickBooks updated  Waiting",
    "5 · Email sent  Waiting",
  ]);
  assert.deepEqual(
    rows.map((row) => row.state),
    ["done", "done", "working", "waiting", "waiting"],
  );
  assert.equal(stepsDone(rows), "2 / 5");
  // A setting step is done from the start: before anything is reported too.
  const pending = v4Rows([], { status: "pending" });
  assert.equal(pending[1].state, "done");
  assert.equal(stepsDone(pending), "1 / 5");
});

test("a v4 run's step 5 (Build 23's A7): Waiting while it goes on or is held, Failed, Stopped; once it succeeded done — Email sent · its time, Sending email… while owed, Done when not sent — and Steps done counts it only on success", () => {
  const succeeded = ran(
    "receive",
    "extract",
    "check-documents",
    "decide",
    "save-documents",
  );
  const sent = v4Rows(
    succeeded,
    { status: "succeeded" },
    { status: "sent", sentAt: "2026-10-17T15:22:09.000Z" },
  );
  assert.deepEqual(
    [sent[4].sub, sent[4].state],
    ["Email sent · 3:22 PM", "done"],
  );
  assert.equal(stepsDone(sent), "5 / 5");
  const owed = v4Rows(
    succeeded,
    { status: "succeeded" },
    { status: "waiting", sentAt: null },
  );
  assert.deepEqual([owed[4].sub, owed[4].state], ["Sending email…", "done"]);
  assert.equal(stepsDone(owed), "5 / 5");
  // No email from the platform reads as owed.
  assert.equal(
    v4Rows(succeeded, { status: "succeeded" }, undefined)[4].sub,
    "Sending email…",
  );
  const notSent = v4Rows(
    succeeded,
    { status: "succeeded" },
    { status: "not_sent", sentAt: null },
  );
  assert.deepEqual([notSent[4].sub, notSent[4].state], ["Done", "done"]);
  // Failed: Failed, whatever the email says, and not counted.
  const failed = v4Rows(
    succeeded,
    { status: "failed", failureReason: "The vendor refused it." },
    { status: "not_sent", sentAt: null },
  );
  assert.deepEqual([failed[4].sub, failed[4].state], ["Failed", "failed"]);
  assert.notEqual(stepsDone(failed).split(" / ")[0], "5");
  // Cancelled: Stopped, whatever the email says; running: Waiting.
  const cancelled = v4Rows(
    ran("receive"),
    { status: "cancelled" },
    { status: "not_sent", sentAt: null },
  );
  assert.deepEqual(
    [cancelled[4].sub, cancelled[4].state],
    ["Stopped", "stopped"],
  );
  assert.equal(
    v4Rows(
      ran("receive"),
      { status: "running" },
      {
        status: "sent",
        sentAt: "2026-10-17T14:34:09.000Z",
      },
    )[4].sub,
    "Waiting",
  );
  // A v5 flow's step 5 is titled "Run completed": the same rules.
  const v5 = trackerRows(
    succeeded,
    V4.pipeline,
    V4.groups.map((group) =>
      group.platform === "email" ? { ...group, title: "Run completed" } : group,
    ),
    { status: "succeeded" },
    timeOfDay,
    V4.pipeline,
    {
      flow: quickbooksFlow,
      email: { status: "sent", sentAt: "2026-10-17T15:22:09.000Z" },
    },
  );
  assert.equal(words(v5)[4], "5 · Run completed  Email sent · 3:22 PM");
});

test("a held v4 run: step 4 waits for approval and says why, step 5 Waiting — an approval email never checks it (Build 23's A7)", () => {
  const rows = v4Rows(
    [
      ...ran("receive", "extract", "decide"),
      {
        stepId: "ask-approval",
        outcome: "held",
        summary: "held said",
        heldReason: "Document 2: the total can't be read.",
        occurredAt: "2026-10-17T14:35:00.000Z",
      },
    ],
    { status: "held" },
    { status: "sent", sentAt: "2026-10-17T14:35:30.000Z" },
  );
  assert.deepEqual(words(rows).slice(3), [
    "4 · QuickBooks updated  Waiting for approval: Document 2: the total can't be read.",
    "5 · Email sent  Waiting",
  ]);
  assert.equal(rows[4].state, "waiting");
  assert.equal(
    v4Rows(ran("receive", "decide"), { status: "held" }, undefined)[4].sub,
    "Waiting",
  );
});

test("a held job's step 4 says why it waits until its approval is denied, then Denied — the run as reported, and drawn by what it reported too (Build 24, P6; S6)", () => {
  const reported = [
    ...ran("receive", "extract", "decide"),
    {
      stepId: "ask-approval",
      outcome: "held",
      summary: "held said",
      heldReason: "Document 2: the total can't be read.",
      occurredAt: "2026-10-17T14:35:00.000Z",
    },
  ];
  const rows = (decision) =>
    trackerRows(
      reported,
      V4.pipeline,
      V4.groups,
      { status: "held" },
      timeOfDay,
      V4.pipeline,
      { flow: quickbooksFlow, decision },
    );
  assert.equal(
    rows("pending")[3].sub,
    "Waiting for approval: Document 2: the total can't be read.",
  );
  assert.deepEqual(
    [rows("rejected")[3].state, rows("rejected")[3].sub],
    ["held", "Denied"],
  );
  assert.equal(
    rows(null)[3].sub,
    "Waiting for approval: Document 2: the total can't be read.",
  );
  // A run of another version, drawn by what it reported, says it too.
  const older = trackerRows(
    [
      ...ran("receive", "check-document"),
      { ...reported[3], stepId: "ask-approval" },
    ],
    V4.pipeline,
    V4.groups,
    { status: "held" },
    timeOfDay,
    V4.pipeline,
    { decision: "rejected" },
  );
  assert.equal(older.at(-1).sub, "Denied");
});

test("a job's newest approval decides — by when it was asked, whatever the list's order; the job is its first run, so every approval names its id (Build 24, P9; backend ADR-0044)", () => {
  const job = { id: "job-1", status: "held" };
  const asked = (status, minute, runId = "job-1") => ({
    runId,
    status,
    createdAt: `2026-10-17T14:${String(minute).padStart(2, "0")}:00.000Z`,
  });
  // Approved once, held again later: the second approval is the one waiting.
  const approvals = [asked("approved", 10), asked("pending", 40)];
  assert.equal(heldDecision(job, approvals), "pending");
  assert.equal(heldDecision(job, [...approvals].reverse()), "pending");
  assert.equal(
    runResultLine(job, [asked("pending", 5), asked("rejected", 50)]),
    "Denied",
  );
  // Another job's approval is never this one's.
  assert.equal(
    heldDecision(job, [asked("rejected", 59, "job-2"), asked("pending", 1)]),
    "pending",
  );
  assert.equal(
    newestApproval("job-1", [asked("pending", 1, "job-2")]),
    undefined,
  );
  assert.equal(heldDecision(job, []), "unknown");
  // Two asked at the same moment: the one listed first — the platform lists
  // newest first, and the app's jobApproval picks it too.
  assert.equal(
    heldDecision(job, [asked("approved", 30), asked("pending", 30)]),
    "approved",
  );
});

test("a job whose steps 1–5 come in one list draws 5 done — the held step among them, done once the job went on; while it goes on after its approval, step 4 is working (Build 24, P9; ADR-0044)", () => {
  const timeline = [
    ...ran("receive", "extract", "decide"),
    {
      stepId: "ask-approval",
      outcome: "held",
      summary: "held said",
      heldReason: "Document 2: the total can't be read.",
      occurredAt: "2026-10-17T14:35:00.000Z",
    },
    {
      stepId: "confirm-company",
      outcome: "ok",
      summary: "said",
      occurredAt: "2026-10-17T14:50:00.000Z",
    },
  ];
  const done = v4Rows(
    [
      ...timeline,
      {
        stepId: "save-approved",
        outcome: "ok",
        summary: "said",
        occurredAt: "2026-10-17T14:51:00.000Z",
      },
    ],
    { status: "succeeded", origin: "manual" },
    { status: "sent", sentAt: "2026-10-17T14:52:00.000Z" },
  );
  assert.deepEqual(
    done.map((row) => row.state),
    ["done", "done", "done", "done", "done"],
  );
  assert.equal(stepsDone(done), "5 / 5");
  assert.equal(done[3].sub, "Done · 2:51 PM");
  const going = v4Rows(timeline, { status: "running" });
  assert.equal(going[3].state, "working");
  // Still held: held, and why.
  const held = v4Rows(timeline.slice(0, 4), { status: "held" });
  assert.equal(held[3].state, "held");
});

test("None: step 2 says None, step 4 Details saved; a flow that could not be read — step 2 Done, step 4 its own title (S23; the app's M6)", () => {
  const none = v4Rows(ran("receive"), { status: "running" }, undefined, {
    titles: { record: "Details saved" },
    settings: { connect: "None" },
  });
  assert.equal(none[1].sub, "None");
  assert.equal(none[3].title, "4 · Details saved");
  // The default flow is QuickBooks', so an unread one is passed as none at all.
  const unread = trackerRows(
    ran("receive"),
    V4.pipeline,
    V4.groups,
    { status: "running" },
    timeOfDay,
    V4.pipeline,
    {},
  );
  assert.deepEqual(
    [unread[1].sub, unread[1].state, unread[3].title],
    ["Done", "done", "4 · Details saved"],
  );
});

test("a v3 run — v3's step ids, every one still declared — is drawn by v4's five steps; a run that reported a step v4 does not declare by what it reported (S25)", () => {
  const v3Run = v4Rows(
    ran(
      "receive",
      "extract",
      "check-documents",
      "verify-read",
      "decide",
      "save-documents",
    ),
    { status: "succeeded" },
    { status: "sent", sentAt: "2026-10-17T14:40:00.000Z" },
  );
  assert.deepEqual(
    v3Run.map((row) => row.title),
    [
      "1 · Upload invoice",
      "2 · Connect integration",
      "3 · AI processing",
      "4 · QuickBooks updated",
      "5 · Email sent",
    ],
  );
  const older = v4Rows(ran("receive", "check-document"), { status: "failed" });
  assert.deepEqual(
    older.map((row) => row.title),
    ["1 · Document received", "2 · Step 2"],
  );
});

test("a platform step this build does not know: its title, no line, no state — and not counted in Steps done (the app's M7)", () => {
  const rows = trackerRows(
    ran("receive"),
    V4.pipeline,
    [
      ...V4.groups.slice(0, 4),
      { id: "sms", title: "Text sent", platform: "sms" },
    ],
    { status: "succeeded" },
    timeOfDay,
    V4.pipeline,
    { flow: quickbooksFlow },
  );
  assert.deepEqual(
    [rows[4].title, rows[4].state, rows[4].sub],
    ["5 · Text sent", "unknown", ""],
  );
  assert.equal(stepsDone(rows), "4 / 4");
});

test("the run page draws the tracker's rows and words alone — never a step's summary, never its id — and reads the run again while it goes on", () => {
  const live = read("app/account/runs/[runId]/RunLive.tsx");
  assert.match(live, /const tracker = trackerRows\(/u);
  // The catalog's steps for any run — no version gate (S25) — with the flow
  // as read now and the run's email (S23, S24).
  assert.doesNotMatch(live, /templateVersion|declaredFor/u);
  assert.match(
    live,
    /trackerRows\(\s*steps,\s*flow\?\.pipeline,\s*flow\?\.groups,\s*run,\s*undefined,\s*flow\?\.pipeline,\s*\{ flow: flow\?\.tracker, email: detail\.email, decision: decided \},\s*\);/u,
  );
  const page = read("app/account/runs/[runId]/page.tsx");
  assert.match(page, /stepTitle\(group, setup, subscription\.config\)/u);
  assert.match(page, /const line = settingLine\(/u);
  assert.match(
    page,
    /return live \?\? own\(await listArchivedSubscriptions\(workspaceId\)\);/u,
  );
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

test("the running step's icon spins, still under reduced motion, and no other state's does (Build 23's A4)", () => {
  const live = read("app/account/runs/[runId]/RunLive.tsx");
  const look = live.slice(
    live.indexOf("const STATE_LOOK"),
    live.indexOf("function TrackerItem"),
  );
  const entries = look.split(/\n {2}(?=[a-z]+: \{)/u).slice(1);
  const spinning = entries
    .filter((entry) => entry.includes("animate-spin"))
    .map((entry) => entry.split(":")[0]);
  assert.deepEqual(spinning, ["working"]);
  assert.match(look, /motion: "motion-safe:animate-spin"/u);
  assert.match(
    live,
    /const \{ Icon, tone, motion \} = STATE_LOOK\[row\.state\]/u,
  );
  assert.match(
    live,
    /className=\{`mt-0\.5 shrink-0 \$\{tone\}\$\{motion \? ` \$\{motion\}` : ""\}`\}/u,
  );
});
