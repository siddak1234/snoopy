// Deterministic gate runner for the change audit. Runs the same gates CI runs
// and writes an evidence file the marker writer (record-pass.mjs) verifies.
// The auditing agent INVOKES this script but cannot author its output — that
// split is what keeps a PASS honest.
import { execFileSync, spawnSync } from "node:child_process";
import { realpathSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPlatformRewrite, preflight } from "./preflight.mjs";

const root = resolve(import.meta.dirname, "../..");
const auditDir = join(root, ".git/autom8x-audit");
const TAIL_LINES = 30;
// Both browser gates run with CI=1 — this runner sets it for test:browser, and
// run-browser-fixtures.mjs for itself — which gives them Playwright's github
// reporter. It prints the summary as ONE line with its newlines encoded as %0A,
// and only that line is read: a count found elsewhere could be a test's output.
const PLAYWRIGHT_SUMMARY = /^::notice title=[^:]*Playwright Run Summary::/u;
const PLAYWRIGHT_COUNT =
  /^\s*(\d+) (passed|failed|flaky|skipped|interrupted|did not run)\b/u;
// node:test prints TAP to a pipe, ending in `# pass 103`; the last one wins.
const NODE_TEST_COUNT = /^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/u;

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`run-gates: ${message}`);
  process.exit(1);
}

/**
 * What the evidence keeps of a gate's output (register F63): the runner's
 * counts as fields, and each stream's tail on its own. One tail of stdout then
 * stderr kept only the browser gates' stderr — the web server's — so the
 * Playwright summary was cut off and the evidence showed exit codes alone.
 */
export function gateOutput(stdout, stderr) {
  const counts = {};
  for (const line of stdout.split("\n")) {
    const summary = PLAYWRIGHT_SUMMARY.exec(line);
    if (summary) {
      for (const entry of line.slice(summary[0].length).split("%0A")) {
        const playwright = PLAYWRIGHT_COUNT.exec(entry);
        if (playwright) {
          counts[playwright[2].replaceAll(" ", "_")] = Number(playwright[1]);
        }
      }
    }
    const nodeTest = NODE_TEST_COUNT.exec(line);
    if (nodeTest) counts[nodeTest[1]] = Number(nodeTest[2]);
  }
  return {
    counts: Object.keys(counts).length > 0 ? counts : null,
    stdout_tail: tail(stdout),
    stderr_tail: tail(stderr),
  };
}

function tail(text) {
  return text.trimEnd().split("\n").slice(-TAIL_LINES).join("\n");
}

async function runGates() {
  // --- preflight: shared with `npm run verify` (./preflight.mjs, register F24) ---
  await preflight({ root, fail });

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
      name: "probe:no-backend",
      command: ["npm", "run", "probe:no-backend"],
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
  // A docs-only change is exactly the change that can name a file that does
  // not exist, so the document check is one of its gates.
  const docsGates = [
    { name: "lint", command: ["npm", "run", "lint"] },
    { name: "format:check", command: ["npm", "run", "format:check"] },
    {
      name: "doc-references",
      command: ["node", "scripts/audit-doc-references.mjs"],
    },
  ];
  const gates = mode === "docs-only" ? docsGates : fullGates;

  const startedAt = new Date().toISOString();
  const results = [];
  let failed = false;
  for (const gate of gates) {
    if (failed) {
      results.push({
        name: gate.name,
        exit: "NOT_RUN",
        seconds: 0,
        ...gateOutput("", ""),
      });
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
    let stderr = run.stderr ?? "";
    if (exit === 0 && gate.after) {
      try {
        gate.after();
      } catch (error) {
        exit = 1;
        stderr += `\nassertion failed: ${error.message}`;
      }
    }
    const seconds = Math.round((Date.now() - begun) / 1000);
    results.push({
      name: gate.name,
      exit,
      seconds,
      ...gateOutput(run.stdout ?? "", stderr),
    });
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
}

// Run, not imported: test/verify-gate.test.mjs imports gateOutput, and an
// import must not take the audit lock and run every gate. Both paths are
// resolved, so a clone reached through a symlink still runs.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(import.meta.filename)
) {
  await runGates();
}
