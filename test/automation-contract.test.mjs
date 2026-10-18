import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { heldCopy } from "../lib/held-flow.ts";
import {
  flowsOverPlan,
  overPlanRefusal,
  overPlanSentence,
} from "../lib/plan-limit.ts";

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
// A flow's own page, its Set up and its Step 1 (Build 21, spec A6; the
// owner's AM4): where a flow is run, set up again, moved and archived.
const FLOW_PAGE_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/[subscriptionId]/page.tsx",
);
const SETUP_PAGE_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/[subscriptionId]/setup/page.tsx",
);
const SETUP_FORM_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/[subscriptionId]/setup/SetupForm.tsx",
);
const RUN_START_PATH = resolve(
  import.meta.dirname,
  "../app/account/flows/RunStart.tsx",
);
const PLATFORM_SERVER_PATH = resolve(
  import.meta.dirname,
  "../lib/platform-server.ts",
);
const ENTITLEMENTS_PATH = resolve(
  import.meta.dirname,
  "../lib/subscription-entitlements.ts",
);

/** The website's source files: app/, components/ and lib/. */
function sourceFiles() {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(
      resolve(import.meta.dirname, "..", directory),
      { withFileTypes: true },
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (path !== join("lib", "generated")) walk(path);
      } else if (/\.tsx?$/u.test(entry.name)) files.push(path);
    }
  };
  for (const directory of ["app", "components", "lib"]) walk(directory);
  return files;
}

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
const flowPage = readFileSync(FLOW_PAGE_PATH, "utf8");
const setupPage = readFileSync(SETUP_PAGE_PATH, "utf8");
const setupForm = readFileSync(SETUP_FORM_PATH, "utf8");
const runStart = readFileSync(RUN_START_PATH, "utf8");
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

