import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

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
  "../../snoopy-backend/docs/openapi/automations.yaml",
);
const CLIENT_PATH = resolve(import.meta.dirname, "../lib/automations.ts");
const GENERATED_PATH = resolve(
  import.meta.dirname,
  "../lib/generated/platform-contracts/automations.d.ts",
);
const ACTIONS_PATH = resolve(
  import.meta.dirname,
  "../app/account/automations/actions.ts",
);
const ACTIONS_UI_PATH = resolve(
  import.meta.dirname,
  "../app/account/automations/AutomationActions.tsx",
);
const PAGE_PATH = resolve(
  import.meta.dirname,
  "../app/account/automations/page.tsx",
);
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
    ["CreateRunRequest", "createRun"],
    ["CreateRunResponse", "createRun"],
    ["DecideApprovalRequest", "decideApproval"],
    ["DecideApprovalResponse", "decideApproval"],
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
  assert.match(page, /setup=\{automation\.setup\}/);
  assert.doesNotMatch(actionsUi, /SETUP_SECTIONS/);
  assert.match(actionsUi, /for \(const field of setup\)/);
  assert.match(actionsUi, /currentGroup\?\.section === field\.section/);
  assert.match(
    actionsUi,
    /groups\.push\(\{ section: field\.section, fields: \[field\] \}\)/,
  );
  for (const control of ["toggle", "money", "text", "resource-picker"]) {
    assert.match(actionsUi, new RegExp(`"${control}"`));
  }
  assert.match(actionsUi, /name=\{`config:\$\{field\.key\}`\}/);
  assert.match(actionsUi, /field\.defaultValue/);
  assert.match(actionsUi, /field\.notifies/);
  assert.match(actions, /saveSubscriptionConfiguration/);
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

test("automation actions consume generated operation response types", () => {
  for (const type of [
    "CreateSubscriptionResponse",
    "UpdateSubscriptionResponse",
    "CreateRunResponse",
    "DecideApprovalResponse",
  ]) {
    assert.match(
      actions,
      new RegExp(`platformServerJson<${type}>`),
      `automation action must use ${type}`,
    );
  }
  for (const type of [
    "CreateSubscriptionRequest",
    "UpdateSubscriptionRequest",
    "CreateRunRequest",
    "DecideApprovalRequest",
  ]) {
    assert.match(
      actions,
      new RegExp(`const body: ${type} =`),
      `automation action must use ${type}`,
    );
  }
  assert.doesNotMatch(
    actions,
    /platformServerJson<\{\s*(?:subscription|run|approval):/,
    "automation actions must not recreate generated response shapes",
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
