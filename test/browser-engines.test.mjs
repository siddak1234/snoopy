import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

/**
 * Where each browser engine runs — the owner's decision of 2026-10-14
 * (register F104): Chromium and Firefox everywhere; WebKit in GitHub CI on
 * Linux, where it passes, and on this machine only when asked for with
 * AUTOM8X_WEBKIT=1. On the owner's Mac Playwright's WebKit fails dozens of the
 * fixture suite's tests even on unchanged main, while CI's WebKit legs pass.
 *
 * What Playwright would run is read from Playwright itself (`--list`) under
 * each environment, not from playwright.config.ts's text: the text names all
 * three engines whichever of them a run gets.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
// A file's lines but its comments (`#` and `//`), so a comment may name a
// switch while code that sets one is still seen.
const code = (path) =>
  read(path)
    .split("\n")
    .filter((line) => !/^\s*(?:#|\/\/)/u.test(line))
    .join("\n");
const ALL = ["chromium", "firefox", "webkit"];
const HERE = ["chromium", "firefox"];
const NOTICE =
  "Browser engines here: Chromium and Firefox. WebKit runs in GitHub CI on Linux, where it passes; AUTOM8X_WEBKIT=1 runs it here too.";

// The environment a run starts from, with neither switch set: these tests run
// in CI's gates job too, where GITHUB_ACTIONS is "true".
const bare = { ...process.env };
delete bare.GITHUB_ACTIONS;
delete bare.AUTOM8X_WEBKIT;
delete bare.TEST_WORKER_INDEX;

/** Playwright's own listing of one spec under `extra`, and the engines in it. */
function listing(extra, ...args) {
  const run = spawnSync(
    process.execPath,
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "e2e/accessibility.spec.ts",
      "--list",
      ...args,
    ],
    { cwd: root, encoding: "utf8", env: { ...bare, ...extra } },
  );
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  const engines = [
    ...new Set(
      [...output.matchAll(/^\s+\[([a-z]+)\] › /gmu)].map((match) => match[1]),
    ),
  ].sort();
  const notices = output.split("\n").filter((line) => line === NOTICE).length;
  return { status: run.status, output, engines, notices };
}

/** ci.yml's jobs, split as the structure tests split them. */
function ciJob(id) {
  return read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith(`${id}:`));
}

test("CI runs WebKit: a fixture leg for each of the three engines on Linux, the browser job on every project, and all-green needs both jobs (register F104)", () => {
  const fixtures = ciJob("fixtures");
  assert.ok(fixtures, "CI has no fixtures job");
  const matrix = /^ {8}project: \[([^\]]+)\]$/mu.exec(fixtures);
  assert.ok(matrix, "the fixtures job has no project matrix");
  assert.deepEqual(
    matrix[1]
      .split(",")
      .map((name) => name.trim())
      .sort(),
    ALL,
    "every engine has its own fixture leg in CI",
  );
  assert.match(
    fixtures,
    /^ {6}- run: npm run test:browser:fixtures -- --project=\$\{\{ matrix\.project \}\}$/mu,
  );

  const browser = ciJob("browser");
  assert.ok(browser, "CI has no browser job");
  // No --project: the browser job runs every project GitHub's runner has.
  assert.match(browser, /^ {6}- run: npm run test:browser$/mu);

  // On GitHub's Linux runners, where WebKit passes.
  for (const job of [fixtures, browser]) {
    assert.match(job, /^ {4}runs-on: ubuntu-[\d.]+$/mu, job.split("\n")[0]);
  }

  // Nothing in CI turns the switch off: GITHUB_ACTIONS is the runner's own.
  assert.doesNotMatch(
    code(".github/workflows/ci.yml"),
    /GITHUB_ACTIONS|AUTOM8X_WEBKIT/u,
  );

  const allGreen = ciJob("all-green");
  assert.ok(allGreen, "CI has no all-green job");
  const needs = /^ {4}needs:\n((?: {6}- [\w-]+\n)+)/mu.exec(allGreen);
  assert.ok(needs, "all-green names no needs list");
  const needed = [...needs[1].matchAll(/- ([\w-]+)/gu)].map((m) => m[1]);
  for (const id of ["browser", "fixtures"]) {
    assert.ok(needed.includes(id), `all-green does not need ${id}`);
  }
});

