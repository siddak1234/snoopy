import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, before, test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import {
  OPTIONS_LIMIT,
  OTHER_CODE,
  changedTo,
  expiredByDisconnect,
  offeredDecisions,
  reviewAnswers,
} from "../lib/run-progress.ts";
import {
  connectionAction,
  connectionLine,
  connectionState,
  disconnectedAtProvider,
} from "../lib/connection-rows.ts";
import { EMAIL_STATUS, addressStatus } from "../lib/flow-email.ts";
import {
  elements,
  loadModules,
  parse,
  visibleWords,
} from "./blocks-harness.mjs";

/**
 * Round 21, stage 1, C2 on the website (the client half of the backend's
 * stage-1 contract, commit 35d0695; the same words as the app): each item's
 * screen, drawn from the generated shapes.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

const FIELDS = "app/account/flows/ManifestFields.tsx";
const SETUP = "app/account/flows/[subscriptionId]/setup/SetupForm.tsx";
const DECISION = "app/account/approvals/ApprovalDecision.tsx";
const EMAIL =
  "app/account/flows/[subscriptionId]/email/EmailRecipientsForm.tsx";
const RUN = "app/account/runs/[runId]/RunLive.tsx";
const DISCONNECTED = "app/(auth)/quickbooks/disconnected/page.tsx";
const STUBS = {
  "@/app/account/flows/actions":
    "export const decideApproval = async () => ({ ok: true }); export const cancelRun = async () => ({ ok: true });",
  "../../actions":
    "export const saveSetup = async () => ({ ok: true }); export const saveEmailRecipients = async () => ({ ok: true });",
  // Connections' actions and the flows' own, each module's "./actions".
  "./actions":
    "export const beginConnectionAuthorization = async () => ({ ok: false }); export const connectProviderWithKey = async () => ({ ok: false }); export const disconnectConnection = async () => ({ ok: false }); export const subscribeToAutomation = async () => ({ ok: true }); export const archiveSubscription = async () => ({ ok: true }); export const setSubscriptionStatus = async () => ({ ok: true }); export const startRun = async () => ({ ok: true });",
  "./upload-actions":
    "export const openRunUpload = async () => ({ ok: false, error: 'x' }); export const completeRunUpload = async () => ({ ok: false, error: 'x' });",
};

/** A router where no app router is mounted: what a client page's hooks read here. */
const NO_ROUTER = (source) =>
  source
    .replace(
      /import \{ useRouter \} from "next\/navigation";/u,
      "const useRouter = () => ({ push() {}, refresh() {}, replace() {} });",
    )
    .replace(
      /import \{ usePathname, useRouter \} from "next\/navigation";/u,
      'const usePathname = () => "/account"; const useRouter = () => ({ push() {}, refresh() {}, replace() {} });',
    );

let react;
let server;
const loaded = [];
before(async () => {
  react = await import("react");
  server = await import("react-dom/server");
});
after(() => {
  for (const cleanup of loaded) cleanup();
});

/** One module, loaded as written, or as `mutate` makes it (a bite, or a state). */
async function load(path, mutate) {
  const { modules, cleanup } = await loadModules([path], {
    stubs: STUBS,
    mutate: (file, source) =>
      mutate && file === path ? mutate(NO_ROUTER(source)) : NO_ROUTER(source),
  });
  loaded.push(cleanup);
  return modules[path];
}

const draw = (component, props) =>
  server.renderToStaticMarkup(react.createElement(component, props));
const tree = (markup) => elements(parse(markup));
/** Every text in a drawn node, in order. */
const textsOf = (node) =>
  elements(node)
    .flatMap((one) => one.children)
    .filter((child) => child.text !== undefined)
    .map((child) => child.text);

