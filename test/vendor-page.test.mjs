import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CONNECT_RETURN,
  PENDING_CONNECT,
  isReturnPath,
  rememberConnect,
  takeConnectReturn,
  withCallbackStatus,
} from "../app/account/connections/pending-connect.ts";
import { owedLines, vendorPath } from "../app/account/flows/vendor-path.ts";
import { setupProblem } from "../app/account/flows/setup-check.ts";

/**
 * Connect vendor and Set up (Build 21, spec A2, A3, A6; the owner's build 20
 * items 2–5 and AM4): a tap on a vendor or None is the choice — saved at once
 * on Connect vendor, then back to the flow; held by Set up until its one
 * button — and a vendor connected from either page comes back to it chosen.
 * What a flow is owed is said in Step 1, each line a link to where it is
 * fixed.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

const flow = "99999999-9999-4999-8999-999999999999";

/** This tab's storage, as a map, whose calls can be made to fail. */
function tab({ refusing = false } = {}) {
  const kept = new Map();
  const guard = () => {
    if (refusing) throw new DOMException("refused", "SecurityError");
  };
  return {
    kept,
    getItem: (key) => (guard(), kept.has(key) ? kept.get(key) : null),
    setItem: (key, value) => (guard(), kept.set(key, String(value))),
    removeItem: (key) => (guard(), kept.delete(key)),
  };
}

test("a connect goes back only to exactly one of a flow's own pages: the flow, its Set up, or its vendor page for one step's choice", () => {
  assert.equal(vendorPath(flow), `/account/flows/${flow}/vendor`);
  assert.equal(
    vendorPath(flow, "vendor"),
    `/account/flows/${flow}/vendor?field=vendor`,
  );
  for (const path of [
    `/account/flows/${flow}`,
    `/account/flows/${flow}/setup`,
    vendorPath(flow),
    vendorPath(flow, "vendor"),
    vendorPath(flow, "emailVendor2"),
  ]) {
    assert.equal(isReturnPath(path), true, path);
  }
  for (const other of [
    "/account/flows",
    "/account/connections",
    `/account/flows/${flow}/vendor?x=1`,
    `/account/flows/${flow}/vendor?field=Vendor`,
    `/account/flows/${flow}/vendor?field=vendor&next=//evil.example`,
    `/account/flows/${flow}/vendor/`,
    `/account/flows/${flow}/setup?x=1`,
    `https://evil.example/account/flows/${flow}/vendor`,
    `//evil.example/account/flows/${flow}/vendor`,
    `/account/flows/../../${flow}/vendor`,
    "/account/flows/not-a-flow/vendor",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isReturnPath(other), false, String(other));
  }
  assert.equal(
    withCallbackStatus(vendorPath(flow, "vendor"), "connected"),
    `${vendorPath(flow, "vendor")}&status=connected`,
  );
  assert.equal(
    withCallbackStatus(`/account/flows/${flow}/setup`, "error"),
    `/account/flows/${flow}/setup?status=error`,
  );
});

test("a connect remembers its provider, and its way back only from a flow's page; the way back is taken once", () => {
  const storage = tab();
  globalThis.sessionStorage = storage;
  try {
    rememberConnect("quickbooks", vendorPath(flow, "vendor"));
    assert.equal(storage.kept.get(PENDING_CONNECT), "quickbooks");
    assert.equal(storage.kept.get(CONNECT_RETURN), vendorPath(flow, "vendor"));
    assert.equal(takeConnectReturn(), vendorPath(flow, "vendor"));
    // Taken: a second landing on Connections goes nowhere.
    assert.equal(takeConnectReturn(), null);
    // A connect started on Connections keeps no way back — and clears one
    // left from before.
    storage.kept.set(CONNECT_RETURN, vendorPath(flow));
    rememberConnect("fixture-oauth");
    assert.equal(storage.kept.get(PENDING_CONNECT), "fixture-oauth");
    assert.equal(storage.kept.has(CONNECT_RETURN), false);
    // Anything else kept there is never a way back.
    storage.kept.set(CONNECT_RETURN, "https://evil.example/");
    assert.equal(takeConnectReturn(), null);
    assert.equal(storage.kept.has(CONNECT_RETURN), false);
    // Storage the browser refuses: nothing kept, nothing taken, nothing thrown.
    globalThis.sessionStorage = tab({ refusing: true });
    rememberConnect("quickbooks", vendorPath(flow));
    assert.equal(takeConnectReturn(), null);
  } finally {
    delete globalThis.sessionStorage;
  }
});