test("the setup UI is generated from the pinned version's metadata (backend §12.1 #185)", () => {
  // One renderer for both manifest declarations — setup and run input (backend
  // ADR-0030) — in ManifestFields.tsx. Set up draws the version the
  // subscription PINS, which the platform checks a save against, not the
  // catalog's newest (§12.1 #185). ~~The move dialog drew the newest's~~
  // until Build 22: no client moves a flow (backend ADR-0041).
  assert.match(
    setupPage,
    /const setup: AutomationSetupField\[\] = subscription\.setup \?\? \[\];/,
  );
  assert.doesNotMatch(setupPage, /setup=\{entry\.setup\}/);
  assert.doesNotMatch(flowPage, /targetSetup|entry\.setup/);
  assert.doesNotMatch(setupForm, /SETUP_SECTIONS/);
  assert.match(setupForm, /<SetupFields\s+setup=\{setup\}/);
  assert.match(fields, /for \(const field of setup\)/);
  assert.match(fields, /currentGroup\?\.section === field\.section/);
  assert.match(
    fields,
    /groups\.push\(\{ section: field\.section, fields: \[field\] \}\)/,
  );
  // toggle is a checkbox, money a number, email an email; text and
  // resource-picker are text, because no contract lists resources to pick
  // from. A vendor choice (`connection`, backend ADR-0037) is drawn as its
  // vendors on Set up, and carried as it is everywhere else.
  assert.match(fields, /field\.control === "toggle"/);
  assert.match(
    fields,
    /field\.control === "money"\s*\?\s*"number"\s*:\s*field\.control === "email"\s*\?\s*"email"\s*:\s*"text"/,
  );
  assert.match(fields, /if \(field\.control === "connection"\) continue;/);
  assert.match(fields, /name=\{`\$\{prefix\}:\$\{field\.key\}`\}/);
  assert.match(fields, /prefix="config"/);
  assert.match(fields, /field\.defaultValue/);
  assert.match(fields, /field\.notifies/);
  // No help line under any setting (spec A6, B5; the session's S11).
  assert.doesNotMatch(fields, /field\.description|hint=/u);
  assert.match(actions, /export async function saveSetup/);
  assert.match(actions, /declaredValues\(formData, "config"\)/);
  assert.match(
    actions,
    /const body: UpdateSubscriptionRequest = turnOn\s*\?\s*\{ config, status: "live" \}\s*:\s*\{ config \};/,
  );
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
  // The schema's own block, to the next key at its indentation: a fixed window
  // of 400 characters stopped short of `RunStatus`'s enum once its description
  // grew (backend BUILD-PLAN 25.2.10).
  const end = spec.slice(start + 1).search(/\n {4}\S/u);
  const block = spec.slice(start, end < 0 ? undefined : start + 1 + end);
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
    /if \(entry\.status === "archived"\) continue;/,
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
  // form rendered from `Subscription.runInput`, which the platform also checks
  // — since Build 21 in Step 1 of the flow's page (spec A6).
  for (const ui of [actionsUi, runStart, flowPage]) {
    assert.doesNotMatch(
      ui,
      /Run now|runOpen|triggerRun|<textarea|JSON\.parse/u,
      "the retired raw-JSON dialog must not come back",
    );
  }
  assert.doesNotMatch(actions, /JSON\.parse/u, "no action accepts raw JSON");
  // Offered only when it can be honest: live, available, and declared.
  assert.match(
    runStart,
    /const canRun = live && available && runInput\.length > 0;/,
  );
  assert.match(runStart, /<RunInputFields\s+runInput=\{runInput\}/);
  // The pinned version's declaration, not the catalog's newest.
  assert.match(flowPage, /runInput=\{subscription\.runInput \?\? \[\]\}/);
  assert.match(fields, /prefix="input"/);
  // The run is created through the generated client, once per key, and the
  // person is taken to its page.
  assert.match(actions, /declaredValues\(formData, "input"\)/);
  // The key is the form's — the server's with the page, then a new one
  // whenever a value changes — so a resubmission after a lost answer cannot
  // start a second run.
  assert.match(runStart, /name="idempotencyKey" value=\{runKey\}/);
  assert.match(runStart, /onChange=\{newRunKey\}/);
  assert.match(runStart, /useState\(initialKey\)/);
  assert.match(flowPage, /initialKey=\{newIdempotencyKey\("run"\)\}/);
  assert.match(actions, /formData\.get\("idempotencyKey"\)/);
  assert.doesNotMatch(actions, /newIdempotencyKey\("run"\)/);
  assert.match(
    runStart,
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
  assert.match(actionsUi, /run\(\s*archiveSubscription,/);
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

test("a card lists every subscription it has, each under its own team (register F21)", () => {
  // A workspace may hold a duplicate from before one flow per workspace (the
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
  assert.match(page, /\{place\(subscription\)\}/u);
});

test("a flow is added with no team: the platform puts it in the team of its category — no picker, no team sent, no Create a team (backend ADR-0036; the owner, 2026-10-14)", () => {
  const addUi = read("app/account/flows/AddAutomation.tsx");
  // The body is the flow alone: the platform ignores a team now, so none is
  // ever sent, and nothing asks for one first.
  assert.match(
    actions,
    /const body: CreateSubscriptionRequest = \{ templateId \};/u,
  );
  const subscribe =
    /export async function subscribeToAutomation[\s\S]*?\n\}/u.exec(actions);
  assert.ok(subscribe, "subscribeToAutomation not found");
  assert.doesNotMatch(subscribe[0], /projectId/u);
  assert.doesNotMatch(addUi, /projectId|<select|scopes|hasTeam/u);
  // An add the platform could not make — a workspace or team it could not
  // find or make (404), its team service unanswered (502) — in the spec's
  // words (§3.A).
  assert.match(
    actions,
    /const ADD_REFUSED = "Could not add this flow\. Try again\.";/u,
  );
  assert.match(
    subscribe[0],
    /error instanceof PlatformServerError &&\s*\(error\.status === 404 \|\| error\.status === 502\)\s*\) \{\s*return \{ ok: false, error: ADD_REFUSED \};/u,
  );
  // Where a flow is: its team, by kind — the category's, when the team is
  // one this person cannot list — or, added before teams, the whole
  // workspace.
  assert.match(
    read("app/account/flows/place.ts"),
    /if \(!subscription\.projectId\) return "Whole workspace";\s*const kind =\s*teamKind\.get\(subscription\.projectId\) \?\?\s*catalog\.get\(subscription\.templateId\)\?\.category;\s*return kind \? `Team: \$\{kind\}` : "Team";/u,
  );
  // The removed words (spec §3.A): no source file says them.
  const removed =
    /Add to\b|Choose a team|Pick a team\.|Create a team first\.|Create a team|Ask to join a team first\.|See teams|An owner or admin creates the first team\./u;
  for (const path of sourceFiles()) {
    assert.doesNotMatch(read(path), removed, path);
  }
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

test("a held flow's card says Added ✓, going to it, offers no Add, and Add refuses a second copy in words before anything is sent (the owner's build 12, #9; register F87)", () => {
  // One rule, said once, for the page and the action.
  assert.match(page, /import \{ heldCopy \} from "@\/lib\/held-flow";/u);
  assert.match(actions, /import \{ heldCopy \} from "@\/lib\/held-flow";/u);
  // The card: held, "Added ✓" (spec §3.A) going to the flow's own row, which
  // says its team, and no Add.
  assert.match(
    page,
    /const held = heldCopy\(subscriptions, automation\.templateId\);/u,
  );
  assert.match(
    page,
    /\{held \? \(\s*<a\s+href=\{`#flow-\$\{held\.id\}`\}[^>]*>\s*Added ✓\s*<\/a>\s*\) : \(\s*<AddAutomation\b/u,
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

test("an archived flow's row offers Unarchive — its card's own Add, named for the flow, which goes to the team of its category — and, the flow held again, says Added ✓ instead, going to it (the owner's build 12, #4 and #9; register F87)", () => {
  const addUi = read("app/account/flows/AddAutomation.tsx");
  // One add path: unarchiving is adding afresh — the platform's archive stays
  // one-way (backend §12.1 #92) — so the row draws the card's own Add, whose
  // action and refusals are the card's, and no action of its own.
  assert.match(
    addUi,
    /^import \{ subscribeToAutomation \} from "\.\/actions";$/mu,
  );
  assert.doesNotMatch(actions, /export async function \w*unarchive/iu);
  // In its word: Unarchive, named for its flow.
  assert.match(
    addUi,
    /aria-label=\{unarchive \? `Unarchive \$\{name\}` : undefined\}/u,
  );
  assert.match(
    addUi,
    /\{unarchive\s*\?\s*pending\s*\?\s*"Unarchiving…"\s*:\s*"Unarchive"\s*:\s*pending\s*\?\s*"Adding…"\s*:\s*"Add"\}/u,
  );
  const rows =
    /\{archived\.map\(\(subscription\) => \{[\s\S]*?\n {12}\}\)\}/u.exec(page);
  assert.ok(rows, "the archived rows are not found");
  const [row] = rows;
  assert.match(
    row,
    /const entry = catalogEntry\.get\(subscription\.templateId\);/u,
  );
  assert.match(
    row,
    /const twin = heldCopy\(\s*subscriptions\.subscriptions,\s*subscription\.templateId,\s*\);/u,
  );
  const drawn =
    /\{!entry \? null : twin \? \(\s*<a\s+href=\{`#flow-\$\{twin\.id\}`\}[^>]*>\s*Added ✓\s*<\/a>\s*\) : \(\s*<AddAutomation\b([\s\S]*?)\/>\s*\)\}/u.exec(
      row,
    );
  assert.ok(drawn, "the row's Added or Unarchive is not drawn as decided");
  for (const prop of [
    /\bworkspaceId=\{workspaceId\}/u,
    /\btemplateId=\{subscription\.templateId\}/u,
    /\bname=\{name\}/u,
    /\bavailable=\{entry\.available\}/u,
    /\bunarchive\s*$/u,
  ]) {
    assert.match(drawn[1], prop);
  }
  assert.doesNotMatch(drawn[1], /scopes|hasTeam|canAdminister|canAskToJoin/u);
  // Where the archived copy was, by its team's kind, or the whole workspace.
  assert.match(row, /\{place\(subscription\)\}/u);
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
  const live = readFileSync(
    resolve(import.meta.dirname, "../app/account/runs/[runId]/RunLive.tsx"),
    "utf8",
  );
  assert.match(runPage, /<RunLive\b/u);
  assert.match(
    live,
    /const going = run\.status === "pending" \|\| run\.status === "running";/u,
  );
  assert.match(
    live,
    /\{going \? \(\s*<CancelRunButton runId=\{run\.id\} workspaceId=\{run\.workspaceId\} \/>/u,
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
  const today = readFileSync(
    resolve(import.meta.dirname, "../app/account/TodayTiles.tsx"),
    "utf8",
  );
  assert.doesNotMatch(home, /<dd className="text-\[var\(--text\)\]">0<\/dd>/u);
  // Today's counts are the platform's tally from the browser's midnight
  // (Build 22, W1), read in the browser; "—" until it answers, never 0.
  assert.match(home, /<TodayTiles workspaceId=\{home\.workspaceId\} \/>/u);
  assert.match(
    today,
    /platformApiJson<RunStats>\(\s*`\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}\/run-stats\?since=\$\{encodeURIComponent\(midnight\)\}`,/u,
  );
  assert.match(
    today,
    /const value = stats === null \? "—" : String\(stats\[tile\.count\]\);/u,
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
  return reasonsIn(spec.slice(start, start + end));
}

/**
 * The `details.reason` tokens one operation names anywhere — its description
 * and its responses' — for words keyed by reason whatever the status: since
 * backend 25.2.39, `completeUpload` names `measurement_busy` on its 429 alone.
 */
function operationReasons(operationId) {
  const start = spec.indexOf(`operationId: ${operationId}\n`);
  assert.ok(start > 0, `${operationId} is missing from the specification`);
  const rest = spec.slice(start);
  // The operation ends at the next method, the next path or the next top-level key.
  const end = rest.search(/\n(?: {0,2}\S| {4}(?:get|put|post|patch|delete):)/u);
  return reasonsIn(end < 0 ? rest : rest.slice(0, end));
}

function reasonsIn(text) {
  return [
    ...new Set(
      [
        // A reason is named on its own, or as `details.reason: <reason>`.
        ...text.matchAll(/`(?:details\.reason: )?([a-z]+(?:_[a-z]+)+)`/gu),
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
  const uploadRefusals = read("app/account/flows/upload-refusals.ts");
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
  assert.match(runStart, /disabled=\{pending \|\| uploading\}/u);
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
  // Every refusal of either upload step is said through the one function, which
  // names a measured file's numbers when the platform sends them (backend 25.2.28).
  assert.match(
    uploads,
    /const known = uploadRefusalMessage\(error\.details\?\.reason, error\.details\);/u,
  );
  if (available) {
    assert.deepEqual(
      refusalKeys(uploadRefusals, "UPLOAD_REFUSALS"),
      [
        ...operationReasons("openUpload"),
        ...operationReasons("completeUpload"),
      ].sort(),
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
    runStart,
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

test("no client moves a flow: the update sends no version and names no move refusal, and the platform's update names none of the move's reasons any more (Build 22, P4; backend ADR-0041; the owner's build 21 item 7)", () => {
  assert.doesNotMatch(
    actions,
    /templateVersion|moveSubscriptionVersion|moveWithConfiguration|MOVE_REFUSALS|settings-misfit/u,
  );
  assert.doesNotMatch(flowPage, /newer=|templateVersion < entry\.version/u);
  assert.doesNotMatch(actionsUi, /\bnewer\s*[=:?]|MoveVersionButton/u);
  assert.equal(
    existsSync(
      resolve(
        import.meta.dirname,
        "../app/account/flows/MoveVersionButton.tsx",
      ),
    ),
    false,
  );
  assert.doesNotMatch(actionsUi, /archive it and add it again/u);
  if (available) {
    // The refusals an update names now are Set up's, said by its own words.
    const reasons = specReasons("updateSubscription");
    for (const gone of [
      "approvals_pending",
      "runs_in_flight",
      "version_unavailable",
    ])
      assert.ok(!reasons.includes(gone), gone);
    // And the contract takes no version on an update.
    const update = spec.slice(
      spec.indexOf("operationId: updateSubscription\n"),
    );
    const body = update.slice(0, update.search(/\n {6}responses:/u));
    assert.doesNotMatch(body, /templateVersion:/u);
  }
});

test("a webhook address is offered for a webhook-started automation to an owner or admin only, and its secret is never kept (backend §12.1 #91, #109)", () => {
  const button = read("app/account/flows/WebhookAddressButton.tsx");
  const webhook = read("app/account/flows/webhook-actions.ts");
  assert.match(
    flowPage,
    /webhook=\{subscription\.triggerKind === "webhook" && canManage\}/u,
  );
  assert.match(flowPage, /const canManage = administers\(role\);/u);
  assert.match(actionsUi, /\{webhook \? \([\s\S]*?<WebhookAddressButton/u);
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
  // Issuing carries the dialog's key (backend §12.1 #240): the platform derives
  // the secret from it, so a retry is answered with the lost answer's secret.
  // One key per press still unanswered, spent once a secret is shown.
  assert.match(
    client,
    /platformServerJson<IssuedWebhookEndpoint>\(\s*`\$\{scope\(workspaceId\)\}\/subscriptions\/\$\{encodeURIComponent\(subscriptionId\)\}\/webhook`,\s*\{ method: "POST", idempotencyKey \},\s*\);/u,
  );
  assert.match(
    button,
    /const key = \(issueKey\.current \?\?= `webhook-secret-\$\{crypto\.randomUUID\(\)\}`\);/u,
  );
  assert.match(
    button,
    /if \(!result\.ok\) \{\s*setError\(result\.error\);\s*return;\s*\}\s*\/\/[^\n]*\n\s*issueKey\.current = null;\s*setIssued\(result\.issued\);/u,
  );
  assert.match(
    webhook,
    /if \(!\/\^\[A-Za-z0-9\._~:-\]\{16,128\}\$\/u\.test\(idempotencyKey\)\) \{/u,
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

test("over the plan's flow allowance, a run's start and the Flows page say so in the app's words (the owner's build 13 decision 7a3)", () => {
  assert.equal(
    overPlanSentence(2, 4),
    "Your plan allows 2 flows; this workspace has 4. No flow can start a run until you archive 2. Paused and draft flows count.",
  );
  assert.equal(
    overPlanSentence(1, 2),
    "Your plan allows 1 flow; this workspace has 2. No flow can start a run until you archive 1. Paused and draft flows count.",
  );
  // Over only when a ceiling is known and passed: within it, unlimited and unknown are not.
  assert.deepEqual(flowsOverPlan({ allowed: 2, live: 4 }), {
    allowed: 2,
    live: 4,
  });
  assert.equal(flowsOverPlan({ allowed: 2, live: 2 }), null);
  assert.equal(flowsOverPlan({ allowed: null, live: 40 }), null);
  assert.equal(flowsOverPlan(undefined), null);
  // The refusal's numbers when usable, never a made-up count.
  assert.equal(
    overPlanRefusal({ reason: "over_plan_limit", limit: 2, live: 4 }),
    overPlanSentence(2, 4),
  );
  for (const details of [
    { reason: "over_plan_limit" },
    { reason: "over_plan_limit", limit: "2", live: 4 },
    { reason: "over_plan_limit", limit: 4, live: 4 },
  ]) {
    assert.equal(
      overPlanRefusal(details),
      "This workspace has reached its current plan limit.",
    );
  }
  // Wired: a run's 403 through the subscribe path's two reasons, and the list's allowance.
  const actions = readFileSync("app/account/flows/actions.ts", "utf8");
  const start = actions.slice(
    actions.indexOf("export async function startRun"),
  );
  assert.match(
    start,
    /subscriptionEntitlementState\(\s*error\.status,\s*error\.details,?\s*\)/u,
  );
  assert.match(start, /error: overPlanRefusal\(error\.details\)/u);
  assert.match(
    start,
    /"Runs are unavailable while billing entitlements are not configured\."/u,
  );
  const page = readFileSync("app/account/flows/page.tsx", "utf8");
  assert.match(page, /flowsOverPlan\(subscriptions\.flowAllowance\)/u);
  assert.match(page, /overPlanSentence\(overPlan\.allowed, overPlan\.live\)/u);
});