test("S1-B1: a text setup field's example is its box's placeholder; a field without one, or another control, has none", async () => {
  const { SetupFields } = await load(FIELDS);
  const nodes = tree(
    draw(SetupFields, {
      setup: [
        {
          section: "rules",
          key: "npi",
          title: "NPI",
          description: "",
          control: "text",
          required: false,
          example: "1234567890",
        },
        {
          section: "rules",
          key: "note",
          title: "Note",
          description: "",
          control: "text",
          required: false,
        },
        {
          section: "rules",
          key: "limit",
          title: "Limit",
          description: "",
          control: "money",
          required: false,
          example: "500",
        },
      ],
      config: {},
    }),
  );
  const box = (key) =>
    nodes.find((node) => node.attrs.name === `config:${key}`);
  assert.equal(box("npi").attrs.placeholder, "1234567890");
  assert.equal(box("note").attrs.placeholder, undefined);
  assert.equal(box("limit").attrs.placeholder, undefined);
});

/** A field of Set up, in a section by `sectionId` when one is given. */
const field = (key, control, sectionId, extra = {}) => ({
  section: control === "connection" ? "connections" : "rules",
  key,
  title: key.toUpperCase(),
  description: "",
  control,
  required: false,
  ...(sectionId ? { sectionId } : {}),
  ...extra,
});

/** The same fields with no `sectionId`: a manifest that declares no sections. */
const unsectioned = (one) => {
  const copy = { ...one };
  delete copy.sectionId;
  return copy;
};

/** Each numbered step's words, in order: "01", "NPI", … */
const stepTitles = (nodes) =>
  nodes
    .filter((node) => node.attrs.role === "group")
    .map((node) => node.attrs["aria-label"]);

test("S1-B2: a manifest's sections are Set up's, in its order and by its titles, numbered, each its fields by sectionId — a vendor choice in the section it names", async () => {
  const { SetupFields } = await load(FIELDS);
  const sections = [
    { id: "npi", title: "NPI" },
    { id: "specialty", title: "Specialty" },
    { id: "integrations", title: "Connectors" },
  ];
  const setup = [
    field("learn", "toggle", "integrations"),
    field("npi", "text", "npi"),
    field("vendor", "connection", "integrations"),
    field("specialty", "text", "specialty"),
  ];
  const nodes = tree(
    draw(SetupFields, {
      setup,
      sections,
      config: {},
      hideConnections: true,
      vendors: (key) =>
        react.createElement("p", { "data-testid": `vendor-${key}` }, key),
    }),
  );
  assert.deepEqual(stepTitles(nodes), ["NPI", "Specialty", "Connectors"]);
  const groups = nodes.filter((node) => node.attrs.role === "group");
  const inside = (group) =>
    elements(group)
      .map(
        (node) =>
          node.attrs.name?.replace(/^config:/u, "") ??
          node.attrs["data-testid"],
      )
      .filter((name) => name && !name.startsWith("config-control"));
  assert.deepEqual(inside(groups[0]), ["npi"]);
  assert.deepEqual(inside(groups[1]), ["specialty"]);
  assert.deepEqual(inside(groups[2]), ["learn", "vendor-vendor"]);
  // Numbered from 1, each its own number.
  assert.match(draw(SetupFields, { setup, sections, config: {} }), /01/u);

  // Without sections, the four fixed ones, as before; no vendor drawn here.
  const fixed = tree(
    draw(SetupFields, {
      setup: setup.map(unsectioned),
      config: {},
      hideConnections: true,
      vendors: (key) =>
        react.createElement("p", { "data-testid": `vendor-${key}` }, key),
    }),
  );
  assert.deepEqual(stepTitles(fixed), ["Settings"]);
  assert.equal(
    fixed.filter((node) => node.attrs["data-testid"] === "vendor-vendor")
      .length,
    0,
  );
});

