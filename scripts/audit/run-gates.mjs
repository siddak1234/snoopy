// Deterministic gate runner for the change audit. Runs the same gates CI runs
// and writes an evidence file the marker writer (record-pass.mjs) verifies.
// The auditing agent INVOKES this script but cannot author its output — that
// split is what keeps a PASS honest.
import { execFileSync, spawnSync } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPlatformRewrite, preflight } from "./preflight.mjs";

const root = resolve(import.meta.dirname, "../..");
const auditDir = join(root, ".git/autom8x-audit");

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`run-gates: ${message}`);
  process.exit(1);
}

// --- preflight: shared with `npm run verify` (./preflight.mjs, register F24) ---
preflight({ root, fail });

// --- what changed ----------------------------------------------------------
const tree = git("rev-parse", "HEAD^{tree}");
const headSha = git("rev-parse", "HEAD");
const baselineOriginMain = git("rev-parse", "origin/main");
const baseSha = git("merge-base", "origin/main", "HEAD");
const baseTree = git("rev-parse", `${baseSha}^{tree}`);
const changedFiles = git("diff", "--name-only", `${baseSha}..HEAD`)
  .split("\n")
  .filter(Boolean);

if (tree === baseTree && changedFiles.length === 0) {
  console.log(
    "run-gates: HEAD tree equals the merge-base tree — nothing new ships, nothing to audit.",
  );
  process.exit(0);
}

const docsOnly =
  changedFiles.length > 0 &&
  changedFiles.every(
    (path) =>
      (path.startsWith("docs/") || path.endsWith(".md")) &&
      !path.startsWith(".github/"),
  );
const mode = docsOnly ? "docs-only" : "full";

// --- the gates -------------------------------------------------------------
// `npm run verify`'s list, in its order (register F15: this omitted
// format:check and verify:platform-contracts). The fixture suite rebuilds .next
// with its own origin, so it runs LAST or it would invalidate the build gate's
// output. verify:platform-contracts reads the backend checkout beside this one;
// an audit without it cannot say the client matches the contract, so it fails
// rather than skipping.
const fullGates = [
  { name: "format:check", command: ["npm", "run", "format:check"] },
  { name: "lint", command: ["npm", "run", "lint"] },
  { name: "typecheck", command: ["npm", "run", "typecheck"] },
  { name: "audit:boundaries", command: ["npm", "run", "audit:boundaries"] },
  { name: "test:contracts", command: ["npm", "run", "test:contracts"] },
  {
    name: "verify:platform-contracts",
    command: ["npm", "run", "verify:platform-contracts"],
  },
  {
    name: "build:no-backend",
    command: ["npm", "run", "build:no-backend"],
  },
  {
    name: "build",
    command: ["npm", "run", "build"],
    env: { BACKEND_API_ORIGIN: "https://backend.invalid" },
    after: () => assertPlatformRewrite(root),
  },
  {
    name: "test:browser",
    command: ["npm", "run", "test:browser"],
    // CI=1 defeats reuseExistingServer, which could silently test a stale
    // local server instead of this tree's build.
    env: { CI: "1" },
  },
  {
    name: "test:browser:fixtures",
    command: ["npm", "run", "test:browser:fixtures"],
  },
];
const docsGates = [
  { name: "lint", command: ["npm", "run", "lint"] },
  { name: "format:check", command: ["npm", "run", "format:check"] },
];
const gates = mode === "docs-only" ? docsGates : fullGates;

const startedAt = new Date().toISOString();
const results = [];
let failed = false;
for (const gate of gates) {
  if (failed) {
    results.push({ name: gate.name, exit: "NOT_RUN", seconds: 0, tail: "" });
    continue;
  }
  const begun = Date.now();
  const run = spawnSync(gate.command[0], gate.command.slice(1), {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...(gate.env ?? {}) },
    maxBuffer: 64 * 1024 * 1024,
  });
  let exit = run.status ?? 1;
  let output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
  if (exit === 0 && gate.after) {
    try {
      gate.after();
    } catch (error) {
      exit = 1;
      output += `\nassertion failed: ${error.message}`;
    }
  }
  const seconds = Math.round((Date.now() - begun) / 1000);
  const tail = output.split("\n").slice(-30).join("\n");
  results.push({ name: gate.name, exit, seconds, tail });
  console.log(`run-gates: ${gate.name} exit=${exit} (${seconds}s)`);
  if (exit !== 0) failed = true;
}

// --- evidence --------------------------------------------------------------
const evidence = {
  tree,
  head_sha: headSha,
  base_sha: baseSha,
  baseline_origin_main_sha: baselineOriginMain,
  mode,
  changed_files: changedFiles,
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  gates: results,
};
const evidencePath = join(auditDir, `evidence-${tree}.json`);
const tmpPath = `${evidencePath}.tmp`;
writeFileSync(tmpPath, JSON.stringify(evidence, null, 2));
renameSync(tmpPath, evidencePath);
console.log(`run-gates: evidence written to ${evidencePath}`);
process.exit(failed ? 1 : 0);
