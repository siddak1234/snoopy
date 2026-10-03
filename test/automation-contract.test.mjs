import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { heldCopy } from "../lib/held-flow.ts";

/**
 * The website's automation types match the backend's specification.
 *
 * `lib/automations.ts` aliases generated models for every automation screen.
 * A generated file that is stale or a facade that points at the wrong schema
 * would otherwise render a renamed field as blank, so both are asserted here.
 *
 * The specification is read from the backend repository beside this one. When it
 * is absent, the test skips rather than fails: a checkout of `snoopy` alone is a
 * legitimate way to work on the website, and a test that cannot run is not the
 * same as one that failed.
 */

const SPEC_PATH = resolve(
  import.meta.dirname,
  "..",
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
  "docs/openapi/automations.yaml",
);
const CLIENT_PATH = resolve(import.meta.dirname, "../lib/automations.ts");
const GENERATED_PATH = resolve(
  import.meta.dirname,
  "../lib/generated/platform-contracts/automations.d.ts",
);
const ACTIONS_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/actions.ts",
);
const ACTIONS_UI_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/AutomationActions.tsx",
);
const FIELDS_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/ManifestFields.tsx",
);
const PAGE_PATH = resolve(import.meta.dirname, "../app/account/flows/page.tsx");
const PLATFORM_SERVER_PATH = resolve(
  import.meta.dirname,
  "../lib/platform-server.ts",
);
const ENTITLEMENTS_PATH = resolve(
  import.meta.dirname,
  "../lib/subscription-entitlements.ts",
);

const available = existsSync(SPEC_PATH);
const spec = available ? readFileSync(SPEC_PATH, "utf8") : "";
const client = readFileSync(CLIENT_PATH, "utf8");
const generated = existsSync(GENERATED_PATH)
  ? readFileSync(GENERATED_PATH, "utf8")
  : "";
const actions = readFileSync(ACTIONS_PATH, "utf8");
const actionsUi = readFileSync(ACTIONS_UI_PATH, "utf8");
const fields = readFileSync(FIELDS_PATH, "utf8");
const page = readFileSync(PAGE_PATH, "utf8");
const platformServer = readFileSync(PLATFORM_SERVER_PATH, "utf8");
const entitlements = readFileSync(ENTITLEMENTS_PATH, "utf8");

test("generated automation contract is present and used by the facade", () => {
  assert.ok(
    generated.length > 0,
    "generated automation types are missing; run npm run generate:platform-contracts",
  );
  for (const type of [
    "AutomationCatalogEntry",
    "AutomationSetupField",
    "AutomationRunInputField",
    "Subscription",
    "Run",
    "Approval",
    "SubscriptionStatus",
    "RunStatus",
    "ApprovalStatus",
    "RunOrigin",
  ]) {
    facadeAliases(type);
  }
  for (const [type, operation] of [
    ["ListSubscriptionsResponse", "listSubscriptions"],
    ["ListRunsResponse", "listRuns"],
    ["ListApprovalsResponse", "listApprovals"],
    ["CreateSubscriptionResponse", "createSubscription"],
    ["CreateSubscriptionRequest", "createSubscription"],
    ["UpdateSubscriptionResponse", "updateSubscription"],
    ["UpdateSubscriptionRequest", "updateSubscription"],
    ["DecideApprovalRequest", "decideApproval"],
    ["DecideApprovalResponse", "decideApproval"],
    ["CreateRunRequest", "createRun"],
    ["CreateRunResponse", "createRun"],
  ]) {
    assert.match(
      client,
      new RegExp(
        `export type ${type} =\\s*(?:\\|\\s*)?operations\\["${operation}"\\]`,
      ),
      `${type} must alias the generated ${operation} operation`,
    );
  }
});

