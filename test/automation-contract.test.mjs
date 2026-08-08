import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

/**
 * The website's automation types match the backend's specification.
 *
 * `lib/automations.ts` declares the shapes every automation screen renders. They
 * are not generated, so nothing otherwise stops them drifting from the server —
 * and a drifted field does not throw, it renders blank, which is the failure
 * mode worth catching mechanically.
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

const available = existsSync(SPEC_PATH);
const spec = available ? readFileSync(SPEC_PATH, "utf8") : "";
const client = readFileSync(CLIENT_PATH, "utf8");

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

/** Property names the website declares for one exported type. */
function declaredFields(typeName) {
  const start = client.indexOf(`export type ${typeName} = {`);
  assert.ok(start > 0, `${typeName} is missing from lib/automations.ts`);
  const body = client.slice(start, client.indexOf("\n};", start));
  return [...body.matchAll(/^\s{2}(\w+)\??:/gmu)].map((match) => match[1]);
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

/** Union members the website declares for one exported type alias. */
function clientUnion(typeName) {
  const start = client.indexOf(`export type ${typeName} =`);
  assert.ok(start > 0, `${typeName} is missing from lib/automations.ts`);
  const body = client.slice(start, client.indexOf(";", start));
  return [...body.matchAll(/"([a-z-]+)"/gu)].map((match) => match[1]).sort();
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
      const declared = new Set(declaredFields(type));
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
      clientUnion("SubscriptionStatus"),
      specEnum("SubscriptionStatus"),
    );
    assert.deepEqual(clientUnion("RunStatus"), specEnum("RunStatus"));
    assert.deepEqual(clientUnion("ApprovalStatus"), specEnum("ApprovalStatus"));
    assert.deepEqual(clientUnion("RunOrigin"), specEnum("RunOrigin"));
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
    for (const status of clientUnion(type)) {
      assert.ok(
        mapped.has(status),
        `${type} member "${status}" has no tone in StatusPill`,
      );
    }
  }
});

test("the website never sends a field the server refuses", () => {
  const actions = readFileSync(
    resolve(import.meta.dirname, "../app/account/automations/actions.ts"),
    "utf8",
  );
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
