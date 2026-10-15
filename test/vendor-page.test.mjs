import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  CONNECT_RETURN,
  PENDING_CONNECT,
  isVendorPath,
  rememberConnect,
  takeConnectReturn,
} from "../app/account/connections/pending-connect.ts";
import {
  unmetLines,
  vendorChoice,
  vendorPath,
} from "../app/account/flows/vendor-path.ts";
import { setupProblem } from "../app/account/flows/setup-check.ts";

/**
 * The Connect vendor page and Set up's words (spec §3.B–§3.D; backend
 * ADR-0037; the owner's build-19 feedback #1 and #9): each vendor with its
 * logo and None, the choice saved as the flow's `connection` setting, and a
 * vendor connected from the page chosen once its sign-in returns.
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

test("a vendor page is a flow's own path, and only exactly such a path is ever gone back to", () => {
  assert.equal(vendorPath(flow), `/account/flows/${flow}/vendor`);
  assert.equal(isVendorPath(vendorPath(flow)), true);
  for (const other of [
    "/account/flows",
    "/account/connections",
    `/account/flows/${flow}/vendor?x=1`,
    `/account/flows/${flow}/vendor/`,
    `https://evil.example/account/flows/${flow}/vendor`,
    `//evil.example/account/flows/${flow}/vendor`,
    `/account/flows/../../${flow}/vendor`,
    "/account/flows/not-a-flow/vendor",
    "",
    null,
    undefined,
    42,
  ]) {
    assert.equal(isVendorPath(other), false, String(other));
  }
});

test("a connect remembers its provider, and its way back only from a vendor page; the way back is taken once", () => {
  const storage = tab();
  globalThis.sessionStorage = storage;
  try {
    rememberConnect("quickbooks", vendorPath(flow));
    assert.equal(storage.kept.get(PENDING_CONNECT), "quickbooks");
    assert.equal(storage.kept.get(CONNECT_RETURN), vendorPath(flow));
    assert.equal(takeConnectReturn(), vendorPath(flow));
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

test("Connections goes back to the vendor page with how the sign-in ended, and the vendor page makes that vendor the choice once it is connected", () => {
  const panel = read("app/account/connections/ConnectionsPanel.tsx");
  assert.match(
    panel,
    /if \(!callbackStatus\) return;\s*const back = takeConnectReturn\(\);\s*if \(back\) router\.replace\(`\$\{back\}\?status=\$\{callbackStatus\}`\);/u,
  );
  const choice = read(
    "app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx",
  );
  assert.match(
    choice,
    /rememberConnect\(option\.providerId, vendorPath\(subscriptionId\)\);\s*window\.location\.assign\(result\.authorizationUrl\);/u,
  );
  assert.match(
    choice,
    /picked \?\?\s*\(callbackStatus === "connected" &&\s*returnedFor !== null &&\s*connected\(returnedFor\)\s*\?\s*returnedFor\s*:\s*saved\)/u,
  );
  // A vendor not connected cannot be chosen; None always can.
  assert.match(choice, /disabled=\{!isConnected \|\| pending\}/u);
});

test("the vendor page's words are the spec's (§3.C), and the save changes the flow's own vendor setting, never a key the page names", () => {
  const page = read("app/account/flows/[subscriptionId]/vendor/page.tsx");
  assert.match(page, /title="Connect vendor"/u);
  assert.match(
    page,
    /subheader=\{`For \$\{subscription\.name \?\? entry\.name\}`\}/u,
  );
  assert.match(page, /\.filter\(\(connection\) => connection\.optional\)/u);
  const choice = read(
    "app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx",
  );
  for (const words of [
    /Ask an owner or admin to connect it\./u,
    />\s*Connected\s*</u,
    />\s*None\s*</u,
    />\s*Save the details only\.\s*</u,
    /\{saving \? "Saving…" : "Save"\}/u,
    /`Connect \$\{vendor\.displayName\} first, or choose None\.`/u,
    /logo \? logo\.disconnectLabel : "Disconnect"/u,
    /<ProhibitIcon\s+size=\{24\}/u,
    /<CheckIcon size=\{24\}/u,
  ]) {
    assert.match(choice, words);
  }
  assert.doesNotMatch(choice, /JSON\.stringify|config/u);
  const actions = read("app/account/flows/actions.ts");
  const save =
    /export async function saveVendorChoice[\s\S]*?\n\}/u.exec(actions)?.[0] ??
    "";
  assert.match(
    save,
    /const field = subscription\?\.setup\?\.find\(\s*\(candidate\) => candidate\.control === "connection",\s*\);/u,
  );
  assert.match(
    save,
    /config: \{ \.\.\.subscription\.config, \[field\.key\]: choice \}/u,
  );
  assert.doesNotMatch(save, /JSON\.parse|formData\.get\("(?:key|config)"\)/u);
});

test("Set up's words and sections are the spec's (§3.B): numbered, plain, Optional, Save", () => {
  const fields = read("app/account/flows/ManifestFields.tsx");
  assert.match(
    fields,
    /export const SECTION_NAME: Record<AutomationSetupField\["section"\], string> = \{\s*connections: "Connect",\s*source: "Source",\s*rules: "Settings",\s*notifications: "Email",\s*\};/u,
  );
  assert.match(
    fields,
    /<NumberedStep index=\{groupIndex \+ 1\} title=\{name\} \/>/u,
  );
  assert.match(fields, />\s*Optional\s*</u);
  assert.match(fields, />\s*Connect vendor\s*</u);
  assert.match(fields, />\s*Not connected\s*</u);
  assert.match(
    fields,
    /prefix=\{field\.control === "money" \? "\$" : undefined\}/u,
  );
  const actions = read("app/account/flows/AutomationActions.tsx");
  for (const words of [
    /Set up \{name\}/u,
    /\{pending \? "Saving…" : "Save"\}/u,
    /\{pending \? "Working…" : "Turn on"\}/u,
    /Fill this in, then start the run\./u,
    /`Connect \$\{vendor\.displayName\} first, or choose None\.`/u,
  ]) {
    assert.match(actions, words);
  }
  for (const gone of [
    /Flow setup/u,
    /Complete the settings supplied by this flow/u,
    /Save setup/u,
    /Go live/u,
    /Enter what this run needs/u,
  ]) {
    assert.doesNotMatch(actions, gone);
  }
  const file = read("app/account/flows/RunFileField.tsx");
  assert.doesNotMatch(file, /\(optional\)/u);
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
    field("vendor", "Vendor", "connection", { defaultValue: "none" }),
    field("holdAboveAmount", "Approval limit", "money", { defaultValue: 500 }),
    field("notifyEmail", "Also email", "email"),
  ];
  assert.equal(
    setupProblem(setup, form({ vendor: "none", holdAboveAmount: "250" })),
    null,
  );
  for (const blank of ["", "   "]) {
    assert.equal(
      setupProblem(setup, form({ vendor: "none", holdAboveAmount: blank })),
      "Enter an amount for Approval limit.",
    );
  }
  // An amount with nothing to fall back to may be left empty: it is not set.
  assert.equal(
    setupProblem(
      [...setup, field("cap", "Spending cap", "money")],
      form({ vendor: "none", holdAboveAmount: "500", cap: "" }),
    ),
    null,
  );
  // An optional email, empty, is fine.
  assert.equal(
    setupProblem(
      setup,
      form({ vendor: "none", holdAboveAmount: "500", notifyEmail: "" }),
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
  // A required field with a default may be left for the default.
  assert.equal(
    setupProblem(
      [field("mode", "Mode", "text", { required: true, defaultValue: "x" })],
      form({}),
    ),
    null,
  );
});

// Invoice Processing in the catalog (its newest version, v2): QuickBooks is
// optional. A v2 flow declares the vendor setting; a v1 flow — Bills &
// Receipts, which the catalog now names Invoice Processing — declares none,
// and cannot run without QuickBooks.
const quickbooks = {
  providerId: "quickbooks",
  displayName: "QuickBooks Online",
  optional: true,
};
const providers = [
  {
    providerId: "quickbooks",
    displayName: "QuickBooks",
    icon: "QuickBooksLogo",
  },
  { providerId: "fixture-oauth", displayName: "Fixture OAuth", icon: "Plug" },
];
const vendorSetting = {
  key: "vendor",
  title: "Vendor",
  control: "connection",
  defaultValue: "none",
};
const v2Flow = (config, unmetConnections = []) => ({
  id: flow,
  config,
  setup: [
    vendorSetting,
    { key: "notifyEmail", title: "Also email", control: "email" },
  ],
  unmetConnections,
});
const v1Flow = (unmetConnections) => ({
  id: flow,
  config: { defaultCategory: "Expenses" },
  setup: [
    { key: "defaultCategory", title: "Default category", control: "text" },
  ],
  unmetConnections,
});

test("a flow's unmet vendor goes to its vendor page only when its own version has a vendor to choose; a v1 flow is sent to Connections, never to a page that is not there", () => {
  assert.deepEqual(
    unmetLines(
      v2Flow({ vendor: "quickbooks" }, ["quickbooks"]),
      [quickbooks],
      providers,
    ),
    [
      {
        providerId: "quickbooks",
        text: "Connect QuickBooks Online first, or choose None.",
        href: vendorPath(flow),
      },
    ],
  );
  // v1 pins no vendor setting: the catalog's "optional" is v2's, not its own.
  for (const v1 of [
    v1Flow(["quickbooks"]),
    { ...v1Flow(["quickbooks"]), setup: undefined },
  ]) {
    assert.deepEqual(unmetLines(v1, [quickbooks], providers), [
      {
        providerId: "quickbooks",
        text: "Connect QuickBooks Online first.",
        href: "/account/connections",
      },
    ]);
  }
  // A connection a flow cannot run without is connected on Connections, by
  // its name — the catalog's, else the provider's, never the raw id.
  assert.deepEqual(
    unmetLines(
      v2Flow({ vendor: "none" }, ["fixture-oauth", "unknown-provider"]),
      [
        {
          providerId: "fixture-oauth",
          displayName: "Fixture OAuth provider",
          optional: false,
        },
      ],
      providers,
    ),
    [
      {
        providerId: "fixture-oauth",
        text: "Connect Fixture OAuth provider first.",
        href: "/account/connections",
      },
      {
        providerId: "unknown-provider",
        text: "Connect its account first.",
        href: "/account/connections",
      },
    ],
  );
  assert.deepEqual(
    unmetLines(v2Flow({ vendor: "none" }), [quickbooks], providers),
    [],
  );
});

test("Set up's vendor row is the flow's own setting — None, or the chosen vendor with its logo and whether it is connected — and a flow whose version has no vendor setting has none", () => {
  assert.equal(
    vendorChoice(v1Flow(["quickbooks"]), [quickbooks], providers),
    null,
  );
  assert.deepEqual(vendorChoice(v2Flow({}), [quickbooks], providers), {
    key: "vendor",
    providerId: "none",
    href: vendorPath(flow),
  });
  assert.deepEqual(
    vendorChoice(
      v2Flow({ vendor: "quickbooks" }, ["quickbooks"]),
      [quickbooks],
      providers,
    ),
    {
      key: "vendor",
      providerId: "quickbooks",
      href: vendorPath(flow),
      displayName: "QuickBooks Online",
      icon: "QuickBooksLogo",
      connected: false,
    },
  );
  assert.equal(
    vendorChoice(v2Flow({ vendor: "quickbooks" }), [quickbooks], providers)
      ?.connected,
    true,
  );
  // A value that is not a provider's id reads as None.
  assert.equal(
    vendorChoice(v2Flow({ vendor: 42 }), [quickbooks], providers)?.providerId,
    "none",
  );
});