test("Connections goes back to the page the connect started on, with how the sign-in ended", () => {
  const panel = read("app/account/connections/ConnectionsPanel.tsx");
  assert.match(
    panel,
    /if \(!callbackStatus\) return;\s*const back = takeConnectReturn\(\);\s*if \(back\) router\.replace\(withCallbackStatus\(back, callbackStatus\)\);/u,
  );
  assert.match(panel, /rememberConnect\(provider\.providerId, returnTo\);/u);
  const rows = read("app/account/flows/VendorRows.tsx");
  assert.match(
    rows,
    /rememberConnect\(option\.providerId, returnTo\);\s*window\.location\.assign\(result\.authorizationUrl\);/u,
  );
});

test("Connect integration (~~Connect vendor~~ until Build 22, the session's S21): a tap saves and goes back to the flow — no Done, no Save, no Intuit button, no Disconnect (spec A2; the session's S13)", () => {
  const page = read("app/account/flows/[subscriptionId]/vendor/page.tsx");
  assert.match(page, /title="Connect integration"/u);
  assert.match(
    page,
    /subheader=\{`For \$\{subscription\.name \?\? entry\.name\}`\}/u,
  );
  // The step's vendors — the ones its field names — in the manifest's order.
  assert.match(
    page,
    /fieldProviders\(\s*field,\s*entry\.requiredConnections,?\s*\)/u,
  );
  const choice = read(
    "app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx",
  );
  // The tap is the save: the choice it holds already goes straight back.
  assert.match(
    choice,
    /if \(choice === saved\) \{\s*router\.push\(flowPath\(subscriptionId\)\);\s*return;\s*\}/u,
  );
  assert.match(
    choice,
    /const result = await saveVendorChoice\(data\);\s*if \(!result\.ok\) \{\s*setSaving\(null\);\s*setError\(\s*result\.state === "forbidden" \? result\.error : VENDOR_SAVE_FAILED,?\s*\);\s*return;\s*\}\s*router\.push\(flowPath\(subscriptionId\)\);/u,
  );
  assert.match(
    choice,
    /export const VENDOR_SAVE_FAILED = "Could not save\. Try again\.";/u,
  );
  // Back from a sign-in that connected it: chosen, saved, and back.
  assert.match(choice, /callbackStatus !== "connected" \|\| !returnedFor/u);
  assert.match(choice, /save\(option\.providerId\);/u);
  for (const gone of [
    />\s*Save\s*</u,
    />\s*Done\s*</u,
    /"Saving…" : "Save"/u,
    /Disconnect/u,
    /VendorConnectButton/u,
  ]) {
    assert.doesNotMatch(choice, gone);
  }
  const rows = read("app/account/flows/VendorRows.tsx");
  for (const words of [
    /export const VENDOR_ASK_ADMIN = "Ask an owner or admin to connect it\.";/u,
    /export const VENDOR_NONE_SUB = "Save the details only\.";/u,
    /export const VENDOR_SAVING = "Saving…";/u,
    /name="None"/u,
    /<CheckCircleIcon\s+size=\{24\}/u,
  ]) {
    assert.match(rows, words);
  }
  // The whole row is the control, for an owner or admin only.
  assert.match(rows, /role="radio"\s+aria-checked=\{isChosen\}/u);
  assert.match(rows, /const tappable = canManage;/u);
  assert.match(
    rows,
    /disabled=\{\s*!tappable \|\| \(busy !== null && busy !== option\.providerId\)\s*\}/u,
  );
  // The save changes the flow's own setting for that step, every other value as read.
  const actions = read("app/account/flows/actions.ts");
  const save =
    /export async function saveVendorChoice[\s\S]*?\n\}/u.exec(actions)?.[0] ??
    "";
  assert.match(
    save,
    /const field = fieldKey\s*\?\s*fields\.find\(\(candidate\) => candidate\.key === fieldKey\)\s*:\s*fields\[0\];/u,
  );
  assert.match(
    save,
    /config: \{ \.\.\.subscription\.config, \[field\.key\]: choice \}/u,
  );
  assert.doesNotMatch(save, /JSON\.parse|formData\.get\("(?:key|config)"\)/u);
});

