// The website's whole offline gate in one command — `npm run verify` — so
// "green" means the same list every time rather than whichever commands a
// session remembered (backend §12.2 #68; BUILD-PLAN 20.4.1). It runs the gates
// scripts/audit/run-gates.mjs runs, in the same order, plus format:check (CI's
// Lint job runs it; the audit runner does not) and verify:platform-contracts
// (neither runs it), and ends by emitting this repository's facts file
// (scripts/repo-facts.mjs).
//
// Deliberately separate from run-gates.mjs: that runner is the change audit's —
// it needs origin/main, exits 0 without running a gate when HEAD equals the
// merge-base tree, and writes the evidence the marker writer cross-checks.
// test/verify-gate.test.mjs keeps the two gate lists in step. The two share one
// thing on purpose, the audit lock: both build into .next and serve on 3001 and
// 3443, so running them at once is refused rather than left to memory.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { constants as osConstants } from "node:os";
import { join, resolve } from "node:path";
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

// --- preflight: the two checks the audit runner makes, for the same reasons ---
const conflictCopies = spawnSync(
  "find",
  [
    ".",
    "-path",
    "./node_modules",
    "-prune",
    "-o",
    "(",
    "-name",
    "* 2.*",
    "-o",
    "-name",
    "* 2",
    ")",
    "-print",
  ],
  { cwd: root, encoding: "utf8" },
).stdout.trim();
if (conflictCopies) {
  fail(
    `Finder conflict copies contaminate the clone (tsconfig's **/*.ts would typecheck them):\n${conflictCopies}`,
  );
}
for (const port of [3001, 3443]) {
  const listeners = spawnSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
    {
      encoding: "utf8",
    },
  );
  if (listeners.status === 0 && listeners.stdout.trim()) {
    fail(`port ${port} has a listener; stop it first:\n${listeners.stdout}`);
  }
}
// The audit runner's lock, shared on purpose: the port check is blind while the
// other is still in its lint, typecheck or build phase, and two builds into one
// .next produce a manifest neither of them ran. A live pid refuses; a stale one
// is cleared; this run's pid is held until exit so an audit refuses in turn.
const auditDir = join(root, ".git/autom8x-audit");
const lockPath = join(auditDir, "lock");
mkdirSync(auditDir, { recursive: true });
// Acquired atomically — `wx` refuses an existing file — so two runs started in
// the same instant cannot both pass: the loser reads the winner's pid. A stale
// lock is cleared once: a dead pid, or an empty or garbled file, which must
// never count as live (pid 0 would signal this process's own group and
// "succeed", wedging every later run).
function acquireLock(retry) {
  try {
    writeFileSync(lockPath, String(process.pid), { flag: "wx" });
    return;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  let content = "";
  try {
    content = readFileSync(lockPath, "utf8");
  } catch {
    // Released between the two calls: one more attempt.
    if (retry) return acquireLock(false);
    fail(`the audit lock ${lockPath} could not be read`);
  }
  const pid = Number(content.trim());
  let alive = false;
  if (Number.isInteger(pid) && pid > 0) {
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      alive = false;
    }
  }
  if (alive) {
    fail(
      `a change audit or another verify is running (pid ${pid}); wait for it`,
    );
  }
  if (!retry) fail(`the audit lock ${lockPath} could not be acquired`);
  rmSync(lockPath, { force: true });
  acquireLock(false);
}
acquireLock(true);
const releaseLock = () => {
  try {
    rmSync(lockPath);
  } catch {
    /* already gone */
  }
};
process.on("exit", releaseLock);
process.on("SIGINT", () => process.exit(130));
process.on("SIGTERM", () => process.exit(143));

// Mirrors the CI build job and run-gates.mjs: a build without the /api/platform
// rewrite exits 0 while every browser API call would 404 in production.
function assertPlatformRewrite() {
  const manifest = JSON.parse(
    readFileSync(join(root, ".next/routes-manifest.json"), "utf8"),
  );
  const rewrites = Array.isArray(manifest.rewrites)
    ? manifest.rewrites
    : [
        ...(manifest.rewrites?.beforeFiles ?? []),
        ...(manifest.rewrites?.afterFiles ?? []),
        ...(manifest.rewrites?.fallback ?? []),
      ];
  const hit = rewrites.some(
    (entry) =>
      typeof entry.source === "string" &&
      entry.source.startsWith("/api/platform"),
  );
  if (!hit) throw new Error("build output contains no /api/platform rewrite");
}

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
  {
    name: "build",
    env: { BACKEND_API_ORIGIN: buildOrigin },
    after: assertPlatformRewrite,
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
