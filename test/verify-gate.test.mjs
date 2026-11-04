import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { preflight } from "../scripts/audit/preflight.mjs";

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
const runGates = readFileSync(
  resolve(import.meta.dirname, "../scripts/audit/run-gates.mjs"),
  "utf8",
);
const shared = readFileSync(
  resolve(import.meta.dirname, "../scripts/audit/preflight.mjs"),
  "utf8",
);

/** The gate names a runner's list declares, in order. */
function gateNames(source, from, to) {
  const block = source.slice(source.indexOf(from), source.indexOf(to));
  return [...block.matchAll(/name: "([^"]+)"/gu)].map((match) => match[1]);
}

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

test("verify never skips a gate: verify:platform-contracts reads the committed copy when there is no sibling checkout (Round 21 hardening, W1)", () => {
  // It was skipped out loud with no sibling (§12.2 #78); the copy
  // (lib/generated/snoopy-backend) makes it run everywhere.
  assert.doesNotMatch(verify, /\bskip\b|SKIP/u);
  assert.match(verify, /\{ name: "verify:platform-contracts" \}/u);
});

test("verify pins the build origin, defeats server reuse, and asserts the gateway rewrite", () => {
  assert.match(verify, /name: "build",[\s\S]{0,120}BACKEND_API_ORIGIN/u);
  assert.match(verify, /name: "test:browser",[\s\S]{0,240}CI: "1"/u);
  assert.match(verify, /name: "test:browser",[\s\S]{0,240}BACKEND_API_ORIGIN/u);
  assert.match(
    verify,
    /name: "build",[\s\S]{0,160}after: \(\) => assertPlatformRewrite\(root\)/u,
  );
  assert.match(shared, /routes-manifest\.json/u);
  assert.match(shared, /startsWith\("\/api\/platform"\)/u);
});