test("Set up: numbered — 1 · Connect with each step's vendors and the accounts it needs, then its settings — and one button, Turn on for a draft or Save (the owner's AM4; the app's M2)", () => {
  const fields = read("app/account/flows/ManifestFields.tsx");
  assert.match(
    fields,
    /export const SECTION_NAME: Record<AutomationSetupField\["section"\], string> = \{\s*connections: "Connect",\s*source: "Source",\s*rules: "Settings",\s*notifications: "Email",\s*\};/u,
  );
  assert.match(
    fields,
    /<NumberedStep index=\{groupIndex \+ firstSection\} title=\{name\} \/>/u,
  );
  assert.match(fields, />\s*Optional\s*</u);
  assert.match(
    fields,
    /prefix=\{field\.control === "money" \? "\$" : undefined\}/u,
  );
  // No vendor row with a button of its own, and no help line.
  assert.doesNotMatch(
    fields,
    /Connect vendor|Not connected|field\.description/u,
  );
  const page = read("app/account/flows/[subscriptionId]/setup/page.tsx");
  assert.match(page, /title=\{`Set up \$\{name\}`\}/u);
  const form = read("app/account/flows/[subscriptionId]/setup/SetupForm.tsx");
  assert.match(
    form,
    /<NumberedStep index=\{1\} title=\{SECTION_NAME\.connections\} \/>/u,
  );
  assert.match(form, /firstSection=\{hasConnect \? 2 : 1\}/u);
  assert.match(form, /const turnOn = status === "draft";/u);
  assert.match(
    form,
    /\{turnOn\s*\?\s*pending\s*\?\s*"Turning on…"\s*:\s*"Turn on"\s*:\s*pending\s*\?\s*"Saving…"\s*:\s*"Save"\}/u,
  );
  // A vendor chosen and not connected is said by name; for Save, only one the page changed.
  assert.match(form, /const changed = turnOn \|\| chosen !== field\.saved;/u);
  assert.match(form, /setError\(connectFirstOrNone\(/u);
  assert.match(form, /router\.push\(flowPath\(subscriptionId\)\);/u);
  // Added, a flow opens its Set up (AM4).
  const add = read("app/account/flows/AddAutomation.tsx");
  assert.match(
    add,
    /if \(result\.subscriptionId\) router\.push\(setupPath\(result\.subscriptionId\)\);/u,
  );
  const file = read("app/account/flows/RunFileField.tsx");
  assert.doesNotMatch(file, /\(optional\)|field\.description/u);
  assert.match(file, /<UploadSimpleIcon size=\{20\} aria-hidden \/>/u);
  assert.match(file, /<CameraIcon size=\{20\} aria-hidden \/>/u);
});

const field = (key, title, control, extra = {}) => ({
  key,
  title,
  control,
  required: false,
  ...extra,
});

function form(values) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values))
    data.set(`config:${key}`, value);
  return data;
}

test("Set up says an empty amount and an empty required field before anything is sent, in the spec's words", () => {
  const setup = [
    field("holdAboveAmount", "Approval limit", "money", { defaultValue: 500 }),
  ];
  assert.equal(setupProblem(setup, form({ holdAboveAmount: "250" })), null);
  for (const blank of ["", "   "]) {
    assert.equal(
      setupProblem(setup, form({ holdAboveAmount: blank })),
      "Enter an amount for Approval limit.",
    );
  }
  // An amount with nothing to fall back to may be left empty: it is not set.
  assert.equal(
    setupProblem(
      [...setup, field("cap", "Spending cap", "money")],
      form({ holdAboveAmount: "500", cap: "" }),
    ),
    null,
  );
  const required = [
    field("reference", "Reference", "text", { required: true }),
    field("account", "Account", "resource-picker", { required: true }),
    field("notify", "Notify", "toggle", { required: true }),
    field("limit", "Limit", "money", { required: true }),
  ];
  assert.equal(
    setupProblem(required, form({ limit: "1" })),
    "Fill in: Reference, Account.",
  );
  assert.equal(
    setupProblem(required, form({ reference: "A", account: "B", limit: "" })),
    "Enter an amount for Limit.",
  );
  assert.equal(
    setupProblem(
      [field("mode", "Mode", "text", { required: true, defaultValue: "x" })],
      form({}),
    ),
    null,
  );
});