test("S1-B2: Set up with the manifest's sections draws each vendor choice in its section, and Connect only for an account the flow cannot run without", async () => {
  const { SetupForm } = await load(SETUP);
  const props = {
    workspaceId: "w",
    subscriptionId: "s",
    status: "draft",
    available: true,
    setup: [
      field("npi", "text", "npi"),
      field("vendor", "connection", "integrations"),
    ],
    sections: [
      { id: "npi", title: "NPI" },
      { id: "integrations", title: "Connectors" },
    ],
    config: {},
    vendorFields: [
      { key: "vendor", title: "Vendor", saved: "none", options: [] },
    ],
    required: [],
    connections: [],
    canManage: true,
    returnTo: "/account/flows/s/setup",
    callbackStatus: null,
  };
  const nodes = tree(draw(SetupForm, props));
  assert.deepEqual(stepTitles(nodes), ["NPI", "Connectors"]);
  const [connectors] = nodes.filter(
    (node) => node.attrs["aria-label"] === "Connectors",
  );
  assert.ok(
    elements(connectors).some(
      (node) => node.attrs["data-testid"] === "setup-vendor-vendor",
    ),
    "the vendor rows in their section",
  );
  // No sections: 1 · Connect holds the vendor rows, as before.
  const before = tree(
    draw(SetupForm, {
      ...props,
      sections: undefined,
      setup: props.setup.map(unsectioned),
    }),
  );
  assert.deepEqual(stepTitles(before), ["Connect", "Settings"]);
});

const optionsFixture = BLOCK_FIXTURES.find(
  (fixture) => fixture.name === "review-held-options",
);
const heldOptions = optionsFixture.blocks.find(
  (block) => block.type === "questions",
).form;

test("S1-B3: the words; a change keeps its other values, each value once, at most three; the answers posted may name one in place of Accept or Deny, never both", () => {
  assert.equal(OTHER_CODE, "Other code");
  assert.equal(changedTo("N18.31"), "Changed to N18.31");
  assert.equal(OPTIONS_LIMIT, 3);
  const [first, second] = offeredDecisions(heldOptions);
  assert.deepEqual(first.options, [
    { value: "N18.31", label: "N18.31 · Chronic kidney disease, stage 3a" },
    { value: "N18.32", label: "N18.32 · Chronic kidney disease, stage 3b" },
  ]);
  assert.equal("options" in second, false);
  const [many] = offeredDecisions({
    decisions: [
      {
        id: "a",
        label: "A",
        options: [
          { value: "1", label: "One" },
          { value: "1", label: "One again" },
          { value: "2", label: "Two" },
          { value: 3, label: "Not shaped" },
          { value: "4", label: "Four" },
          { value: "5", label: "Five" },
        ],
      },
    ],
  });
  assert.deepEqual(
    many.options.map((option) => option.value),
    ["1", "2", "4"],
  );
  assert.deepEqual(
    reviewAnswers(
      JSON.stringify([
        { id: "n18-4-change", other: "N18.31" },
        { id: "i10-keep", decision: "accepted" },
      ]),
    ),
    [
      { id: "n18-4-change", other: "N18.31" },
      { id: "i10-keep", decision: "accepted" },
    ],
  );
  for (const bad of [
    [{ id: "a", decision: "accepted", other: "N18.31" }],
    [{ id: "a", other: "" }],
    [{ id: "a", other: 7 }],
  ])
    assert.equal(reviewAnswers(JSON.stringify(bad)), null, JSON.stringify(bad));
});

/** The review form drawn with `othersOf` and `answers` as its first state. */
async function review({
  othersOf = null,
  answers = {},
  canDecide = true,
} = {}) {
  const { ApprovalDecision } = await load(DECISION, (source) =>
    source
      .replace(
        "useState<string | null>(null);\n  const [refused",
        `useState<string | null>(${JSON.stringify(othersOf)});\n  const [refused`,
      )
      .replace(
        'Record<string, Omit<ReviewAnswer, "id">>\n  >({});',
        `Record<string, Omit<ReviewAnswer, "id">>\n  >(${JSON.stringify(answers)});`,
      ),
  );
  const markup = draw(ApprovalDecision, {
    approvalId: "a",
    canDecide,
    eligibleRoles: ["owner", "admin"],
    workspaceId: "w",
    decisions: offeredDecisions(heldOptions),
    role: canDecide ? "owner" : "member",
  });
  return { markup, nodes: tree(markup) };
}