test("the setup UI is generated from the catalog metadata", () => {
  // One renderer for both manifest declarations — setup and run input (backend
  // ADR-0030) — in ManifestFields.tsx; the card only chooses which to show.
  assert.match(page, /setup=\{automation\.setup\}/);
  assert.doesNotMatch(actionsUi, /SETUP_SECTIONS/);
  assert.match(actionsUi, /<SetupFields setup=\{setup\}/);
  assert.match(fields, /for \(const field of setup\)/);
  assert.match(fields, /currentGroup\?\.section === field\.section/);
  assert.match(
    fields,
    /groups\.push\(\{ section: field\.section, fields: \[field\] \}\)/,
  );
  // toggle is a checkbox, money a number; text and resource-picker are text,
  // because no contract lists resources to pick from.
  assert.match(fields, /field\.control === "toggle"/);
  assert.match(fields, /field\.control === "money" \? "number" : "text"/);
  assert.match(fields, /name=\{`\$\{prefix\}:\$\{field\.key\}`\}/);
  assert.match(fields, /prefix="config"/);
  assert.match(fields, /field\.defaultValue/);
  assert.match(fields, /field\.notifies/);
  assert.match(actions, /saveSubscriptionConfiguration/);
  assert.match(actions, /declaredValues\(formData, "config"\)/);
  assert.match(actions, /const body: UpdateSubscriptionRequest = \{ config \}/);
});

test("subscription entitlement states use only the documented reason tokens", () => {
  assert.match(entitlements, /details\?\.reason === "over_plan_limit"/);
  assert.match(
    entitlements,
    /details\?\.reason === "entitlements_not_configured"/,
  );
  assert.match(entitlements, /if \(status !== 403\) return null/);
  assert.doesNotMatch(
    actions,
    /\/v1\/(?:billing|checkout|subscription-management)/iu,
    "the automation client must not invent a billing flow",
  );
});

test("server action errors do not display raw RFC problem detail text", () => {
  assert.match(platformServer, /problem\.title \?\? fallbackProblemTitle/);
  assert.doesNotMatch(platformServer, /problem\.detail\b/);
});