test("on a GitHub runner Playwright has all three engines, and the WebKit leg's own --project=webkit finds its project (register F104)", () => {
  // CI's legs and browser job run with GITHUB_ACTIONS=true and CI=true — read
  // from the Playwright container's environment in PR #49's WebKit leg.
  const ci = listing({ GITHUB_ACTIONS: "true", CI: "true" });
  assert.equal(ci.status, 0, ci.output);
  assert.deepEqual(ci.engines, ALL);
  assert.equal(ci.notices, 0, "a GitHub run says nothing about WebKit");

  const leg = listing(
    { GITHUB_ACTIONS: "true", CI: "true" },
    "--project=webkit",
  );
  assert.equal(leg.status, 0, leg.output);
  assert.deepEqual(leg.engines, ["webkit"]);

  // Every leg the matrix names is a project Playwright has there.
  const matrix = /^ {8}project: \[([^\]]+)\]$/mu.exec(ciJob("fixtures"));
  assert.ok(matrix, "the fixtures job has no project matrix");
  assert.deepEqual(
    matrix[1]
      .split(",")
      .map((name) => name.trim())
      .sort(),
    ci.engines,
  );
});

test("a run on this machine — CI=1 as the gates set it, or any CI, or none — runs Chromium and Firefox and says once that WebKit is CI's (register F104)", () => {
  // `npm run verify` and the change audit set CI=1 for test:browser, and the
  // fixture runner sets it for itself; a shell may hold CI=true. None of them
  // is GitHub.
  for (const extra of [
    { CI: "1" },
    { CI: "true" },
    {},
    // Only "1" opts in, and only "true" is GitHub's.
    { CI: "1", AUTOM8X_WEBKIT: "true" },
    { CI: "1", AUTOM8X_WEBKIT: "0" },
    { CI: "1", GITHUB_ACTIONS: "1" },
    { CI: "1", GITHUB_ACTIONS: "false" },
  ]) {
    const local = listing(extra);
    const label = JSON.stringify(extra);
    assert.equal(local.status, 0, `${label}\n${local.output}`);
    assert.deepEqual(local.engines, HERE, label);
    assert.equal(local.notices, 1, `${label} says once that WebKit is CI's`);
  }

  // Asked for by name without the opt-in, WebKit is refused out loud, under
  // the line that says how to get it — never a green run of nothing.
  const asked = listing({ CI: "1" }, "--project=webkit");
  assert.notEqual(asked.status, 0);
  assert.match(asked.output, /Project\(s\) "webkit" not found/u);
  assert.equal(asked.notices, 1);

  // Each worker loads the config again with TEST_WORKER_INDEX set; only the
  // runner says it, so a run says it once, not once per worker.
  const worker = listing({ CI: "1", TEST_WORKER_INDEX: "0" });
  assert.deepEqual(worker.engines, HERE);
  assert.equal(worker.notices, 0);

  // No local gate sets either switch for itself.
  for (const runner of [
    "scripts/verify.mjs",
    "scripts/audit/run-gates.mjs",
    "scripts/run-browser-fixtures.mjs",
  ]) {
    assert.doesNotMatch(code(runner), /GITHUB_ACTIONS|AUTOM8X_WEBKIT/u, runner);
  }
});

test("AUTOM8X_WEBKIT=1 brings WebKit back on this machine, on purpose (register F104)", () => {
  for (const extra of [
    { AUTOM8X_WEBKIT: "1" },
    { CI: "1", AUTOM8X_WEBKIT: "1" },
  ]) {
    const opted = listing(extra);
    const label = JSON.stringify(extra);
    assert.equal(opted.status, 0, `${label}\n${opted.output}`);
    assert.deepEqual(opted.engines, ALL, label);
    assert.equal(opted.notices, 0, label);
  }
  const leg = listing({ CI: "1", AUTOM8X_WEBKIT: "1" }, "--project=webkit");
  assert.equal(leg.status, 0, leg.output);
  assert.deepEqual(leg.engines, ["webkit"]);
});