test('S1-B3: a change that offers other values has "Other code", which opens their short list; one without has none; a member sees neither', async () => {
  const closed = await review();
  const others = closed.nodes.filter(
    (node) =>
      node.tag === "button" &&
      node.attrs["aria-label"]?.startsWith(`${OTHER_CODE}: `),
  );
  assert.deepEqual(
    others.map((node) => node.attrs["aria-label"]),
    ["Other code: N18.4 → N18.30"],
  );
  assert.equal(others[0].attrs["aria-expanded"], "false");
  assert.ok(
    !visibleWords(closed.markup).includes(
      heldOptions.decisions[0].options[0].label,
    ),
  );

  const open = await review({ othersOf: "n18-4-change" });
  const [list] = open.nodes.filter(
    (node) => node.attrs["data-testid"] === "review-others-n18-4-change",
  );
  assert.deepEqual(
    elements(list)
      .filter((node) => node.tag === "button")
      .map((node) => node.children.map((child) => child.text).join("")),
    [
      "N18.31 · Chronic kidney disease, stage 3a",
      "N18.32 · Chronic kidney disease, stage 3b",
    ],
  );

  const member = await review({ canDecide: false });
  assert.ok(!visibleWords(member.markup).includes(OTHER_CODE));
});

test('S1-B3: a row whose other value was picked says "Changed to {code}", Other code pressed, and the review may be saved', async () => {
  const { markup, nodes } = await review({
    answers: {
      "n18-4-change": { other: "N18.31" },
      "i10-keep": { decision: "accepted" },
    },
  });
  const [changed] = nodes.filter(
    (node) => node.attrs["data-testid"] === "review-changed-n18-4-change",
  );
  assert.equal(changed.children[0].text, "Changed to N18.31");
  const other = nodes.find(
    (node) => node.attrs["aria-label"] === "Other code: N18.4 → N18.30",
  );
  assert.equal(other.attrs["aria-pressed"], "true");
  const save = nodes.find(
    (node) => node.tag === "button" && node.children[0]?.text === "Save review",
  );
  assert.ok(!("disabled" in save.attrs), "every change answered");
  assert.ok(!visibleWords(markup).includes("Accept or deny each change."));
});

test('S1-7: each extra address says its consent — "Waiting for confirmation", "Confirmed" or "Unsubscribed" — matched without case; none sent, or one unknown, no line', async () => {
  assert.deepEqual(EMAIL_STATUS, {
    pending: "Waiting for confirmation",
    confirmed: "Confirmed",
    stopped: "Unsubscribed",
  });
  const recipients = {
    subscriptionId: "s",
    people: [{ email: "owner@example.test", role: "owner" }],
    extra: [
      "new@example.test",
      "Old@Example.test",
      "gone@example.test",
      "odd@example.test",
      "bare@example.test",
    ],
    extraStatuses: [
      { email: "new@example.test", status: "pending" },
      { email: "old@example.test", status: "confirmed" },
      { email: "gone@example.test", status: "stopped" },
      { email: "odd@example.test", status: "bounced" },
    ],
    canEdit: true,
  };
  assert.equal(addressStatus(recipients, "Old@Example.test"), "Confirmed");
  assert.equal(addressStatus({ extra: [] }, "a@example.test"), null);

  const { EmailRecipientsForm } = await load(EMAIL);
  const nodes = tree(
    draw(EmailRecipientsForm, {
      workspaceId: "w",
      subscriptionId: "s",
      initial: recipients,
    }),
  );
  const row = (address) =>
    textsOf(
      nodes.find(
        (node) => node.attrs["data-testid"] === `email-extra-${address}`,
      ),
    );
  assert.deepEqual(row("new@example.test"), [
    "new@example.test",
    "Waiting for confirmation",
  ]);
  assert.deepEqual(row("Old@Example.test"), ["Old@Example.test", "Confirmed"]);
  assert.deepEqual(row("gone@example.test"), [
    "gone@example.test",
    "Unsubscribed",
  ]);
  assert.deepEqual(row("odd@example.test"), ["odd@example.test"]);
  assert.deepEqual(row("bare@example.test"), ["bare@example.test"]);
});

