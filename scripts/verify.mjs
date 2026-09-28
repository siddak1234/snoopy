// The website's whole offline gate in one command — `npm run verify` — so
// "green" means the same list every time rather than whichever commands a
// session remembered (backend §12.2 #68; BUILD-PLAN 20.4.1). It runs the gates
// scripts/audit/run-gates.mjs runs, in the same order — format:check and
// verify:platform-contracts among them (register F15) — and ends by emitting
// this repository's facts file (scripts/repo-facts.mjs).
//
// Deliberately separate from run-gates.mjs: that runner is the change audit's —
// it needs origin/main, exits 0 without running a gate when HEAD equals the
// merge-base tree, and writes the evidence the marker writer cross-checks.
// test/verify-gate.test.mjs keeps the two gate lists in step. The two share
// their preflight — conflict copies, listeners, and one lock, since both build
// into .next and serve on 3001 and 3443 — and the rewrite assertion, from
// scripts/audit/preflight.mjs (register F24).
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { constants as osConstants } from "node:os";
import { join, resolve } from "node:path";
import { assertPlatformRewrite, preflight } from "./audit/preflight.mjs";
import { FACTS_PATH, writeRepoFacts } from "./repo-facts.mjs";

const root = resolve(import.meta.dirname, "..");
// The sibling checkout the contract generator and the contract tests read.
// SNOOPY_BACKEND_ROOT points every reader at another checkout — or at none,
// which is how the skip branch below is exercised without moving a checkout
// that is not this repository's to move. Every reader resolves it from the
// repository root, so a relative value means one thing everywhere, and an
// empty value means unset.
const backendRoot = resolve(
  root,
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
);
// The three inputs generate-platform-contracts.mjs reads. It throws on the first
// one missing, so a truthful skip has to check all three.
const contractInputs = [
  "docs/openapi.yaml",
  "docs/openapi/automations.yaml",
  "docs/openapi/connections.yaml",
].map((path) => join(backendRoot, path));
// Baked into the build (next.config.ts rewrites), so it is set at build time and
// kept identical for the browser suite that serves that build.
const buildOrigin = "https://backend.invalid";

function fail(message) {
  console.error(`verify: ${message}`);
  process.exit(1);
}

// --- preflight: shared with the change audit (scripts/audit/preflight.mjs) ---
await preflight({ root, fail });

const siblingPresent = contractInputs.every((path) => existsSync(path));
const gates = [
  { name: "format:check" },
  { name: "lint" },
  { name: "typecheck" },
  { name: "audit:boundaries" },
  { name: "test:contracts" },
  {
    name: "verify:platform-contracts",
    // Reads the sibling checkout and throws when it is absent. A gate that goes
    // red because a DIFFERENT checkout is missing is §12.2 #78's class, so the
    // dependency is accepted and the skip is said out loud, never silently.
    skip: siblingPresent
      ? null
      : `sibling checkout not present at ${backendRoot}; accepted dependency (§12.2 #78)`,
  },
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
  },
  // Last: it rebuilds .next with the loopback fixture origin.
  { name: "test:browser:fixtures" },
];

console.log(`verify: node ${process.version}`);
const skipped = [];
for (const gate of gates) {
  if (gate.skip) {
    console.log(`verify: SKIP ${gate.name} — ${gate.skip}`);
    skipped.push(gate.name);
    continue;
  }
  const begun = Date.now();
  const run = spawnSync("npm", ["run", gate.name], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...(gate.env ?? {}) },
  });
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
      gate.after();
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
// reproduce it — so a run that skipped a gate says so and emits nothing, rather
// than producing a file indistinguishable from a full run's.
if (skipped.length) {
  console.log(
    `verify: green for what ran; facts NOT emitted — skipped: ${skipped.join(", ")}`,
  );
} else {
  const facts = writeRepoFacts(join(root, FACTS_PATH), { gate: "verify" });
  console.log(`verify: facts written to ${FACTS_PATH}`);
  console.log(JSON.stringify(facts, null, 2));
}