// Invoice Processing: QuickBooks is optional where the version has the
// choice. v3 names it on its Done step's field; v2's one field covers it; a
// v1 flow declares no vendor setting and cannot run without QuickBooks.
const quickbooks = {
  providerId: "quickbooks",
  displayName: "QuickBooks Online",
  optional: true,
};
const providers = [
  { providerId: "quickbooks", displayName: "QuickBooks" },
  { providerId: "fixture-oauth", displayName: "Fixture OAuth" },
];
const vendorSetting = {
  key: "vendor",
  control: "connection",
  defaultValue: "none",
};
const v3Flow = (config, unmetConnections = []) => ({
  id: flow,
  config,
  setup: [vendorSetting, { key: "holdAboveAmount", control: "money" }],
  unmetConnections,
});
const v1Flow = (unmetConnections) => ({
  id: flow,
  config: { defaultCategory: "Expenses" },
  setup: [{ key: "defaultCategory", control: "text" }],
  unmetConnections,
});
const none = () => false;

test("Step 1 says what the flow is owed: a chosen vendor not connected — to its step's vendor page — and the accounts it cannot run without, to Connections", () => {
  assert.deepEqual(
    owedLines(
      v3Flow({ vendor: "quickbooks" }, ["quickbooks"]),
      [quickbooks],
      providers,
      none,
    ),
    [
      {
        key: "vendor:vendor",
        text: "Connect QuickBooks Online first, or choose None.",
        href: vendorPath(flow, "vendor"),
      },
    ],
  );
  // Connected, or None: nothing is owed.
  assert.deepEqual(
    owedLines(
      v3Flow({ vendor: "quickbooks" }),
      [quickbooks],
      providers,
      () => true,
    ),
    [],
  );
  assert.deepEqual(
    owedLines(v3Flow({ vendor: "none" }), [quickbooks], providers, none),
    [],
  );
  // A v1 flow has no vendor to choose: its QuickBooks is an account it needs.
  assert.deepEqual(
    owedLines(v1Flow(["quickbooks"]), [quickbooks], providers, none),
    [
      {
        key: "accounts",
        text: "Connect QuickBooks Online first.",
        href: "/account/connections",
      },
    ],
  );
  // An account the catalog does not name, by the provider's name, never its id.
  assert.deepEqual(
    owedLines(
      v3Flow({ vendor: "none" }, ["fixture-oauth", "unknown-provider"]),
      [quickbooks],
      providers,
      none,
    ),
    [
      {
        key: "accounts",
        text: "Connect Fixture OAuth, its account first.",
        href: "/account/connections",
      },
    ],
  );
});

test("the flow page draws the owed lines in Step 1, and its vendor row goes to that step's vendor page", () => {
  const page = read("app/account/flows/[subscriptionId]/page.tsx");
  assert.match(page, /const owed = owedLines\(/u);
  assert.match(page, /href=\{vendorPath\(subscription\.id, key\)\}/u);
  assert.match(page, /\{owed\.map\(\(line\) => \(/u);
});

test("a member sees the integration and never changes it: no row is a choice — None and a connected vendor too — and the list says who can; an owner's rows are unchanged; a refused change says the platform's words (Build 23's B3)", () => {
  const rows = read("app/account/flows/VendorRows.tsx");
  assert.match(
    rows,
    /export const VENDOR_MEMBER_NOTE =\s*"Only an owner or admin can change the integration\.";/u,
  );
  assert.match(rows, /const tappable = canManage;/u);
  assert.match(rows, /if \(busy \|\| !canManage\) return;/u);
  // A vendor row: disabled, said so, no tap.
  assert.match(rows, /aria-disabled=\{!tappable \|\| undefined\}/u);
  assert.match(
    rows,
    /onClick=\{tappable \? \(\) => tap\(option\) : undefined\}/u,
  );
  // None: the same.
  assert.match(
    rows,
    /disabled=\{!canManage \|\| \(busy !== null && busy !== NONE\)\}\s*aria-disabled=\{!canManage \|\| undefined\}\s*onClick=\{canManage \? \(\) => tap\(null\) : undefined\}/u,
  );
  // The note under a member's list only.
  assert.match(
    rows,
    /\{canManage \? null : \([\s\S]*?\{VENDOR_MEMBER_NOTE\}[\s\S]*?\)\}/u,
  );
  // A vendor not connected still says who connects it.
  assert.match(
    rows,
    /!connected && !canManage\s*\?\s*\{ text: VENDOR_ASK_ADMIN/u,
  );
  // The platform's 403 for the vendor save, in its own words.
  const actions = read("app/account/flows/actions.ts");
  assert.match(
    actions,
    /if \(error\.status === 403\)\s*return \{ ok: false, error: error\.message, state: "forbidden" \};/u,
  );
  const choice = read(
    "app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx",
  );
  assert.match(
    choice,
    /setError\(\s*result\.state === "forbidden" \? result\.error : VENDOR_SAVE_FAILED,?\s*\);/u,
  );
});