const RUN_ID = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";

/** A held run's page, its job's newest approval expired with `approval`'s fields. */
async function heldRunPage(approval) {
  const { RunLive } = await load(RUN);
  return tree(
    draw(RunLive, {
      view: "run",
      workspaceId: "w",
      initial: {
        run: {
          id: RUN_ID,
          workspaceId: "w",
          subscriptionId: "s",
          templateId: "invoice-processing",
          status: "held",
          origin: "manual",
          createdAt: "2026-11-03T10:00:00Z",
        },
        steps: [],
        events: [],
        blocks: [{ type: "text", text: "Waiting for approval." }],
      },
      flow: {
        name: "Invoice Processing",
        providerNames: { quickbooks: "QuickBooks" },
        pipeline: [],
      },
      approvals: [
        {
          id: "a",
          runId: RUN_ID,
          status: "expired",
          eligibleRoles: ["owner"],
          createdAt: "2026-11-03T10:01:00Z",
          ...approval,
        },
      ],
      role: "owner",
    }),
  );
}

test('S1-8: an approval a disconnect expired says "Expired · QuickBooks was disconnected" and "Reconnect QuickBooks, then start the run again." over the run\'s body; a plain expiry, or a reason this build does not know, says nothing more', async () => {
  const names = (id) => ({ quickbooks: "QuickBooks" })[id] ?? id;
  const expired = {
    status: "expired",
    expiredBy: { reason: "connection-disconnected", providerId: "quickbooks" },
  };
  assert.deepEqual(expiredByDisconnect(expired, names), {
    title: "Expired · QuickBooks was disconnected",
    next: "Reconnect QuickBooks, then start the run again.",
  });
  assert.equal(expiredByDisconnect({ status: "expired" }, names), null);
  assert.equal(
    expiredByDisconnect(
      { ...expired, expiredBy: { reason: "later", providerId: "quickbooks" } },
      names,
    ),
    null,
  );
  assert.equal(
    expiredByDisconnect({ ...expired, status: "pending" }, names),
    null,
  );

  const page = await heldRunPage({ expiredBy: expired.expiredBy });
  const [notice] = page.filter(
    (node) => node.attrs["data-testid"] === "run-expired",
  );
  assert.equal(notice.attrs.role, "status");
  assert.deepEqual(textsOf(notice), [
    "Expired · QuickBooks was disconnected",
    "Reconnect QuickBooks, then start the run again.",
  ]);
  const plain = await heldRunPage({});
  assert.equal(
    plain.filter((node) => node.attrs["data-testid"] === "run-expired").length,
    0,
  );
});

test('S1-8: a connection disconnected at the provider (disconnected, with the errorCode the platform retires it with) says "Disconnected in {provider}" with Reconnect; one disconnected here is Not connected with Connect, as before', () => {
  const connection = (status, extra = {}) => ({
    id: "c",
    providerId: "quickbooks",
    status,
    externalAccount: { displayName: "books@example.test" },
    usedByCount: 1,
    ...extra,
  });
  const retired = connection("disconnected", { errorCode: "invalid_grant" });
  assert.equal(disconnectedAtProvider(retired), true);
  assert.equal(connectionState(retired), "attention");
  assert.equal(connectionAction(connectionState(retired)), "Reconnect");
  assert.deepEqual(connectionLine(retired, "oauth2", "QuickBooks"), {
    text: "Disconnected in QuickBooks",
    tone: "warn",
  });
  const ours = connection("disconnected");
  assert.equal(disconnectedAtProvider(ours), false);
  assert.equal(connectionState(ours), "not-connected");
  assert.equal(connectionAction(connectionState(ours)), "Connect");
  assert.deepEqual(connectionLine(ours, "oauth2", "QuickBooks"), {
    text: "Not connected",
    tone: "muted",
  });
  assert.deepEqual(
    connectionLine(connection("connected"), "oauth2", "QuickBooks"),
    { text: "books@example.test", tone: "muted" },
  );
});