/** Required property names under one schema in the specification. */
function requiredFields(schemaName) {
  const start = spec.indexOf(`    ${schemaName}:`);
  assert.ok(start > 0, `${schemaName} is missing from the specification`);
  const block = spec.slice(start, spec.indexOf("\n    ", start + 10) + 5);
  const required = /required:\s*\n?\s*\[([^\]]*)\]/.exec(block);
  if (!required) return [];
  return required[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/** Property names emitted for one generated response schema. */
function generatedFields(schemaName) {
  const start = generated.indexOf(`${schemaName}: {`);
  assert.ok(
    start > 0,
    `${schemaName} is missing from generated automation types`,
  );
  const body = generated.slice(start, start + 3_000);
  return [...body.matchAll(/^\s+(\w+)\??:/gmu)].map((match) => match[1]);
}

/** Enum members declared in the specification for one schema. */
function specEnum(schemaName) {
  const start = spec.indexOf(`    ${schemaName}:`);
  assert.ok(start > 0, `${schemaName} is missing from the specification`);
  const block = spec.slice(start, start + 400);
  const members = /enum:\s*\[([^\]]*)\]/.exec(block);
  assert.ok(members, `${schemaName} declares no enum`);
  return members[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .sort();
}

/** Union members emitted for one generated response schema. */
function generatedUnion(typeName) {
  const match = new RegExp(`^\\s+${typeName}:\\s+([\\s\\S]+?);$`, "mu").exec(
    generated,
  );
  assert.ok(match, `${typeName} is missing from generated automation types`);
  const body = match[1];
  return [...body.matchAll(/"([a-z-]+)"/gu)].map((match) => match[1]).sort();
}

function facadeAliases(typeName) {
  assert.match(
    client,
    new RegExp(
      `export type ${typeName} =\\s*components\\["schemas"\\]\\["${typeName}"\\]`,
    ),
    `${typeName} must alias the generated schema`,
  );
}

test(
  "every field the website reads is one the server promises",
  {
    skip: available
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    for (const [schema, type] of [
      ["AutomationCatalogEntry", "AutomationCatalogEntry"],
      ["Subscription", "Subscription"],
      ["Run", "Run"],
      ["Approval", "Approval"],
    ]) {
      const promised = requiredFields(schema);
      const declared = new Set(generatedFields(type));
      const missing = promised.filter((field) => !declared.has(field));
      assert.deepEqual(
        missing,
        [],
        `${type} omits fields the server always sends: ${missing.join(", ")}`,
      );
    }
  },
);

test(
  "status vocabularies match the server exactly",
  {
    skip: available
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    // A status the server can send and the website does not know renders as an
    // unstyled neutral chip — visible, but wrong. A status the website knows and
    // the server never sends is dead code that outlives its reason.
    assert.deepEqual(
      generatedUnion("SubscriptionStatus"),
      specEnum("SubscriptionStatus"),
    );
    assert.deepEqual(generatedUnion("RunStatus"), specEnum("RunStatus"));
    assert.deepEqual(
      generatedUnion("ApprovalStatus"),
      specEnum("ApprovalStatus"),
    );
    assert.deepEqual(generatedUnion("RunOrigin"), specEnum("RunOrigin"));
  },
);

test("every status the website can receive has a tone", () => {
  // StatusPill maps status to tone. An unmapped one is not a crash — it renders
  // neutral — so only a test catches it.
  const pill = readFileSync(
    resolve(import.meta.dirname, "../components/dashboard/StatusPill.tsx"),
    "utf8",
  );
  const mapped = new Set(
    [
      ...pill.matchAll(
        /^\s{2}"?([a-z-]+)"?:\s*"(success|warning|error|info|neutral)"/gmu,
      ),
    ].map((match) => match[1]),
  );

  for (const type of ["SubscriptionStatus", "RunStatus", "ApprovalStatus"]) {
    for (const status of generatedUnion(type)) {
      assert.ok(
        mapped.has(status),
        `${type} member "${status}" has no tone in StatusPill`,
      );
    }
  }
});

test("an archived subscription is treated as absent by the automations page", () => {
  // Archiving is one-way and is how a workspace gives a plan slot back
  // (`SubscriptionStatus` in automations.yaml, backend 18.5.3); the automation
  // is used again by subscribing afresh. The list's contract does not promise to
  // omit archived rows, so the page drops them before pairing cards with
  // subscriptions — a card for an archived row offers Add, not Pause or Go live.
  assert.match(
    page,
    /status !== "archived"/,
    "page.tsx must drop archived subscriptions before pairing them with cards",
  );
});

test("the website never sends a field the server refuses", () => {
  // The Edge rejects unsupported fields outright rather than ignoring them, so a
  // body carrying one fails the whole request. These two are the tempting ones:
  // both are resolved from the session and neither may be asserted by a caller.
  for (const refused of ["actorRole", "actorUserId"]) {
    assert.ok(
      !new RegExp(`${refused}\\s*:`).test(actions),
      `actions.ts sends "${refused}", which the Edge refuses as an unsupported field`,
    );
  }
});

test("automation mutations consume generated operation response types", () => {
  // The mutations live in the facade, where every id in a path is encoded
  // (register F9); the actions decide what to send and what a refusal means.
  for (const type of [
    "CreateSubscriptionResponse",
    "UpdateSubscriptionResponse",
    "DecideApprovalResponse",
    "CreateRunResponse",
    "CancelRunResponse",
  ]) {
    assert.match(
      client,
      new RegExp(`platformServerJson<${type}>`),
      `the automations facade must use ${type}`,
    );
  }
  for (const type of [
    "CreateSubscriptionRequest",
    "UpdateSubscriptionRequest",
    "DecideApprovalRequest",
    "CreateRunRequest",
  ]) {
    assert.match(
      actions,
      new RegExp(`const body: ${type} =`),
      `automation action must use ${type}`,
    );
  }
  assert.doesNotMatch(
    client,
    /platformServerJson<\{\s*(?:subscription|run|approval):/,
    "the facade must not recreate generated response shapes",
  );
});

test("an action builds no platform path — every id reaches the Edge encoded (register F9)", () => {
  // The facades build every workspace-scoped path through `workspacePath` and
  // encode each id they append; an action that built its own path is how a
  // form-supplied id went into a URL unencoded.
  assert.doesNotMatch(actions, /platformServerJson|\/v1\//u);
  for (const [id, pattern] of [
    [
      "subscriptionId",
      /\/subscriptions\/\$\{encodeURIComponent\(subscriptionId\)\}/u,
    ],
    ["runId", /\/runs\/\$\{encodeURIComponent\(runId\)\}\/cancel/u],
    [
      "approvalId",
      /\/approvals\/\$\{encodeURIComponent\(approvalId\)\}\/decision/u,
    ],
  ]) {
    assert.match(client, pattern, `${id} is encoded where the path is built`);
  }
  assert.match(
    platformServer,
    /export function workspacePath\(workspaceId: string\): string \{\s*return `\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}`;/u,
    "the workspace segment is encoded in one place",
  );
});

test("automation list reads consume generated operation response types", () => {
  for (const [type, operation] of [
    ["ListSubscriptionsResponse", "listSubscriptions"],
    ["ListRunsResponse", "listRuns"],
    ["ListApprovalsResponse", "listApprovals"],
  ]) {
    assert.match(
      client,
      new RegExp(`platformServerJson<${type}>`),
      `${operation} must use ${type}`,
    );
  }
  assert.doesNotMatch(
    client,
    /Promise<\{\s*(?:subscriptions|runs|approvals):/,
    "automation list reads must not recreate generated response shapes",
  );
});

test("a manual run is started only from the pinned version's declared input — never raw JSON", () => {
  // The Run-now dialog took raw JSON and stays retired (owner, 2026-09-24).
  // Its replacement is the owner's decision in backend ADR-0030 (§12.1 #162): a
  // form rendered from `Subscription.runInput`, which the platform also checks.
  assert.doesNotMatch(
    actionsUi,
    /Run now|runOpen|triggerRun|<textarea|JSON\.parse/u,
    "the retired raw-JSON dialog must not come back",
  );
  assert.doesNotMatch(actions, /JSON\.parse/u, "no action accepts raw JSON");
  // Offered only when it can be honest: live, available, and declared.
  assert.match(actionsUi, /subscription\.status === "live"/);
  assert.match(actionsUi, /subscription\.runInput\?\.length \?\? 0\) > 0/);
  assert.match(
    actionsUi,
    /<RunInputFields\s+runInput=\{subscription\.runInput\}/,
  );
  // The pinned version's declaration, not the catalog's newest.
  assert.match(page, /runInput: subscription\.runInput/);
  assert.match(fields, /prefix="input"/);
  // The run is created through the generated client, once per key, and the
  // person is taken to its page.
  assert.match(actions, /declaredValues\(formData, "input"\)/);
  // The key is the form's, made when the dialog opens and whenever a value
  // changes, so a resubmission after a lost answer cannot start a second run.
  assert.match(actionsUi, /name="idempotencyKey" value=\{runKey\}/);
  assert.match(actionsUi, /onChange=\{newRunKey\}/);
  assert.match(actionsUi, /if \(which === "run"\) newRunKey\(\)/);
  assert.match(actions, /formData\.get\("idempotencyKey"\)/);
  assert.doesNotMatch(actions, /newIdempotencyKey\("run"\)/);
  assert.match(
    actionsUi,
    /router\.push\(`\/account\/runs\/\$\{result\.runId\}`\)/,
  );
});

test("archiving is its own confirmed action, and the generic status action cannot reach it", () => {
  // Backend §12.1 #169 and #92: one-way, and how a plan slot is given back.
  assert.match(actions, /export async function archiveSubscription/);
  assert.match(actions, /status: "archived"/);
  assert.match(actions, /revalidatePath\("\/account\/billing"\)/);
  const generic =
    /export async function setSubscriptionStatus[\s\S]*?\n\}/u.exec(actions);
  assert.ok(generic, "setSubscriptionStatus not found");
  assert.doesNotMatch(
    generic[0],
    /"archived"/u,
    "the unconfirmed status action must not accept archived",
  );
  assert.match(actionsUi, /archiveSubscription\(/);
  // Archive flow, in the app's words (the owner's build 9; build 10's
  // wording): where it goes, that its runs stay, and that it can be unarchived
  // (build 12's #4).
  assert.match(actionsUi, />\s*Archive flow\s*</u);
  assert.match(actionsUi, />\s*Archive \{name\}\?\s*</u);
  assert.match(
    actionsUi,
    /It stops and moves to Archived flows\. Its runs stay in Activity, and\s+you can unarchive it later\./u,
  );
  assert.match(actionsUi, /pending \? "Archiving…" : "Archive"/u);
});

test("a card lists every subscription it has, each under its own scope (register F21)", () => {
  // The platform still takes a subscription per project (backend 18.6.2), so a
  // workspace may hold a duplicate from before one flow per workspace (the
  // owner's build 12, #9) — listed, never hidden. Keyed by template alone, the
  // last-written — the OLDEST, in a newest-first list — hid the rest.
  assert.doesNotMatch(
    page,
    /new Map<string, Subscription>\(/u,
    "no one-subscription-per-template map",
  );
  assert.match(
    page,
    /const byTemplate = new Map<string, Subscription\[\]>\(\);/u,
  );
  assert.match(page, /subscriptions\.map\(\(subscription\) => \(/u);
  assert.match(page, /subscription\.projectId\s*\?\s*`Team: /u);
  // Adding names a team every time (the owner's build 10, below).
  assert.match(
    actions,
    /const body: CreateSubscriptionRequest = \{ templateId, projectId \};/u,
  );
});

test("a flow is added to a team — never the whole workspace — and a workspace with no team yet is told to make one, in the app's words (the owner's build 10)", () => {
  const addUi = read("app/account/flows/AddAutomation.tsx");
  // The places offered are the open teams, and no other — for a flow held
  // nowhere, as Add is drawn only then (the owner's build 12, #9, below); a
  // flow added to the whole workspace before stays listed and labelled.
  assert.doesNotMatch(
    page,
    /label: "Whole workspace"/u,
    "the whole workspace is not a place to add to",
  );
  assert.match(
    page,
    /const scopes: AddScope\[\] = projects\.map\(\(project\) => \(\{\s*projectId: project\.id,\s*label: `Team: \$\{project\.type\}`,\s*\}\)\);/u,
  );
  assert.match(page, /: "Whole workspace"/u, "an older row keeps its label");
  assert.match(
    addUi,
    /export type AddScope = \{ projectId: string; label: string \};/u,
  );
  // The team is sent every time; an Add that names none is refused in the
  // shared wording's words before any call.
  assert.match(addUi, /data\.append\("projectId", scope\);/u);
  assert.doesNotMatch(addUi, /if \(scope\) data\.append/u);
  assert.match(
    actions,
    /if \(!projectId\) return \{ ok: false, error: "Pick a team\." \};/u,
  );
  assert.doesNotMatch(
    actions,
    /projectId \? \{ projectId \} : \{\}/u,
    "no body goes without a team",
  );
  // With no team yet: an owner or admin reads the line and the way to Teams; a
  // plain member reads who makes it; neither is offered Add, and nothing is
  // sent. The role is the workspace list's (register F8).
  assert.match(page, /hasTeam=\{projects\.length > 0\}/u);
  assert.match(page, /canAdminister=\{canAdminister\}/u);
  assert.match(addUi, /if \(!hasTeam\) \{\s*return canAdminister \? \(/u);
  assert.match(addUi, />\s*Create a team first\.\s*</u);
  assert.match(addUi, /href="\/account\/teams"/u);
  assert.match(addUi, />\s*An owner or admin creates the first team\.\s*</u);
});

test("an archived flow is unarchived in every word a person reads — the archive's confirm and the Archived flows note — and no source file says the old words (the owner's build 12, #4; register F87)", () => {
  // A rename: unarchiving is adding the flow afresh through its card's Add, as
  // it was — the platform's archive stays one-way (backend §12.1 #92).
  assert.match(
    actionsUi,
    /It stops and moves to Archived flows\. Its runs stay in Activity, and\s+you can unarchive it later\./u,
  );
  assert.match(
    page,
    />\s*An archived flow keeps its history here\. Unarchive it any time\.\s*</u,
  );
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(
      resolve(import.meta.dirname, "..", directory),
      { withFileTypes: true },
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx?$/u.test(entry.name)) files.push(path);
    }
  };
  for (const directory of ["app", "components", "lib"]) walk(directory);
  assert.ok(files.length > 0, "no source files were found to read");
  for (const path of files) {
    assert.doesNotMatch(
      read(path),
      /add (?:it|any) again/iu,
      `${path} still says the old words`,
    );
  }
});

test("a flow is held once per workspace: by a copy that is not archived, in any team or the whole workspace, and never by an archived one (the owner's build 12, #9; register F87)", () => {
  const copy = (id, templateId, status, projectId) => ({
    id,
    templateId,
    status,
    projectId,
  });
  // Held nowhere: no copy at all, or only another flow's.
  assert.equal(heldCopy([], "invoice-check"), undefined);
  assert.equal(
    heldCopy([copy("a", "invoice-intake", "live", null)], "invoice-check"),
    undefined,
  );
  // Held in a team or in the whole workspace, whatever its status but archived.
  for (const status of ["draft", "live", "paused"]) {
    for (const projectId of ["team-it", null]) {
      const held = copy("b", "invoice-check", status, projectId);
      assert.equal(
        heldCopy(
          [copy("a", "invoice-intake", "live", null), held],
          "invoice-check",
        ),
        held,
        `${status}, in ${projectId ?? "the whole workspace"}`,
      );
    }
  }
  // An archived copy holds nothing, wherever it was: the flow can be
  // unarchived (#4). Beside one, the copy that is not archived is held.
  assert.equal(
    heldCopy(
      [
        copy("c", "invoice-check", "archived", "team-it"),
        copy("d", "invoice-check", "archived", null),
      ],
      "invoice-check",
    ),
    undefined,
  );
  const live = copy("e", "invoice-check", "live", "team-it");
  assert.equal(
    heldCopy(
      [copy("d", "invoice-check", "archived", null), live],
      "invoice-check",
    ),
    live,
  );
  // A duplicate from before is one flow held: the first listed — the newest,
  // as the platform lists — is the one named.
  const newer = copy("f", "invoice-check", "live", "team-it");
  const older = copy("g", "invoice-check", "paused", null);
  assert.equal(heldCopy([newer, older], "invoice-check"), newer);
});

test("a held flow's card offers no team and says where it is, with the way to it, and Add refuses a second copy in words before anything is sent (the owner's build 12, #9; register F87)", () => {
  // One rule, said once, for the page and the action.
  assert.match(page, /import \{ heldCopy \} from "@\/lib\/held-flow";/u);
  assert.match(actions, /import \{ heldCopy \} from "@\/lib\/held-flow";/u);
  // The card: held, "Added · Team: {kind}" or "Added · Whole workspace" — the
  // app's Added with its team — going to the flow's own row, and no Add,
  // whatever teams there are, or none.
  assert.match(
    page,
    /const held = heldCopy\(subscriptions, automation\.templateId\);/u,
  );
  assert.match(
    page,
    /const where = \(subscription: Subscription\) =>\s*subscription\.projectId\s*\?\s*`Team: \$\{projectName\.get\(subscription\.projectId\) \?\? "a team"\}`\s*:\s*"Whole workspace";/u,
  );
  assert.match(
    page,
    /\{held \? \(\s*<a\s+href=\{`#flow-\$\{held\.id\}`\}[^>]*>\s*Added · \{where\(held\)\}\s*<\/a>\s*\) : \(\s*<AddAutomation\b/u,
  );
  assert.match(page, /id=\{`flow-\$\{subscription\.id\}`\}\s*tabIndex=\{-1\}/u);
  // The action: after the workspace check, and before the call that adds.
  const subscribe =
    /export async function subscribeToAutomation[\s\S]*?\n\}/u.exec(actions);
  assert.ok(subscribe, "subscribeToAutomation not found");
  assert.match(
    subscribe[0],
    /if \(!workspaceId\) return \{ ok: false, error: WORKSPACE_CHANGED \};[\s\S]*?const \{ subscriptions \} = await listSubscriptions\(workspaceId\);\s*if \(heldCopy\(subscriptions, templateId\)\)\s*return \{ ok: false, error: ALREADY_IN_WORKSPACE \};\s*const response = await createSubscription\(workspaceId, body\);/u,
  );
  assert.match(
    actions,
    /const ALREADY_IN_WORKSPACE = "This flow is already in this workspace\.";/u,
  );
});

test("a notifications toggle says what it switches, in words (register F22)", () => {
  assert.match(
    fields,
    /const NOTIFIES: Record<\s*NonNullable<AutomationSetupField\["notifies"\]>,\s*string\s*> = \{/u,
    "keyed by the generated enum, so a new value cannot render as its token",
  );
  assert.doesNotMatch(
    fields,
    /\{field\.notifies\}/u,
    "the wire token is not rendered",
  );
  assert.match(
    fields,
    /Controls the notification sent when \{NOTIFIES\[field\.notifies\]\}/u,
  );
});

test("a run that can still stop offers Cancel, and nothing else does (cancelRun)", () => {
  const runPage = readFileSync(
    resolve(import.meta.dirname, "../app/account/runs/[runId]/page.tsx"),
    "utf8",
  );
  assert.match(
    runPage,
    /run\.status === "pending" \|\| run\.status === "running" \? \(\s*<div className="mt-4">\s*<CancelRunButton runId=\{run\.id\} workspaceId=\{run\.workspaceId\} \/>/u,
  );
  // The run the page showed, in the workspace it showed: after a switch in
  // another tab the same id would 404 elsewhere and read as "already stopped".
  assert.match(
    actions,
    /const workspaceId = await activeWorkspaceIfShown\(shownWorkspaceId\);\s*if \(!workspaceId\) return \{ ok: false, error: WORKSPACE_CHANGED \};\s*await cancelWorkspaceRun\(workspaceId, runId\);/u,
  );
  assert.match(
    actions,
    /export async function cancelRun\(formData: FormData\)/u,
  );
  assert.match(
    actions,
    /error\.status === 404\) \{\s*return \{\s*ok: false,\s*error: "This run has already stopped, so there is nothing to cancel\.",/u,
  );
});

test("the account home shows the workspace's own numbers, not fixed zeros (register F54)", () => {
  const home = readFileSync(
    resolve(import.meta.dirname, "../app/account/page.tsx"),
    "utf8",
  );
  assert.doesNotMatch(home, /<dd className="text-\[var\(--text\)\]">0<\/dd>/u);
  assert.match(
    home,
    /readRunStats\(workspaceId, startOfMonthUtc\(new Date\(\)\)\)/u,
  );
  assert.match(client, /\/run-stats\$\{query\}/u);
  assert.doesNotMatch(
    home,
    /href="\/solutions"|href="\/account\/settings"/u,
    "the home's links go to the account's own automations and connections",
  );
});

/**
 * The `details.reason` tokens one operation's description names — the words
 * a person is shown are keyed by them, so each must be one the platform sends.
 */
function specReasons(operationId) {
  const start = spec.indexOf(`operationId: ${operationId}\n`);
  assert.ok(start > 0, `${operationId} is missing from the specification`);
  const end = spec.slice(start).search(/\n\s+(?:parameters|requestBody):/u);
  return [
    ...new Set(
      [
        // A reason is named on its own, or as `details.reason: <reason>`.
        ...spec
          .slice(start, start + end)
          .matchAll(/`(?:details\.reason: )?([a-z]+(?:_[a-z]+)+)`/gu),
      ].map((match) => match[1]),
    ),
  ].sort();
}

/** The keys of one `Record<string, string>` of refusals in a source file. */
function refusalKeys(source, name) {
  const block = new RegExp(
    `const ${name}: Record<string, string> = \\{([\\s\\S]*?)\\n\\};`,
    "u",
  ).exec(source);
  assert.ok(block, `${name} not found`);
  return [...block[1].matchAll(/^\s{2}(\w+):/gmu)]
    .map((match) => match[1])
    .sort();
}

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("a run's file goes straight to the store, and the run carries only its id (backend FR-14)", () => {
  const fileField = read("app/account/flows/RunFileField.tsx");
  const uploads = read("app/account/flows/upload-actions.ts");
  const browserApi = read("lib/platform-api.ts");
  // An artifact field is rendered as a file chooser; every other control as
  // before.
  assert.match(fields, /field\.control === "artifact" \? \(\s*<RunFileField/u);
  // The form carries the file's id under the same `input:<key>` name every
  // other control uses, so the run's input is built one way.
  assert.match(
    fileField,
    /name=\{`input-control:\$\{field\.key\}`\}\s*value="artifact"/u,
  );
  assert.match(
    fileField,
    /name=\{`input:\$\{field\.key\}`\}\s*value=\{state\.artifactId\}/u,
  );
  // The bytes go to the URL the platform signed — never through the website
  // or the platform's API, and with no cookie.
  assert.match(
    fileField,
    /await putFileToSignedUrl\(opened\.ticket\.uploadUrl, file, upload\.signal\)/u,
  );
  assert.doesNotMatch(fileField, /platformServerJson|\/api\/platform/u);
  assert.match(
    browserApi,
    /method: "PUT",\s*body: file,\s*credentials: "omit",/u,
  );
  // The run waits for the file.
  assert.match(actionsUi, /disabled=\{pending \|\| uploading\}/u);
  // Through the generated client, every id encoded where the path is built.
  assert.match(
    client,
    /platformServerJson<UploadTicket>\(`\$\{scope\(workspaceId\)\}\/uploads`/u,
  );
  assert.match(
    client,
    /platformServerJson<CompleteUploadResponse>\(\s*`\$\{scope\(workspaceId\)\}\/uploads\/\$\{encodeURIComponent\(uploadSessionId\)\}\/complete`/u,
  );
  // Both act on the workspace the page showed (register F70), never the active one.
  assert.match(uploads, /activeWorkspaceIfShown\(input\.workspaceId\)/u);
  assert.match(uploads, /activeWorkspaceIfShown\(shownWorkspaceId\)/u);
  if (available) {
    assert.deepEqual(
      refusalKeys(uploads, "UPLOAD_REFUSALS"),
      [...specReasons("openUpload"), ...specReasons("completeUpload")].sort(),
      "every refusal the two upload operations name is said in words, and no other",
    );
  }
});

test("a run refused for its file says so and empties the file field to choose again, and no other refusal does (backend FR-14)", () => {
  // `artifact_unavailable` is a file already given to a run, or gone: checking
  // the values cannot fix it, so it is said in its own words.
  assert.match(
    actions,
    /if \(error\.status === 422 && known\) \{[\s\S]*?reason === "artifact_unavailable"\s*\?\s*\{ state: "file-unavailable" as const \}/u,
  );
  assert.match(
    actionsUi,
    /if \(result\.state === "file-unavailable"\) \{\s*setFileRound\(\(round\) => round \+ 1\);\s*newRunKey\(\);/u,
  );
  assert.match(fields, /key=\{`\$\{field\.key\}:\$\{fileRound\}`\}/u);
  if (available) {
    assert.deepEqual(
      refusalKeys(actions, "RUN_REFUSALS"),
      specReasons("createRun"),
      "every reason createRun names is said in words, and no other",
    );
  }
});

test("a subscription moves to the newest version in place, and each refusal the platform names is said in words (backend §12.1 #126)", () => {
  assert.match(
    actions,
    /await updateSubscription\(\s*workspaceId,\s*subscriptionId,\s*\{ templateVersion \},\s*"version",\s*\);\s*revalidatePath\("\/account\/flows"\);/u,
  );
  assert.match(
    page,
    /subscription\.templateVersion < automation\.version \? \([\s\S]*?<MoveVersionButton/u,
  );
  assert.doesNotMatch(page, /archive it and add it again/u);
  if (available) {
    assert.deepEqual(
      refusalKeys(actions, "MOVE_REFUSALS"),
      specReasons("updateSubscription"),
    );
  }
});

test("a webhook address is offered for a webhook-started automation to an owner or admin only, and its secret is never kept (backend §12.1 #91, #109)", () => {
  const button = read("app/account/flows/WebhookAddressButton.tsx");
  const webhook = read("app/account/flows/webhook-actions.ts");
  assert.match(
    page,
    /subscription\.triggerKind === "webhook" && canAdminister \? \(\s*<div>\s*<WebhookAddressButton/u,
  );
  assert.match(page, /const canAdminister = administers\(role\);/u);
  // Shown once, in the dialog, and forgotten when it closes.
  assert.doesNotMatch(
    button,
    /localStorage|sessionStorage|document\.cookie|console\./u,
  );
  assert.match(
    button,
    /const close = \(\) => \{\s*setOpen\(false\);[\s\S]*?setIssued\(null\);/u,
  );
  assert.doesNotMatch(webhook, /console\.|revalidatePath/u);
  // Issuing takes no idempotency key: a replay would mean storing the secret.
  assert.match(
    client,
    /platformServerJson<IssuedWebhookEndpoint>\(\s*`\$\{scope\(workspaceId\)\}\/subscriptions\/\$\{encodeURIComponent\(subscriptionId\)\}\/webhook`,\s*\{ method: "POST" \},\s*\);/u,
  );
  // None issued yet is not an error.
  assert.match(
    client,
    /error instanceof PlatformServerError && error\.status === 404\)\s*return null;/u,
  );
  if (available) {
    assert.deepEqual(
      refusalKeys(webhook, "ISSUE_REFUSALS"),
      specReasons("issueWebhookEndpoint"),
    );
  }
});

test("archived flows are read by name, and only rows that are archived are kept (backend §12.1 #203, BUILD-PLAN 24.11.11)", () => {
  // A platform from before the SEVENTEENTH promotion ignores the filter and
  // answers the live list: a live flow must never be shown as archived.
  assert.match(
    client,
    /`\$\{scope\(workspaceId\)\}\/subscriptions\?status=archived`,\s*\);\s*return response\.subscriptions\.filter\(\s*\(subscription\) => subscription\.status === "archived",\s*\);/u,
  );
  assert.match(page, /listArchivedSubscriptions\(workspaceId\)/u);
  assert.match(page, />\s*Archived flows\s*</u);
  assert.match(page, /Archived \{formatDay\(subscription\.updatedAt\)\}/u);
});
