import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  NONE,
  activityFilter,
  chosenVendor,
  connectionFields,
  fieldProviders,
  flowPath,
  flowStepPlan,
  localMidnight,
  rowFields,
  settingLine,
  setupPath,
  stepTitle,
  todayHref,
} from "../lib/flow-steps.ts";

/**
 * A flow's page (Build 21, spec A6; Build 22, P1–P4 — the owner's build 21
 * items 5–7) and the dashboard (Build 22, W1; item 1): the steps numbered,
 * titles only — Step 1 holding the document and Start run, step 2 the
 * integration row, step 4 titled by the flow's choice, step 5 who gets the
 * email — then the actions with Edit setup; no Connections, no move. The
 * app's rules (`snoopy-mobile/lib/view/pipeline.ts`, `snoopy-mobile/lib/view/home.ts`).
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");
/** A source file's code alone: its comments — where gone words are struck through — left out. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

// Invoice Processing v4 as its manifest declares it (snoopy-automations
// manifests/invoice-processing.v4.json; spec §3): five groups — a setting
// step (connect), the record step titled by the vendor chosen, the platform's
// email — and a few of its 22 steps in their groups.
const groups = [
  { id: "upload", title: "Upload invoice", description: "Add a PDF or photo." },
  {
    id: "connect",
    title: "Connect integration",
    description: "QuickBooks, or None.",
  },
  {
    id: "process",
    title: "AI processing",
    description: "AI reads and checks each document.",
  },
  {
    id: "record",
    title: "Details saved",
    description: "Saved, or recorded in QuickBooks.",
    titleByConnection: {
      field: "vendor",
      titles: [{ providerId: "quickbooks", title: "QuickBooks updated" }],
    },
  },
  {
    id: "email",
    title: "Email sent",
    description: "The results are emailed.",
    platform: "email",
  },
];
const pipeline = [
  {
    id: "receive",
    kicker: "TRIGGER",
    group: "upload",
    title: "Document received",
    description: "A PDF or photo arrives.",
  },
  {
    id: "extract",
    kicker: "AI STEP",
    group: "process",
    title: "Documents read",
    description: "AI reads each document.",
  },
  {
    id: "decide",
    kicker: "ACTION",
    group: "record",
    title: "Ready to record?",
    description: "Records each one, or waits for approval.",
  },
  {
    id: "create-records",
    kicker: "ACTION",
    group: "record",
    title: "Recorded in QuickBooks",
    description: "Creates bills and expenses.",
  },
];
// v4's two settings (spec §3): the vendor, titled "Integration", in the
// connect step; the Approval limit in none (Set up only).
const v4Setup = [
  {
    key: "vendor",
    control: "connection",
    defaultValue: "none",
    providers: ["quickbooks"],
    group: "connect",
  },
  {
    key: "holdAboveAmount",
    control: "money",
    defaultValue: 500,
  },
];

test("Steps on a v4 QuickBooks flow: exactly 1 · Upload invoice, 2 · Connect integration, 3 · AI processing, 4 · QuickBooks updated, 5 · Email sent — Step 1 the trigger's, the integration in step 2, the email in step 5 (P1, P2; D2, D3)", () => {
  const plan = flowStepPlan(pipeline, groups, v4Setup, {
    vendor: "quickbooks",
    holdAboveAmount: 750,
  });
  assert.deepEqual(
    plan.map((row) => [row.label, row.kind, row.input, row.fields]),
    [
      ["1 · Upload invoice", "steps", true, []],
      ["2 · Connect integration", "setting", false, ["vendor"]],
      ["3 · AI processing", "steps", false, []],
      ["4 · QuickBooks updated", "steps", false, []],
      ["5 · Email sent", "email", false, []],
    ],
  );
  // None: step 4 is Details saved; and so with the field's default, none.
  for (const config of [{ vendor: "none" }, {}]) {
    assert.equal(
      flowStepPlan(pipeline, groups, v4Setup, config)[3].label,
      "4 · Details saved",
    );
  }
});

test("a step's title: its titleByConnection entry for the provider chosen now, else its own — and its own while the flow's settings are unknown", () => {
  const record = groups[3];
  assert.equal(
    stepTitle(record, v4Setup, { vendor: "quickbooks" }),
    "QuickBooks updated",
  );
  assert.equal(stepTitle(record, v4Setup, { vendor: "none" }), "Details saved");
  assert.equal(
    stepTitle(record, v4Setup, { vendor: "xero" }),
    "Details saved",
    "a provider not listed",
  );
  assert.equal(stepTitle(record, v4Setup, undefined), "Details saved");
  assert.equal(
    stepTitle(groups[2], v4Setup, { vendor: "quickbooks" }),
    "AI processing",
  );
});

test("the generic rules: a group no step names is a setting step drawing its fields; platform email is the email row, an unknown platform its title only; a field with no group is not drawn; a version without groups is one row per step, Step 1 the first", () => {
  const unknown = flowStepPlan(
    pipeline,
    [...groups.slice(0, 4), { id: "sms", title: "Text sent", platform: "sms" }],
    v4Setup,
    {},
  );
  assert.deepEqual(unknown[4], {
    id: "sms",
    label: "5 · Text sent",
    kind: "platform",
    input: false,
    fields: [],
  });
  // The Approval limit names no group: on no row.
  assert.ok(
    flowStepPlan(pipeline, groups, v4Setup, {}).every(
      (row) => !row.fields.includes("holdAboveAmount"),
    ),
  );
  const ungrouped = flowStepPlan(pipeline, undefined, v4Setup, {});
  assert.deepEqual(
    ungrouped.map((row) => [row.label, row.kind, row.input]),
    [
      ["1 · Document received", "steps", true],
      ["2 · Documents read", "steps", false],
      ["3 · Ready to record?", "steps", false],
      ["4 · Recorded in QuickBooks", "steps", false],
    ],
  );
  assert.deepEqual(flowStepPlan(undefined, undefined, [], {}), []);
});

test("a setting step's line on a run's page: the integration chosen now — its name, or None — and nothing for a setting step with no connection field", () => {
  const name = (providerId) =>
    providerId === "quickbooks" ? "QuickBooks Online" : providerId;
  assert.equal(
    settingLine("connect", v4Setup, { vendor: "quickbooks" }, name),
    "QuickBooks Online",
  );
  assert.equal(
    settingLine("connect", v4Setup, { vendor: "none" }, name),
    "None",
  );
  assert.equal(settingLine("connect", v4Setup, {}, name), "None");
  assert.equal(settingLine("record", v4Setup, {}, name), null);
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
  const field = v4Setup[0];
  assert.equal(chosenVendor(field, { vendor: "quickbooks" }), "quickbooks");
  assert.equal(chosenVendor(field, {}), NONE);
  assert.equal(
    chosenVendor({ key: "vendor", control: "connection" }, {}),
    NONE,
  );
  assert.equal(chosenVendor(field, { vendor: 42 }), NONE);
  assert.deepEqual(
    rowFields(v4Setup).map((setting) => setting.key),
    ["holdAboveAmount"],
  );
  assert.deepEqual(
    connectionFields(v4Setup).map((setting) => setting.key),
    ["vendor"],
  );
  assert.equal(flowPath("a/b"), "/account/flows/a%2Fb");
  assert.equal(setupPath("f1"), "/account/flows/f1/setup");
});

test("Today: from the browser's own midnight, each tile to Activity from it — Runs every outcome, Successes and Failures theirs (W1; the session's S27)", () => {
  const evening = new Date(2026, 9, 17, 21, 12, 30);
  const midnight = localMidnight(evening);
  assert.equal(Date.parse(midnight), new Date(2026, 9, 17).getTime());
  assert.match(midnight, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u);
  assert.equal(
    todayHref("2026-10-17T07:00:00.000Z"),
    "/account/runs?since=2026-10-17T07%3A00%3A00.000Z",
  );
  assert.equal(
    todayHref("2026-10-17T07:00:00.000Z", "succeeded"),
    "/account/runs?status=succeeded&since=2026-10-17T07%3A00%3A00.000Z",
  );
  assert.equal(
    todayHref("2026-10-17T07:00:00.000Z", "failed"),
    "/account/runs?status=failed&since=2026-10-17T07%3A00%3A00.000Z",
  );
});

test("the flow page reads top to bottom: its name and status, Dashboard, Steps — titles only, Step 1 holding the run, a setting step its integration row, the email step its row — then its actions with Edit setup; no Connections, no move, no description, no help line (P1–P4)", () => {
  const page = read("app/account/flows/[subscriptionId]/page.tsx");
  const at = (pattern) => page.search(pattern);
  // The card, then its parts in their order, then its actions; the parts,
  // with no manifest order (backend ADR-0048), Dashboard then Steps.
  const card = [
    at(/<SectionCard\s+title=\{name\}/u),
    at(/\{parts\.map\(part\)\}/u),
    at(/<AutomationActions\b/u),
  ];
  const parts = [at(/>\s*Dashboard\s*<\/h2>/u), at(/>\s*Steps\s*<\/h2>/u)];
  for (const order of [card, parts]) {
    assert.ok(
      order.every((index) => index > 0),
      String(order),
    );
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
    );
  }
  assert.match(
    page,
    /declaredItems \? \["items"\] : \["dashboard", "steps"\]/u,
  );
  // No Connections on the page (P3), and nothing to move to (P4).
  assert.doesNotMatch(page, /Connections\s*<\/h2>|ConnectionsPanel/u);
  assert.doesNotMatch(page, /newer=|templateVersion </u);
  // Each step its title alone: no line under it (S20; P2).
  assert.match(
    page,
    /<p className="text-sm font-medium text-\[var\(--text\)\]">\s*\{row\.label\}\s*<\/p>\s*\{row\.input \? stepOne : null\}/u,
  );
  assert.doesNotMatch(page, /row\.sub\b/u);
  // Step 1 is the run's; a setting step draws its integration row; the
  // platform's email step draws who gets it, opening its page.
  assert.match(page, /<div id="run"/u);
  assert.match(
    page,
    /\{row\.kind === "setting" && row\.fields\.length > 0 \? \(\s*<div className="mt-2">\{row\.fields\.map\(vendorRow\)\}<\/div>\s*\) : null\}\s*\{row\.kind === "email" \? emailRow : null\}/u,
  );
  assert.match(page, /href=\{emailPath\(subscription\.id\)\}/u);
  // Unread, its address says Unavailable, and it still opens (S22).
  assert.match(
    page,
    /const emailLine = recipients\s*\?\s*recipientsLine\(recipients\)\s*:\s*\{ first: EMAIL_UNAVAILABLE, more: null \};/u,
  );
  // No description under the name (the session's S24), none of a setting.
  assert.doesNotMatch(page, /entry\??\.description|field\.description/u);
  // The integration row says its state (A3).
  assert.match(
    page,
    /none\s*\?\s*"Save the details only\."\s*:\s*isConnected\s*\?\s*"Connected"\s*:\s*"Not connected"/u,
  );
  const actions = read("app/account/flows/AutomationActions.tsx");
  assert.match(actions, /export const EDIT_SETUP = "Edit setup";/u);
  // Pause while it is on; Turn on is Step 1's alone (the app's M4).
  assert.match(actions, /subscription\.status === "live" \? \(/u);
  assert.doesNotMatch(actions, /"Turn on"/u);
  assert.doesNotMatch(code(actions), /newer|MoveVersion|is available/u);
});

test("the dashboard reads top to bottom: Today, the approvals banner while something waits, Add a flow and Flows, Recent runs and See all — the first run in their place; no Run a flow, Quick actions, Workspace overview, Get started, View teams or Connect integration (W1; the owner's build 21 item 1; D4, D6)", () => {
  const home = read("app/account/page.tsx");
  const at = (pattern) => home.search(pattern);
  const order = [
    at(/title="Today"/u),
    at(/<TodayTiles\b/u),
    at(/item needs" : "items need"\}\s*your review/u),
    at(/Exceptions your agents held for judgment/u),
    at(/data-testid="home-quick-actions"/u),
    at(/title="Recent runs"/u),
  ];
  assert.ok(
    order.every((index) => index > 0),
    String(order),
  );
  assert.deepEqual(
    [...order].sort((a, b) => a - b),
    order,
  );
  // Both buttons to Flows, and four recent runs with See all.
  assert.equal(
    home.match(/href="\/account\/flows"/gu)?.length,
    3,
    "Add a flow and Flows, and the first run's Add a flow",
  );
  assert.match(home, /const RECENT_RUNS = 4;/u);
  assert.match(home, /href="\/account\/runs"[\s\S]*?See all/u);
  // The banner only while something waits; the first run in the buttons' and
  // runs' place.
  assert.match(home, /\{home && home\.pending > 0 \? \(/u);
  assert.match(home, /\{home\?\.firstRun \? \(\s*<EmptyRow/u);
  assert.match(home, /title="Nothing automated\. Yet\."/u);
  for (const gone of [
    "Run a flow",
    "Quick actions",
    "Workspace overview",
    "Get started",
    "View teams",
    "Connect integration",
    "Browse flows",
    "Runs this month",
    "listConnections",
    "listWorkspaceProjects",
    "readRunStats",
  ]) {
    assert.ok(!code(home).includes(gone), gone);
  }
  // Today is the browser's: run-stats from its midnight, each tile to
  // Activity from it.
  const today = read("app/account/TodayTiles.tsx");
  assert.match(today, /const midnight = localMidnight\(new Date\(\)\);/u);
  assert.match(
    today,
    /\/run-stats\?since=\$\{encodeURIComponent\(midnight\)\}/u,
  );
  assert.match(
    today,
    /todayHref\(since, "outcome" in tile \? tile\.outcome : undefined\)/u,
  );
  // Unreadable, "Unavailable" once in the tiles' place, as the app's TODAY
  // (its G6) — never in each tile (the Build 22 review).
  assert.match(
    today,
    /if \(stats === "unavailable"\)\s*return \(\s*<p\s+data-testid="home-stats-unavailable"[\s\S]*?\{TODAY_UNAVAILABLE\}\s*<\/p>/u,
  );
  assert.equal(today.match(/TODAY_UNAVAILABLE/gu)?.length, 2);
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

test("Activity is filtered only by a flow id shaped as one — a UUID, as the platform's subscriptionId — and an outcome its tiles name; anything else in the address is no filter, never a refused read that takes the page with it (spec A6; the session's W2)", () => {
  const flow = "f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1";
  assert.deepEqual(activityFilter(flow, "failed"), {
    flowId: flow,
    outcome: "failed",
  });
  assert.deepEqual(activityFilter(flow, "succeeded"), {
    flowId: flow,
    outcome: "succeeded",
  });
  assert.deepEqual(activityFilter(flow, undefined), { flowId: flow });
  for (const notAFlow of [
    "not-a-flow",
    "",
    `${flow}x`,
    ` ${flow}`,
    `${flow}/../x`,
    "f1f1f1f1f1f14f1f8f1ff1f1f1f1f1f1",
    [flow],
    undefined,
  ]) {
    assert.deepEqual(activityFilter(notAFlow, "held"), {}, String(notAFlow));
  }
  const activity = read("app/account/runs/page.tsx");
  assert.match(
    activity,
    /const query = activityQuery\(await props\.searchParams\);\s*const \{ flowId, outcome, since \} = query;/u,
  );
  assert.doesNotMatch(activity, /typeof flow === "string"/u);
});

test("Activity from the dashboard's Today: a since that is an instant keeps the runs made from it, said as Today, or Today · Successes / Failures; any other since is no filter (W1; the session's S27)", () => {
  const since = "2026-10-17T07:00:00.000Z";
  assert.deepEqual(activityFilter(undefined, undefined, since), { since });
  assert.deepEqual(activityFilter(undefined, "failed", since), {
    outcome: "failed",
    since,
  });
  assert.deepEqual(
    activityFilter(undefined, undefined, "2026-10-17T07:00:00+13:00"),
    { since: "2026-10-17T07:00:00+13:00" },
  );
  for (const notAnInstant of [
    "2026-10-17",
    "yesterday",
    "2026-13-45T99:99:99Z",
    `${since} `,
    "",
    [since],
    42,
    undefined,
  ]) {
    assert.deepEqual(
      activityFilter(undefined, undefined, notAnInstant),
      {},
      String(notAnInstant),
    );
  }
  const activity = read("app/account/runs/page.tsx");
  assert.match(
    activity,
    /\(!since \|\| Date\.parse\(run\.createdAt\) >= Date\.parse\(since\)\)/u,
  );
  assert.match(
    activity,
    /const scope = flowName \?\? \(since \? "Today" : null\);/u,
  );
});

test("a flow's own pages draw the settings of the version it RUNS — never the catalog's newer one (backend §12.1 #185) — so its vendor row never opens a vendor page that is not found", () => {
  for (const path of [
    "app/account/flows/[subscriptionId]/page.tsx",
    "app/account/flows/[subscriptionId]/setup/page.tsx",
    "app/account/flows/[subscriptionId]/vendor/page.tsx",
  ]) {
    const page = read(path);
    assert.match(page, /subscription\??\.setup \?\? \[\]/u, path);
    assert.doesNotMatch(page, /setup \?\? entry\??\.setup/u, path);
  }
});