test("verify and the change audit share one preflight, one lock and one rewrite check (register F24)", () => {
  assert.match(
    verify,
    /import \{\s*assertNoSkippedBrowserTests,\s*assertNoSkippedTests,\s*assertPlatformRewrite,\s*preflight,\s*\} from "\.\/audit\/preflight\.mjs";/u,
  );
  assert.match(
    runGates,
    /import \{\s*assertNoSkippedBrowserTests,\s*assertNoSkippedTests,\s*assertPlatformRewrite,\s*preflight,\s*\} from "\.\/preflight\.mjs";/u,
  );
  for (const [name, source] of [
    ["verify.mjs", verify],
    ["run-gates.mjs", runGates],
  ]) {
    // Awaited: the port check binds, which is asynchronous, and a runner that
    // did not wait would start its gates before a refusal arrived.
    assert.match(source, /await preflight\(\{ root, fail \}\);/u, name);
    // No private copy of what the module holds.
    assert.doesNotMatch(
      source,
      /"\* 2\.\*"/u,
      `${name} checks conflict copies itself`,
    );
    assert.doesNotMatch(source, /lsof/u, `${name} checks listeners itself`);
    assert.doesNotMatch(
      source,
      /lockPath|process\.kill\(/u,
      `${name} takes a lock itself`,
    );
    assert.doesNotMatch(source, /function assertPlatformRewrite/u, name);
  }
});

test("verify and the change audit fail on a skipped or todo contract test and on a skipped browser test, as CI does (Round 21 hardening, W-5)", async () => {
  // Wired to the gates they read: test:contracts's TAP, handed back, and the
  // browser suite's JSON report after test:browser. Each runner passes a
  // gate's stdout to its check.
  assert.match(
    verify,
    /name: "test:contracts",\s*capture: true,\s*after: \(stdout\) => assertNoSkippedTests\(stdout\),/u,
  );
  assert.match(
    verify,
    /stdio: gate\.capture \? \["inherit", "pipe", "inherit"\] : "inherit",/u,
  );
  assert.match(
    runGates,
    /name: "test:contracts",\s*command: \["npm", "run", "test:contracts"\],\s*after: \(stdout\) => assertNoSkippedTests\(stdout\),/u,
  );
  for (const [name, source] of [
    ["verify.mjs", verify],
    ["run-gates.mjs", runGates],
  ]) {
    assert.match(
      source,
      /name: "test:browser",[\s\S]{0,320}after: \(\) => assertNoSkippedBrowserTests\(root\),/u,
      name,
    );
    assert.match(source, /gate\.after\(run\.stdout \?\? ""\);/u, name);
  }

  const { assertNoSkippedTests, assertNoSkippedBrowserTests } =
    await import("../scripts/audit/preflight.mjs");
  const tap = (skipped, todo) =>
    `ok 1 - a\n1..1\n# tests 3\n# pass 3\n# fail 0\n# skipped ${skipped}\n# todo ${todo}\n`;
  assert.doesNotThrow(() => assertNoSkippedTests(tap(0, 0)));
  assert.throws(() => assertNoSkippedTests(tap(1, 0)), /skipped 1/u);
  assert.throws(() => assertNoSkippedTests(tap(0, 2)), /todo 2/u);
  assert.throws(() => assertNoSkippedTests(tap(10, 0)), /skipped 10/u);

  // Over the real command: package.json's test:contracts on a file with one
  // skipped test prints the TAP the check reads.
  const dir = mkdtempSync(join(tmpdir(), "verify-skips-"));
  try {
    const spec = join(dir, "one.test.mjs");
    writeFileSync(
      spec,
      'import { test } from "node:test";\ntest("runs", () => {});\ntest("skips", { skip: true }, () => {});\n',
    );
    const command = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
    ).scripts["test:contracts"].replace("test/*.test.mjs", spec);
    // NODE_TEST_CONTEXT would make the child report to this run.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const real = spawnSync("sh", ["-c", command], { env, encoding: "utf8" });
    assert.throws(() => assertNoSkippedTests(real.stdout), /skipped 1/u);

    // The browser check reads <root>/test-results/playwright-report.json
    // with this repository's script: red on a skip and with no report.
    mkdirSync(join(dir, "scripts"));
    writeFileSync(
      join(dir, "scripts/no-skipped-browser-tests.mjs"),
      readFileSync(
        resolve(import.meta.dirname, "../scripts/no-skipped-browser-tests.mjs"),
      ),
    );
    const report = (stats) => {
      mkdirSync(join(dir, "test-results"), { recursive: true });
      writeFileSync(
        join(dir, "test-results/playwright-report.json"),
        JSON.stringify({ stats }),
      );
    };
    assert.throws(() => assertNoSkippedBrowserTests(dir), /no report/u);
    const clean = { expected: 4, skipped: 0, unexpected: 0, flaky: 0 };
    report(clean);
    assert.doesNotThrow(() => assertNoSkippedBrowserTests(dir));
    report({ ...clean, skipped: 1 });
    assert.throws(() => assertNoSkippedBrowserTests(dir), /did not run/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the lock is taken atomically, and an empty or garbled lock is never live (register F25)", () => {
  assert.match(
    shared,
    /writeFileSync\(lockPath, String\(process\.pid\), \{ flag: "wx" \}\)/u,
  );
  assert.match(shared, /Number\.isInteger\(pid\) && pid > 0/u);
  assert.doesNotMatch(
    shared,
    /existsSync\(lockPath\)/u,
    "check-then-write is the race F25 names",
  );
});

/** A listener on `host`, on a port the kernel picks; null where `host` has no address family here. */
function plant(host) {
  return new Promise((settle, reject) => {
    const server = createServer();
    server.once("error", (error) =>
      ["EAFNOSUPPORT", "EADDRNOTAVAIL"].includes(error.code)
        ? settle(null)
        : reject(error),
    );
    server.listen(0, host, () => settle(server));
  });
}

test("the preflight refuses a port a server holds, whatever its process is called (register F61)", async () => {
  // lsof 4.95 lists no socket for the process Next renames `next-server
  // (v16.3.3)`, so a preflight that asked lsof let a live standalone server on
  // 3001 through. A bind is answered by the kernel, whoever holds the port. The
  // kernel picks these ports, so the servers' own 3001 and 3443 are untouched.
  const root = mkdtempSync(join(tmpdir(), "autom8x-preflight-"));
  const refuse = (message) => {
    throw new Error(message);
  };
  try {
    // Each address a stale server could hold: the gates' own 127.0.0.1, a
    // standalone server.js's 0.0.0.0, and `next dev`'s `::` (where there is
    // IPv6 to hold it).
    for (const host of ["127.0.0.1", "0.0.0.0", "::"]) {
      const server = await plant(host);
      if (!server) continue;
      const { port } = server.address();
      try {
        await assert.rejects(
          async () => preflight({ root, fail: refuse, ports: [port] }),
          new RegExp(`port ${port}\\b`, "u"),
          `a server on ${host}:${port} was not refused`,
        );
      } finally {
        await new Promise((closed) => server.close(closed));
      }
    }
    // A question, not a refusal of everything: a free port passes, and the
    // lock is taken as before.
    const freed = await plant("127.0.0.1");
    const { port } = freed.address();
    await new Promise((closed) => freed.close(closed));
    await preflight({ root, fail: refuse, ports: [port] });
    assert.equal(
      readFileSync(join(root, ".git/autom8x-audit/lock"), "utf8"),
      String(process.pid),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("the preflight takes the lock before it asks about a port, and a refused port gives the lock back", async () => {
  // Asking about a port binds it. Asked while another run holds the lock, that
  // bind could take the port its server is about to listen on, so a run that
  // cannot have the lock must be refused before it binds anything.
  const root = mkdtempSync(join(tmpdir(), "autom8x-preflight-order-"));
  const lock = join(root, ".git/autom8x-audit/lock");
  const refuse = (message) => {
    throw new Error(message);
  };
  const server = await plant("127.0.0.1");
  const { port } = server.address();
  try {
    // Another run holds the lock (a live pid: this one).
    mkdirSync(join(root, ".git/autom8x-audit"), { recursive: true });
    writeFileSync(lock, String(process.pid));
    await assert.rejects(
      async () => preflight({ root, fail: refuse, ports: [port] }),
      /another verify is running/u,
      "the port was asked about while another run held the lock",
    );
    // Free, the lock is taken — and given back when the port is refused, so
    // a refusal leaves nothing behind for the next run to trip on.
    rmSync(lock);
    await assert.rejects(
      async () => preflight({ root, fail: refuse, ports: [port] }),
      new RegExp(`port ${port}\\b`, "u"),
    );
    assert.equal(existsSync(lock), false, "a refused port kept the lock");
  } finally {
    await new Promise((closed) => server.close(closed));
    rmSync(root, { recursive: true, force: true });
  }
});

test("the no-backend probe stops at once when its server is killed by a signal, and never waits for an exit already gone (register F62)", async () => {
  // A child killed by a signal has `exitCode` null: a probe that asked only
  // that polled for a minute, then awaited an "exit" event that had fired.
  // Here `next start` is replaced, through the builtin module's own exports,
  // by a process that kills itself.
  const directory = mkdtempSync(join(tmpdir(), "autom8x-probe-"));
  const preload = join(directory, "killed-server.mjs");
  writeFileSync(
    preload,
    [
      'import childProcess from "node:child_process";',
      'import { syncBuiltinESMExports } from "node:module";',
      "const spawn = childProcess.spawn;",
      "childProcess.spawn = () =>",
      '  spawn(process.execPath, ["-e", "process.kill(process.pid, \'SIGKILL\')"], {',
      '    stdio: "ignore",',
      "  });",
      "syncBuiltinESMExports();",
    ].join("\n"),
  );
  try {
    const probe = spawn(
      process.execPath,
      [
        "--import",
        pathToFileURL(preload).href,
        resolve(import.meta.dirname, "../scripts/probe-no-backend.mjs"),
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    probe.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => probe.kill("SIGKILL"), 20_000);
    const [code, signal] = await once(probe, "exit");
    clearTimeout(timer);
    assert.equal(signal, null, "the probe hung and was killed after 20s");
    assert.equal(code, 1, stderr);
    assert.match(stderr, /next start exited early/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the change audit runs verify's gates, in verify's order, and the marker requires them all (register F15)", () => {
  const verifyGates = gateNames(
    verify,
    "const gates = [",
    "console.log(`verify: node",
  );
  const auditGates = gateNames(
    runGates,
    "const fullGates = [",
    "const docsGates = [",
  );
  assert.deepEqual(auditGates, verifyGates);
  const declared = /const FULL_GATES = \[([^\]]+)\]/u.exec(recordPass);
  assert.ok(
    declared,
    "record-pass.mjs no longer declares FULL_GATES as a literal",
  );
  assert.deepEqual(
    [...declared[1].matchAll(/"([^"]+)"/gu)].map((match) => match[1]),
    auditGates,
  );
});

test("D: verify and both change-audit tiers run the docs check and the map's staleness check, right after format:check in verify's order", () => {
  // docs/docs-map.json says which doc each area's change must update, and
  // docs/MAP.md is generated from the tree (AGENTS.md "Docs always updated").
  const verifyGates = gateNames(
    verify,
    "const gates = [",
    "console.log(`verify: node",
  );
  assert.deepEqual(verifyGates.slice(0, 3), [
    "format:check",
    "check:docs",
    "map",
  ]);
  assert.match(verify, /name: "map", args: \["--", "--check"\]/u);
  assert.match(
    verify,
    /\["run", gate\.name, \.\.\.\(gate\.args \?\? \[\]\)\]/u,
  );
  for (const [from, to] of [
    ["const fullGates = [", "const docsGates = ["],
    ["const docsGates = [", "const gates = mode"],
  ]) {
    const block = runGates.slice(runGates.indexOf(from), runGates.indexOf(to));
    assert.match(
      block,
      /name: "check:docs", command: \["npm", "run", "check:docs"\]/u,
      `${from} runs no docs check`,
    );
    assert.match(
      block,
      /name: "map", command: \["npm", "run", "map", "--", "--check"\]/u,
      `${from} runs no map check`,
    );
  }
});

test("a docs-only change audit runs the gates its marker requires, the document check among them (register F66)", () => {
  // run-gates.mjs runs `docsGates` for a docs-only change; record-pass.mjs
  // refuses a docs-only PASS without every one of DOCS_GATES. Two lists apart
  // make a marker that cannot be earned, or one earned without the check.
  const runner = gateNames(
    runGates,
    "const docsGates = [",
    "const gates = mode",
  );
  const declared = /const DOCS_GATES = \[([^\]]+)\]/u.exec(recordPass);
  assert.ok(
    declared,
    "record-pass.mjs no longer declares DOCS_GATES as a literal",
  );
  const marker = [...declared[1].matchAll(/"([^"]+)"/gu)].map(
    (match) => match[1],
  );
  assert.deepEqual([...runner].sort(), [...marker].sort());
  assert.ok(
    runner.includes("doc-references"),
    "a docs-only audit runs no document check",
  );
  const block = runGates.slice(
    runGates.indexOf("const docsGates = ["),
    runGates.indexOf("const gates = mode"),
  );
  assert.match(
    block,
    /name: "doc-references",\s*command: \["node", "scripts\/audit-doc-references\.mjs"\]/u,
    "doc-references does not run the document check",
  );
});

test("the browser fixture run passes every spec that needs the fixture Edge, and no other", () => {
  // scripts/run-browser-fixtures.mjs names its specs; one left out is a suite
  // the gate reports green without having run (e2e/account-surfaces.spec.ts,
  // Round 15).
  const runner = readFileSync(
    resolve(import.meta.dirname, "../scripts/run-browser-fixtures.mjs"),
    "utf8",
  );
  const block = runner.slice(
    runner.indexOf('"node_modules/@playwright/test/cli.js"'),
    runner.indexOf('"--workers=1"'),
  );
  const listed = [...block.matchAll(/"(e2e\/[^"]+\.spec\.ts)"/gu)].map(
    (match) => match[1],
  );
  assert.deepEqual(listed, [
    "e2e/accessibility.spec.ts",
    "e2e/public-edge-fixture.spec.ts",
    "e2e/account-surfaces.spec.ts",
    "e2e/dialogs.spec.ts",
    "e2e/flow-items.spec.ts",
    "e2e/health-data.spec.ts",
    "e2e/ehr-connect.spec.ts",
    "e2e/accessibility-authenticated.spec.ts",
    "e2e/keyboard-journey.spec.ts",
  ]);
  // And derived: every spec that reads the fixture's switch is one of them,
  // and so is e2e/accessibility.spec.ts, whose /login scan needs the
  // fixture's provider list and whose other scans run in both.
  const e2e = resolve(import.meta.dirname, "../e2e");
  const needFixture = readdirSync(e2e)
    .filter((name) => name.endsWith(".spec.ts"))
    .filter((name) =>
      readFileSync(join(e2e, name), "utf8").includes("E2E_PUBLIC_EDGE_FIXTURE"),
    )
    .map((name) => `e2e/${name}`);
  assert.deepEqual(
    [...listed].sort(),
    [...needFixture, "e2e/accessibility.spec.ts"].sort(),
  );
  // And playwright.config.ts collects each of those only against the fixture
  // (Round 21 hardening, W14): no run without it lists them as skipped.
  const config = readFileSync(
    resolve(import.meta.dirname, "../playwright.config.ts"),
    "utf8",
  );
  const fixtureOnly = config.slice(
    config.indexOf("const fixtureOnly"),
    config.indexOf("const notCollected"),
  );
  const ignored = [...fixtureOnly.matchAll(/\/([\w-]+)\\\.spec\\\.ts\//gu)]
    .map((match) => `e2e/${match[1]}.spec.ts`)
    .sort();
  assert.deepEqual(ignored, needFixture.sort());
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
});

test("the change audit's evidence keeps the runner's summary and counts, not only the web server's last words (register F63)", async () => {
  // Importing run-gates.mjs must not take the audit lock and run every gate,
  // so it runs only when node was asked to run it — asserted before the
  // import, never discovered by one.
  assert.match(
    runGates,
    /^export function gateOutput\(/mu,
    "run-gates.mjs exports no gateOutput; what its evidence keeps is untestable",
  );
  assert.match(
    runGates,
    /realpathSync\(process\.argv\[1\]\) ===/u,
    "run-gates.mjs would run its gates when imported",
  );
  const { gateOutput } = await import("../scripts/audit/run-gates.mjs");

  // `npm run test:browser` under CI=1: the github reporter prints its summary
  // as ONE stdout line, and Playwright relays the web server's stderr, which
  // outlasts it. One 30-line tail of stdout-then-stderr kept none of it.
  const stdout = [
    "> snoopy@0.1.0 test:browser",
    "> playwright test",
    "",
    "::error file=e2e/a.spec.ts,title=a,line=3,col=1::  1) [chromium] › a.spec.ts:3:1 › a%0A%0A    Error: expect(received).toBe(expected)",
    "::notice title=🎭 Playwright Run Summary::  1 failed%0A    [chromium] › a.spec.ts:3:1 › a%0A  1 flaky%0A    [webkit] › b.spec.ts:9:1 › b%0A  2 skipped%0A  40 passed (1.2m)",
    "",
  ].join("\n");
  const stderr = Array.from(
    { length: 200 },
    (_, line) => `[WebServer] GET /account ${line}`,
  ).join("\n");
  const kept = gateOutput(stdout, stderr);
  assert.match(
    JSON.stringify(kept),
    /40 passed/u,
    "the evidence lost the runner's summary to the web server's stderr",
  );
  assert.deepEqual(kept.counts, {
    failed: 1,
    flaky: 1,
    skipped: 2,
    passed: 40,
  });
  assert.match(kept.stderr_tail, /GET \/account 199$/u);
  assert.ok(kept.stderr_tail.split("\n").length <= 30, "the tail is a tail");
  // record-pass.mjs verifies each gate's name, exit and seconds; what is kept
  // of the output must never overwrite them.
  for (const field of ["name", "exit", "seconds"]) {
    assert.ok(!(field in kept), `gateOutput would overwrite ${field}`);
  }

  // test:contracts: node:test prints TAP to a pipe, ending in its counts.
  assert.deepEqual(
    gateOutput(
      "ok 1 - a\n1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 5.1\n",
      "",
    ).counts,
    { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 },
  );
  // node:test's spec reporter, the default wherever a Node prints it to a
  // pipe too: the same counts, marked ℹ — never a null the evidence reads as
  // "no test runner".
  assert.deepEqual(
    gateOutput(
      "✔ a (0.5ms)\nℹ tests 1\nℹ suites 0\nℹ pass 1\nℹ fail 0\nℹ cancelled 0\nℹ skipped 0\nℹ todo 0\nℹ duration_ms 5.1\n",
      "",
    ).counts,
    { tests: 1, pass: 1, fail: 0, cancelled: 0, skipped: 0, todo: 0 },
  );
  // A gate with no test runner (lint, a build) has no counts, not invented ones.
  assert.equal(gateOutput("✓ Compiled successfully\n", "").counts, null);
});