test('S1-8: the website\'s Disconnect page says "QuickBooks is disconnected", and "Reconnect QuickBooks" opens Connections; it reads nothing', async () => {
  const { default: Page } = await load(DISCONNECTED);
  const nodes = tree(draw(Page, {}));
  const [heading] = nodes.filter((node) => node.tag === "h1");
  assert.deepEqual(textsOf(heading), ["QuickBooks is disconnected"]);
  const [button] = nodes.filter((node) => node.tag === "a");
  assert.deepEqual(textsOf(button), ["Reconnect QuickBooks"]);
  assert.equal(button.attrs.href, "/account/connections");
  assert.doesNotMatch(
    read(DISCONNECTED),
    /platform-server|platform-api|fetch\(/u,
  );
});

test("S1-9: \"Only an owner or admin can change this flow.\" — a member's Add, Pause, Archive flow and Turn on are read-only under it, and Set up draws no Turn on or Save; an owner's are as before", async () => {
  const { FLOW_CHANGE_ADMIN_ONLY, flowChangeRefused } =
    await import("../lib/subscription-entitlements.ts");
  assert.equal(
    FLOW_CHANGE_ADMIN_ONLY,
    "Only an owner or admin can change this flow.",
  );
  assert.equal(
    flowChangeRefused(403, { reason: "flow_change_requires_admin" }),
    true,
  );
  assert.equal(
    flowChangeRefused(403, { reason: "integration_requires_admin" }),
    false,
  );
  assert.equal(
    flowChangeRefused(409, { reason: "flow_change_requires_admin" }),
    false,
  );

  const button = (nodes, name) =>
    nodes.find(
      (node) => node.tag === "button" && textsOf(node).join("") === name,
    );
  const { AddAutomation } = await load("app/account/flows/AddAutomation.tsx");
  const add = (canManage) =>
    tree(
      draw(AddAutomation, {
        templateId: "t",
        name: "Invoice Processing",
        available: true,
        workspaceId: "w",
        canManage,
      }),
    );
  const memberAdd = add(false);
  assert.ok("disabled" in button(memberAdd, "Add").attrs);
  assert.ok(textsOf(memberAdd[0]).includes(FLOW_CHANGE_ADMIN_ONLY));
  const ownerAdd = add(true);
  assert.ok(!("disabled" in button(ownerAdd, "Add").attrs));
  assert.ok(!textsOf(ownerAdd[0]).includes(FLOW_CHANGE_ADMIN_ONLY));

  const { AutomationActions } = await load(
    "app/account/flows/AutomationActions.tsx",
  );
  const actions = (canManage) =>
    tree(
      draw(AutomationActions, {
        workspaceId: "w",
        name: "Invoice Processing",
        subscription: { id: "s", status: "live" },
        setupHref: "/account/flows/s/setup",
        webhook: false,
        canManage,
      }),
    );
  const memberActions = actions(false);
  for (const name of ["Pause", "Archive flow"])
    assert.ok("disabled" in button(memberActions, name).attrs, name);
  assert.ok(textsOf(memberActions[0]).includes(FLOW_CHANGE_ADMIN_ONLY));
  const ownerActions = actions(true);
  for (const name of ["Pause", "Archive flow"])
    assert.ok(!("disabled" in button(ownerActions, name).attrs), name);
  assert.ok(!textsOf(ownerActions[0]).includes(FLOW_CHANGE_ADMIN_ONLY));

  const { RunStart } = await load("app/account/flows/RunStart.tsx");
  const memberStart = tree(
    draw(RunStart, {
      workspaceId: "w",
      subscriptionId: "s",
      runInput: [],
      live: false,
      available: true,
      canGoLive: true,
      initialKey: "k",
      canChange: false,
    }),
  );
  assert.ok("disabled" in button(memberStart, "Turn on").attrs);
  assert.ok(textsOf(memberStart[0]).includes(FLOW_CHANGE_ADMIN_ONLY));

  const { SetupForm } = await load(SETUP);
  const setup = (canManage) =>
    tree(
      draw(SetupForm, {
        workspaceId: "w",
        subscriptionId: "s",
        status: "live",
        available: true,
        setup: [field("npi", "text")],
        config: {},
        vendorFields: [],
        required: [],
        connections: [],
        canManage,
        returnTo: "/account/flows/s/setup",
        callbackStatus: null,
      }),
    );
  const memberSetup = setup(false);
  const [fieldset] = memberSetup.filter((node) => node.tag === "fieldset");
  assert.ok("disabled" in fieldset.attrs);
  assert.equal(button(memberSetup, "Save"), undefined);
  assert.ok(textsOf(memberSetup[0]).includes(FLOW_CHANGE_ADMIN_ONLY));
  const ownerSetup = setup(true);
  assert.ok(
    !("disabled" in ownerSetup.find((node) => node.tag === "fieldset").attrs),
  );
  assert.ok(button(ownerSetup, "Save"));
  assert.ok(!textsOf(ownerSetup[0]).includes(FLOW_CHANGE_ADMIN_ONLY));

  // A refusal says it: adding, a set-up save and any other change.
  const flowActions = read("app/account/flows/actions.ts");
  assert.equal(
    flowActions.match(
      /if \(flowChangeRefused\(error\.status, error\.details\)\)\s*return \{ ok: false, error: FLOW_CHANGE_ADMIN_ONLY, state: "forbidden" \};/gu,
    )?.length,
    3,
  );
});

test('S1-11: a domain-only organization refusing a sign-in outside its domains at session resolve is its own screen — "This organization admits only people who sign in with addresses at its verified domains.", "Remove your other sign-in to continue." and "Remove {provider} sign-in" for each; any other refusal is the platform\'s notice, as before', async () => {
  const {
    JOIN_OUTSIDE_DOMAIN,
    OUTSIDE_SIGN_IN_NEXT,
    outsideSignIns,
    removeSignIn,
  } = await import("../lib/domain-only.ts");
  assert.equal(
    JOIN_OUTSIDE_DOMAIN,
    "This organization admits only people who sign in with addresses at its verified domains.",
  );
  assert.equal(OUTSIDE_SIGN_IN_NEXT, "Remove your other sign-in to continue.");
  assert.equal(removeSignIn("microsoft"), "Remove Microsoft sign-in");
  const refusal = (providers, reason = "outside_org_domain") => ({
    reason,
    providers,
  });
  assert.deepEqual(
    outsideSignIns(403, refusal(["google", "apple", "google", "yahoo"])),
    ["google", "apple"],
  );
  assert.equal(outsideSignIns(403, refusal([])), null);
  assert.equal(outsideSignIns(403, refusal(["google"], "other")), null);
  assert.equal(outsideSignIns(409, refusal(["google"])), null);

  // The account layout, its session read refused.
  const PLATFORM =
    "export class PlatformServerError extends Error { constructor(message, status, code, details, retryAfterSeconds) { super(message); this.status = status; this.code = code; this.details = details; this.retryAfterSeconds = retryAfterSeconds; } }";
  const layout = async (details) => {
    const { modules, cleanup } = await loadModules(["app/account/layout.tsx"], {
      mutate: (_, source) => NO_ROUTER(source),
      stubs: {
        "@/lib/platform-server": PLATFORM,
        "@/lib/app-session": `import { PlatformServerError } from "./stub___lib_platform_server.mjs"; export const getAppSession = async () => { throw new PlatformServerError("Forbidden", 403, undefined, ${JSON.stringify(details)}); };`,
        "@/lib/tenancy":
          "export const administers = () => false; export const listWorkspaces = async () => []; export const resolveActiveWorkspaceId = async () => undefined;",
        // The shell's bars, which this refusal never draws.
        "@/components/dashboard/AccountTopBar":
          "export const AccountTopBar = () => null;",
        "@/components/dashboard/DashboardNav":
          "export const DashboardSidebar = () => null; export const DashboardHeader = () => null;",
      },
    });
    loaded.push(cleanup);
    const AccountLayout = modules["app/account/layout.tsx"].default;
    return tree(
      server.renderToStaticMarkup(await AccountLayout({ children: null })),
    );
  };
  const outside = await layout(refusal(["google", "apple"]));
  const [screen] = outside.filter(
    (node) => node.attrs["data-testid"] === "outside-sign-in",
  );
  assert.deepEqual(textsOf(screen), [
    JOIN_OUTSIDE_DOMAIN,
    OUTSIDE_SIGN_IN_NEXT,
    "Remove Google sign-in",
    "Remove Apple sign-in",
  ]);
  const plain = await layout({ reason: "something_else" });
  assert.equal(
    plain.filter((node) => node.attrs["data-testid"] === "outside-sign-in")
      .length,
    0,
  );
  assert.ok(
    plain.some((node) => node.attrs.id === "platform-unavailable-title"),
  );
});

test('S1-14: "Or export every record. A large workspace comes as several files, each kept for a day."; a ready export of several files offers "Download file {n} of {N}" for each, in order, and no Share; one file "Download file" and Share, as before', async () => {
  const { COMPLETE_EXPORT_INTRO, downloadFileLabel, exportFiles } =
    await import("../lib/export-contract.ts");
  assert.equal(
    COMPLETE_EXPORT_INTRO,
    "Or export every record. A large workspace comes as several files, each kept for a day.",
  );
  assert.equal(downloadFileLabel(2, 3), "Download file 2 of 3");
  assert.equal(downloadFileLabel(1, 1), "Download file");
  const part = (n) => ({
    artifactId: `0000000${n}-0000-4000-8000-000000000000`,
    filename: `workspace-export-${n}.json`,
    sizeBytes: 10,
    downloadUrl: `https://store.example.test/${n}`,
    expiresAt: "2026-11-04T10:00:00Z",
  });
  const ready = {
    id: "e",
    status: "ready",
    createdAt: "2026-11-03T10:00:00Z",
    complete: true,
  };
  assert.deepEqual(exportFiles({ ...ready, files: [part(1), part(2)] }), [
    part(1),
    part(2),
  ]);
  assert.deepEqual(exportFiles({ ...ready, file: part(1) }), [part(1)]);
  assert.deepEqual(exportFiles({ ...ready, status: "running" }), []);

  const section = async (job) => {
    const { CompleteExportSection } = await load(
      "app/account/settings/CompleteExportSection.tsx",
      (source) =>
        source.replace(
          "useState<WorkspaceExportJob | null>(null)",
          `useState<WorkspaceExportJob | null>(${JSON.stringify(job)})`,
        ),
    );
    return tree(draw(CompleteExportSection, { workspaceId: "w" }));
  };
  const buttons = (nodes) =>
    nodes
      .filter((node) => node.tag === "button")
      .map((node) => textsOf(node).join(""));
  const several = await section({
    ...ready,
    files: [part(1), part(2), part(3)],
  });
  assert.ok(textsOf(several[0]).includes(COMPLETE_EXPORT_INTRO));
  assert.deepEqual(buttons(several), [
    "Export everything",
    "Download file 1 of 3",
    "Download file 2 of 3",
    "Download file 3 of 3",
  ]);
  const one = await section({ ...ready, file: part(1) });
  assert.deepEqual(buttons(one).slice(0, 2), [
    "Export everything",
    "Download file",
  ]);
});
