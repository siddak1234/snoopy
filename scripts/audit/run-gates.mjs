// Deterministic gate runner for the change audit. Runs the same gates CI runs
// and writes an evidence file the marker writer (record-pass.mjs) verifies.
// The auditing agent INVOKES this script but cannot author its output — that
// split is what keeps a PASS honest.
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const auditDir = join(root, ".git/autom8x-audit");
const lockPath = join(auditDir, "lock");

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`run-gates: ${message}`);
  process.exit(1);
}

// --- preflight -------------------------------------------------------------
// macOS/iCloud Finder conflict copies ("file 2.ts") are invisible to git
// (the repo's own `* 2.*` ignore rule) yet poison typecheck, the test glob,
// and visual baselines — the first audit run failed on exactly this.
// Both patterns: "file 2.ts" AND the dotless "pre-push 2" — the latter dodged
// the gitignore rule and reached a commit before the audit caught it.
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
    `Finder conflict copies contaminate the clone (invisible to git, poison the gates):\n${conflictCopies}\nDelete them and re-run:\n  find . -path ./node_modules -prune -o -name '* 2.*' -print -delete`,
  );
}

for (const port of [3001, 3443]) {
  const listeners = spawnSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
    { encoding: "utf8" },
  );
  if (listeners.status === 0 && listeners.stdout.trim()) {
    fail(
      `port ${port} has a listener; stop it first (a stale dev/test server would corrupt the audit):\n${listeners.stdout}`,
    );
  }
}

mkdirSync(auditDir, { recursive: true });
if (existsSync(lockPath)) {
  const pid = Number(readFileSync(lockPath, "utf8"));
  let alive = false;
  try {
    process.kill(pid, 0);
    alive = true;
  } catch {
    alive = false;
  }
  if (alive) fail(`another audit is running (pid ${pid}); wait for it`);
  rmSync(lockPath);
}
writeFileSync(lockPath, String(process.pid));
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
// Order matters: the fixture suite rebuilds .next with its own origin, so it
// runs LAST or it would invalidate the build gate's output.
const fullGates = [
  { name: "lint", command: ["npm", "run", "lint"] },
  { name: "typecheck", command: ["npm", "run", "typecheck"] },
  { name: "audit:boundaries", command: ["npm", "run", "audit:boundaries"] },
  { name: "test:contracts", command: ["npm", "run", "test:contracts"] },
  {
    name: "build",
    command: ["npm", "run", "build"],
    env: { BACKEND_API_ORIGIN: "https://backend.invalid" },
    after: assertPlatformRewrite,
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

// Mirrors the CI build job: a build without the /api/platform rewrite exits 0
// while every browser API call would 404 in production.
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
  const hit = rewrites.find(
    (entry) =>
      typeof entry.source === "string" &&
      entry.source.startsWith("/api/platform"),
  );
  if (!hit) throw new Error("build output contains no /api/platform rewrite");
}

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
