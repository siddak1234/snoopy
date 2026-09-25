import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

/**
 * `npm run verify` is the website's one-command gate (BUILD-PLAN 20.4.1). These
 * assertions keep it honest about the two things a gate quietly gets wrong:
 * drifting from the change audit's list, and going red for a reason that is not
 * this tree's.
 */

const verify = readFileSync(
  resolve(import.meta.dirname, "../scripts/verify.mjs"),
  "utf8",
);
const recordPass = readFileSync(
  resolve(import.meta.dirname, "../scripts/audit/record-pass.mjs"),
  "utf8",
);

test("verify runs every gate the change audit records", () => {
  // record-pass.mjs is the marker writer, and its FULL_GATES is the list a PASS
  // is verified against. A gate present there and absent here would let
  // "verify green" mean less than "audit green".
  const declared = /const FULL_GATES = \[([^\]]+)\]/u.exec(recordPass);
  assert.ok(
    declared,
    "record-pass.mjs no longer declares FULL_GATES as a literal; this test is blind",
  );
  const gates = [...declared[1].matchAll(/"([^"]+)"/gu)].map((m) => m[1]);
  assert.ok(gates.length >= 7, `FULL_GATES yielded ${gates.length} names`);
  for (const gate of gates) {
    assert.match(
      verify,
      new RegExp(`name: "${gate}"`, "u"),
      `verify.mjs does not run the audited gate ${gate}`,
    );
  }
});

test("verify also runs format:check (CI's Lint job does; the audit runner does not) and verify:platform-contracts (neither does)", () => {
  for (const gate of ["format:check", "verify:platform-contracts"]) {
    assert.match(verify, new RegExp(`name: "${gate}"`, "u"));
  }
});

test("verify skips the sibling-dependent gate out loud rather than failing on a missing checkout", () => {
  // generate-platform-contracts.mjs throws on the FIRST missing input, so the
  // skip must check all three, and it must say why (§12.2 #78's class).
  for (const input of [
    "docs/openapi.yaml",
    "docs/openapi/automations.yaml",
    "docs/openapi/connections.yaml",
  ]) {
    assert.ok(
      verify.includes(`"${input}"`),
      `verify.mjs does not check ${input}`,
    );
  }
  assert.match(verify, /SKIP \$\{gate\.name\}/u);
  assert.match(
    verify,
    /accepted dependency \(§12\.2 #78\)/u,
    "the SKIP line itself must say why the dependency is accepted",
  );
});

test("verify pins the build origin, defeats server reuse, and asserts the gateway rewrite", () => {
  assert.match(verify, /name: "build",[\s\S]{0,120}BACKEND_API_ORIGIN/u);
  assert.match(verify, /name: "test:browser",[\s\S]{0,240}CI: "1"/u);
  assert.match(verify, /name: "test:browser",[\s\S]{0,240}BACKEND_API_ORIGIN/u);
  assert.match(verify, /routes-manifest\.json/u);
  assert.match(verify, /startsWith\("\/api\/platform"\)/u);
});

test("verify emits the facts file only after the last gate", () => {
  const lastGate = verify.lastIndexOf('name: "test:browser:fixtures"');
  const emit = verify.indexOf("writeRepoFacts(");
  assert.ok(
    lastGate > 0 && emit > lastGate,
    "facts must be emitted after every gate ran",
  );
  assert.match(
    verify,
    /process\.exit\(exit\)/u,
    "a red gate must stop the run before any emission",
  );
  // A run that skipped the sibling gate is green for what ran and emits
  // nothing: the file must not be indistinguishable from a full run's.
  const guard = verify.indexOf("facts NOT emitted");
  assert.ok(
    guard > 0 && guard < emit,
    "a run that skipped a gate must refuse to emit before the emission",
  );
});
