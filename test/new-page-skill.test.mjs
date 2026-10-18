import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * The new-page skill (.claude/skills/new-page/SKILL.md) is followed step by
 * step, so it names every file a new fixture spec joins, and its commit stages
 * each file its steps change: one left out turns `npm run verify` red after
 * the commit, or leaves a changed file behind it.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const skill = read(".claude/skills/new-page/SKILL.md");

test("the new-page skill adds a spec to the fixture runner's list and to that list's copy in verify-gate's test", () => {
  // The copy is real: verify-gate's test holds the runner's specs by name and
  // fails until the two lists agree.
  const verifyGate = read("test/verify-gate.test.mjs");
  assert.match(verifyGate, /"\.\.\/scripts\/run-browser-fixtures\.mjs"/u);
  assert.match(verifyGate, /assert\.deepEqual\(listed, \[\s*"e2e\//u);
  const step = /^5\. The spec:[\s\S]*?(?=^6\. )/mu.exec(skill)?.[0] ?? "";
  assert.match(step, /`scripts\/run-browser-fixtures\.mjs`/u);
  assert.match(step, /`test\/verify-gate\.test\.mjs`/u);
});

test("the new-page skill's commit stages every file its steps change", () => {
  const add = /^ {3}git add [\s\S]*?&& git commit$/mu.exec(skill)?.[0];
  assert.ok(add, "SKILL.md has no git add … && git commit command");
  const { facts } = JSON.parse(read("docs/docs-map.json"));
  const specCount = facts.find((fact) => fact.key === "fixture-specs").home;
  for (const path of [
    '"app$ROUTE/page.tsx"',
    '"test/$SLUG.test.mjs"',
    '"e2e/$SLUG.spec.ts"',
    "scripts/run-browser-fixtures.mjs",
    "test/verify-gate.test.mjs",
    "docs/MAP.md",
    specCount,
    "$ALSO",
  ]) {
    assert.ok(add.includes(path), `the commit does not stage ${path}`);
  }
  // The files only some pages change are named where ALSO is set.
  const also = /^ {3}# ALSO:.*\n {3}# (.*)$/mu.exec(skill)?.[1] ?? "";
  for (const path of [
    "components/dashboard/DashboardNav.tsx",
    "e2e/fixtures/public-edge.ts",
    "docs/ARCHITECTURE.md",
  ]) {
    assert.ok(also.split(" ").includes(path), `ALSO does not name ${path}`);
  }
});
