import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  NONE,
  chosenVendor,
  connectionFields,
  fieldProviders,
  flowPath,
  flowStepPlan,
  quickRunRows,
  rowFields,
  setupPath,
} from "../lib/flow-steps.ts";

/**
 * A flow's page (Build 21, spec A6 — the TEST VERSION of the owner's order,
 * D3; AM4: "the flow page is the run page") and Home's Run a flow (A9): the
 * steps numbered, Step 1 holding the document and Start run, each step's
 * vendor in the step that writes to it; then Connections; Edit setup at the
 * bottom. The app's rules (snoopy-mobile `lib/view/pipeline.ts`,
 * `lib/view/home.ts`).
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const groups = [
  { id: "received", title: "Received", description: "Add a PDF or photo." },
  { id: "read", title: "Read", description: "AI reads each bill or receipt." },
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
];
const pipeline = [
  {
    id: "receive",
    kicker: "TRIGGER",
    group: "received",
    title: "Document received",
    description: "A PDF or photo arrives.",
  },
  {
    id: "extract",
    kicker: "AI STEP",
    group: "read",
    title: "Documents read",
    description: "AI reads each document.",
  },
  {
    id: "decide",
    kicker: "ACTION",
    group: "checked",
    title: "Ready to record?",
    description: "Records each one, or waits for approval.",
  },
  {
    id: "create-records",
    kicker: "ACTION",
    group: "done",
    title: "Recorded in QuickBooks",
    description: "Creates bills and expenses.",
  },
];
// v3's two settings (spec §3.1, AM3: no "Send results to").
const v3Setup = [
  {
    key: "vendor",
    control: "connection",
    defaultValue: "none",
    providers: ["quickbooks"],
    group: "done",
  },
  {
    key: "holdAboveAmount",
    control: "money",
    defaultValue: 500,
    group: "checked",
  },
];

test("Steps: one numbered row per group — Step 1 the trigger's, holding the run — and the vendor in the step its field names", () => {
  const plan = flowStepPlan(pipeline, groups, connectionFields(v3Setup));
  assert.deepEqual(
    plan.rows.map((row) => [row.label, row.sub, row.input, row.vendorFields]),
    [
      ["1 · Received", "Add a PDF or photo.", true, []],
      ["2 · Read", "AI reads each bill or receipt.", false, []],
      ["3 · Checked", "Totals and duplicates are checked.", false, []],
      ["4 · Done", "Saved, or recorded in QuickBooks.", false, ["vendor"]],
    ],
  );
  assert.deepEqual(plan.unplaced, []);
});

test("a vendor choice from before `group` (v2) is drawn under the steps; a version without groups is one row per step, Step 1 the first", () => {
  const v2 = flowStepPlan(pipeline, groups, [{ key: "vendor" }]);
  assert.deepEqual(v2.unplaced, ["vendor"]);
  const ungrouped = flowStepPlan(pipeline, undefined, [
    { key: "vendor", group: "done" },
  ]);
  assert.deepEqual(
    ungrouped.rows.map((row) => [row.label, row.input]),
    [
      ["1 · Document received", true],
      ["2 · Documents read", false],
      ["3 · Ready to record?", false],
      ["4 · Recorded in QuickBooks", false],
    ],
  );
  assert.deepEqual(ungrouped.unplaced, ["vendor"]);
  assert.deepEqual(flowStepPlan(undefined, undefined, []).rows, []);
});

test("each step's vendors: the ones its field names, else — the one field of a version that declares one — every optional connection; its choice, else its default, else None", () => {
  const declared = [
    { providerId: "quickbooks", optional: true },
    { providerId: "google", optional: true },
    { providerId: "slack", optional: false },
  ];
  assert.deepEqual(
    fieldProviders({ providers: ["quickbooks"] }, declared).map(
      (connection) => connection.providerId,
    ),
    ["quickbooks"],
  );
  assert.deepEqual(
    fieldProviders({}, declared).map((connection) => connection.providerId),
    ["quickbooks", "google"],
  );
  const field = v3Setup[0];
  assert.equal(chosenVendor(field, { vendor: "quickbooks" }), "quickbooks");
  assert.equal(chosenVendor(field, {}), NONE);
  assert.equal(
    chosenVendor({ key: "vendor", control: "connection" }, {}),
    NONE,
  );
  assert.equal(chosenVendor(field, { vendor: 42 }), NONE);
  assert.deepEqual(
    rowFields(v3Setup).map((setting) => setting.key),
    ["holdAboveAmount"],
  );
  assert.equal(flowPath("a/b"), "/account/flows/a%2Fb");
  assert.equal(setupPath("f1"), "/account/flows/f1/setup");
});

test("Run a flow: every live flow, by its name and team, each to its Step 1; none when the flows could not be read", () => {
  const subscriptions = [
    { id: "s1", templateId: "invoice", status: "live", projectId: "p1" },
    { id: "s2", templateId: "email", status: "paused", projectId: null },
    {
      id: "s3",
      templateId: "email",
      status: "live",
      projectId: null,
      name: "Email triage",
    },
    { id: "s4", templateId: "invoice", status: "draft", projectId: null },
  ];
  const catalog = [
    { templateId: "invoice", name: "Invoice Processing", icon: "Receipt" },
    { templateId: "email", name: "Email", icon: "EnvelopeSimple" },
  ];
  const team = (subscription) =>
    subscription.projectId ? "Team: Accounting" : "Whole workspace";
  assert.deepEqual(quickRunRows(subscriptions, catalog, team), [
    {
      id: "s1",
      name: "Invoice Processing",
      icon: "Receipt",
      team: "Team: Accounting",
    },
    {
      id: "s3",
      name: "Email triage",
      icon: "EnvelopeSimple",
      team: "Whole workspace",
    },
  ]);
  assert.deepEqual(quickRunRows(null, catalog, team), []);
});

test("the flow page reads top to bottom: its name and status, Dashboard, Steps (Step 1 holding the run), Connections, then its actions with Edit setup — and no description, no help line", () => {
  const page = read("app/account/flows/[subscriptionId]/page.tsx");
  const at = (pattern) => page.search(pattern);
  const order = [
    at(/<SectionCard\s+title=\{name\}/u),
    at(/>\s*Dashboard\s*<\/h2>/u),
    at(/>\s*Steps\s*<\/h2>/u),
    at(/>\s*Connections\s*<\/h2>/u),
    at(/<AutomationActions\b/u),
  ];
  assert.ok(
    order.every((index) => index > 0),
    String(order),
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  // Step 1 is the run's, and Home's Run a flow lands on it.
  assert.match(page, /\{row\.input \? stepOne : null\}/u);
  assert.match(page, /<div id="run"/u);
  // No description under the name (the session's S24), none of a setting.
  assert.doesNotMatch(page, /entry\??\.description|field\.description/u);
  // The vendor row says its state (A3) — never "Connect vendor".
  assert.match(
    page,
    /none\s*\?\s*"Save the details only\."\s*:\s*isConnected\s*\?\s*"Connected"\s*:\s*"Not connected"/u,
  );
  const actions = read("app/account/flows/AutomationActions.tsx");
  assert.match(actions, /export const EDIT_SETUP = "Edit setup";/u);
  // Pause while it is on; Turn on is Step 1's alone (the app's M4).
  assert.match(actions, /subscription\.status === "live" \? \(/u);
  assert.doesNotMatch(actions, /"Turn on"/u);
});

test("Home: Run a flow first, each row to its flow's Step 1 — and no Teams list (the owner's AM5)", () => {
  const home = read("app/account/page.tsx");
  const runAFlow = home.search(/>\s*Run a flow\s*<\/h2>/u);
  const quickActions = home.search(/>\s*Quick actions\s*<\/h2>/u);
  assert.ok(runAFlow > 0 && runAFlow < quickActions);
  assert.match(home, /href=\{`\$\{flowPath\(row\.id\)\}#run`\}/u);
  assert.doesNotMatch(
    home,
    />\s*Teams\s*<\/h2>|View all teams|listAccessibleProjects/u,
  );
});

test("the Dashboard is live: read again every 5 s while a run of the flow is pending or running, and each time the page is shown again (spec A6; S30)", () => {
  const dashboard = read("app/account/flows/FlowDashboard.tsx");
  assert.match(
    dashboard,
    /const going = \(counts\?\.pending \?\? 0\) \+ \(counts\?\.running \?\? 0\) > 0;/u,
  );
  assert.match(
    dashboard,
    /const timer = going\s*\?\s*setTimeout\(\(\) => void read\(\), FLOW_STATS_REREAD_MS\)\s*:\s*null;/u,
  );
  assert.match(
    dashboard,
    /document\.addEventListener\("visibilitychange", shown\);/u,
  );
  assert.match(dashboard, /window\.addEventListener\("focus", shown\);/u);
  // The three tiles, each to Activity for the flow and its outcome.
  for (const [label, href] of [
    ["Runs", "href: activity"],
    ["Successes", "href: `${activity}&status=succeeded`"],
    ["Failures", "href: `${activity}&status=failed`"],
  ]) {
    assert.ok(dashboard.includes(`label: "${label}"`), label);
    assert.ok(dashboard.includes(href), href);
  }
});
