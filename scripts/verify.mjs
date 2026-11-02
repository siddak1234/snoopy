// The website's whole offline gate in one command — `npm run verify` — so
// "green" means the same list every time rather than whichever commands a
// session remembered (backend §12.2 #68; BUILD-PLAN 20.4.1). It runs the gates
// scripts/audit/run-gates.mjs runs, in the same order — format:check, the docs
// check, the map's and verify:platform-contracts among them (register F15) —
// and ends by emitting this repository's facts file (scripts/repo-facts.mjs).
//
// Deliberately separate from run-gates.mjs: that runner is the change audit's —
// it needs origin/main, exits 0 without running a gate when HEAD equals the
// merge-base tree, and writes the evidence the marker writer cross-checks.
// test/verify-gate.test.mjs keeps the two gate lists in step. The two share
// their preflight — conflict copies, listeners, and one lock, since both build
// into .next and serve on 3001 and 3443 — and the rewrite assertion, from
// scripts/audit/preflight.mjs (register F24).
import { spawnSync } from "node:child_process";
import { constants as osConstants } from "node:os";
import { join, resolve } from "node:path";
import {
  assertNoSkippedBrowserTests,
  assertNoSkippedTests,
  assertPlatformRewrite,
  preflight,
} from "./audit/preflight.mjs";
import { FACTS_PATH, writeRepoFacts } from "./repo-facts.mjs";

const root = resolve(import.meta.dirname, "..");
// Baked into the build (next.config.ts rewrites), so it is set at build time and
// kept identical for the browser suite that serves that build.
const buildOrigin = "https://backend.invalid";

function fail(message) {
  console.error(`verify: ${message}`);
  process.exit(1);
}

// --- preflight: shared with the change audit (scripts/audit/preflight.mjs) ---
await preflight({ root, fail });

// No gate is ever skipped: verify:platform-contracts reads SNOOPY_BACKEND_ROOT,
// else the sibling checkout, else the committed copy of the backend's contract
// files (scripts/backend-contract.mjs; Round 21 hardening, W1).
const gates = [
  { name: "format:check" },
  // D, docs always updated (AGENTS.md): each changed area's doc changed with
  // it (docs/docs-map.json), and docs/MAP.md regenerated from the tree.
  { name: "check:docs" },
  { name: "map", args: ["--", "--check"] },
  { name: "lint" },
  { name: "typecheck" },
  { name: "audit:boundaries" },
  // A skipped or todo contract test fails, as in CI's gates job: its TAP is
  // read as well as printed (README "Verification", no silent skips).
  {
    name: "test:contracts",
    capture: true,
    after: (stdout) => assertNoSkippedTests(stdout),
  },
  { name: "verify:platform-contracts" },
  // The site with no backend, as a Vercel preview builds it (register F62).
  // Before `build`, whose output the browser suite serves.
  { name: "build:no-backend" },
  // And served as a preview serves it: the public pages load, the account area
  // sends a visitor to sign in, and readiness says "not configured".
  { name: "probe:no-backend" },
  {
    name: "build",
    env: { BACKEND_API_ORIGIN: buildOrigin },
    after: () => assertPlatformRewrite(root),
  },
  {
    name: "test:browser",
    // CI=1 defeats reuseExistingServer, which would test a stale local server
    // instead of this build; the origin pin keeps `next start` on the build's.
    env: { CI: "1", BACKEND_API_ORIGIN: buildOrigin },
    // Every collected test ran, as CI's browser job checks after it.
    after: () => assertNoSkippedBrowserTests(root),
  },
  // Last: it rebuilds .next with the loopback fixture origin.
  { name: "test:browser:fixtures" },
];

console.log(`verify: node ${process.version}`);
for (const gate of gates) {
  const begun = Date.now();
  const run = spawnSync("npm", ["run", gate.name, ...(gate.args ?? [])], {
    cwd: root,
    // A gate whose output is checked hands its stdout back; it is printed
    // as soon as the gate ends.
    stdio: gate.capture ? ["inherit", "pipe", "inherit"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
    encoding: "utf8",
    env: { ...process.env, ...(gate.env ?? {}) },
  });
  if (gate.capture && run.stdout) process.stdout.write(run.stdout);
  let exit = run.status ?? 1;
  if (run.status === null && run.error) {
    // A child that never ran (npm not on PATH, say) is an environment error,
    // not a red gate; say so rather than reporting an anonymous exit=1.
    console.error(
      `verify: ${gate.name} could not start — ${run.error.message}`,
    );
  }
  if (run.status === null && run.signal) {
    // Killed rather than failed — a build the machine ran out of memory for,
    // or a Ctrl-C — is not a red gate either; name the signal and exit as a
    // shell would.
    console.error(`verify: ${gate.name} was killed by ${run.signal}`);
    exit = 128 + (osConstants.signals[run.signal] ?? 0);
  }
  if (exit === 0 && gate.after) {
    try {
      gate.after(run.stdout ?? "");
    } catch (error) {
      console.error(`verify: ${error.message}`);
      exit = 1;
    }
  }
  const seconds = Math.round((Date.now() - begun) / 1000);
  console.log(`verify: ${gate.name} exit=${exit} (${seconds}s)`);
  if (exit !== 0) process.exit(exit);
}

// Only a FULLY verified tree emits facts: the file is a claim the close copies
// into snoopy-backend as data, and `gate` is the script a reader re-runs to
// reproduce it. Every gate above ran and passed, or the run stopped at it.
const facts = writeRepoFacts(join(root, FACTS_PATH), { gate: "verify" });
console.log(`verify: facts written to ${FACTS_PATH}`);
console.log(JSON.stringify(facts, null, 2));
