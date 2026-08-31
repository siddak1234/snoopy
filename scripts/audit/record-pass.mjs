// The ONLY writer of the change-audit PASS marker. Run by the main session,
// never by the auditing agent. It re-derives everything derivable and refuses
// anything it cannot verify — the auditor reports, this script decides what
// counts as recorded.
//
// Usage:
//   node scripts/audit/record-pass.mjs <verdict.json>   # full audit
//   node scripts/audit/record-pass.mjs --docs-only      # docs-only fast path
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const auditDir = join(root, ".git/autom8x-audit");

const SOURCE_ROOTS = [
  "app/",
  "components/",
  "hooks/",
  "lib/",
  "e2e/fixtures/",
  "scripts/",
  "next.config.ts",
  "proxy.ts",
  "instrumentation.ts",
];
const MARKER_TTL_HOURS = 24;
const DURATION_FLOORS = {
  build: 10,
  "test:browser": 20,
  "test:browser:fixtures": 20,
};
const FULL_GATES = [
  "lint",
  "typecheck",
  "audit:boundaries",
  "test:contracts",
  "build",
  "test:browser",
  "test:browser:fixtures",
];
const DOCS_GATES = ["lint", "format:check"];

function git(...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function refuse(message) {
  console.error(`record-pass: REFUSED — ${message}`);
  process.exit(1);
}

const docsOnly = process.argv[2] === "--docs-only";
const verdictPath = docsOnly ? null : process.argv[2];
if (!docsOnly && !verdictPath)
  refuse("usage: record-pass.mjs <verdict.json> | --docs-only");

const tree = git("rev-parse", "HEAD^{tree}");
const headSha = git("rev-parse", "HEAD");
const baselineOriginMain = git("rev-parse", "origin/main");

// The audited artifact must be the pushed artifact: tracked modifications
// mean the evidence describes a tree nobody will push.
const porcelain = git("status", "--porcelain").split("\n").filter(Boolean);
const trackedDirt = porcelain.filter((line) => !line.startsWith("??"));
if (trackedDirt.length > 0) {
  refuse(`tracked files are modified/staged:\n${trackedDirt.join("\n")}`);
}
const warnings = porcelain
  .filter((line) => line.startsWith("??"))
  .map((line) => `untracked at audit time: ${line.slice(3)}`);

const evidencePath = join(auditDir, `evidence-${tree}.json`);
if (!existsSync(evidencePath)) {
  refuse(
    `no evidence for tree ${tree} — run scripts/audit/run-gates.mjs on this exact tree`,
  );
}
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
if (evidence.tree !== tree) refuse("evidence tree does not match HEAD tree");
if (evidence.baseline_origin_main_sha !== baselineOriginMain) {
  refuse(
    "origin/main moved since the gates ran — fetch, rebase if needed, re-run the audit",
  );
}

const requiredGates = docsOnly ? DOCS_GATES : FULL_GATES;
if ((evidence.mode === "docs-only") !== docsOnly) {
  refuse(
    `evidence mode is "${evidence.mode}" but record-pass was invoked ${docsOnly ? "with" : "without"} --docs-only`,
  );
}
for (const name of requiredGates) {
  const gate = evidence.gates.find((entry) => entry.name === name);
  if (!gate) refuse(`gate "${name}" is missing from the evidence`);
  if (gate.exit !== 0) refuse(`gate "${name}" exited ${gate.exit}`);
  const floor = DURATION_FLOORS[name] ?? 0;
  if (gate.seconds < floor) {
    refuse(
      `gate "${name}" finished in ${gate.seconds}s (< ${floor}s floor) — not a plausible real run`,
    );
  }
}

let verdict = null;
if (!docsOnly) {
  if (!existsSync(verdictPath))
    refuse(`verdict file not found: ${verdictPath}`);
  verdict = JSON.parse(readFileSync(verdictPath, "utf8"));
  if (verdict.verdict !== "PASS")
    refuse(`verdict is "${verdict.verdict}", not PASS`);

  const baseSha = git("merge-base", "origin/main", "HEAD");
  const actualChanged = git("diff", "--name-only", `${baseSha}..HEAD`)
    .split("\n")
    .filter(Boolean)
    .sort();
  const claimedChanged = [...(verdict.changed_files ?? [])].sort();
  if (JSON.stringify(actualChanged) !== JSON.stringify(claimedChanged)) {
    refuse(
      "the verdict's changed-file list does not match the recomputed diff",
    );
  }

  // Every changed source file must be accounted for by a surface row or an
  // explicit out-of-scope entry — unaccounted files are exactly the blind
  // spot this mechanism exists to eliminate.
  const changedSource = actualChanged.filter((path) =>
    SOURCE_ROOTS.some((prefix) => path === prefix || path.startsWith(prefix)),
  );
  const covered = new Set(
    (verdict.coverage ?? []).flatMap((row) => row.source_files ?? []),
  );
  const outOfScope = new Set(
    (verdict.out_of_scope ?? []).map((entry) => entry.file),
  );
  const unaccounted = changedSource.filter(
    (path) => !covered.has(path) && !outOfScope.has(path),
  );
  if (unaccounted.length > 0) {
    refuse(
      `changed source files appear in no coverage row and no out_of_scope entry:\n${unaccounted.join("\n")}`,
    );
  }

  for (const row of verdict.coverage ?? []) {
    if (row.status === "UNCOVERED") {
      const probeExit = row.probe?.exit;
      if (probeExit !== 0) {
        refuse(
          `UNCOVERED surface "${row.surface}" has no passing probe (probe exit: ${probeExit ?? "none"})`,
        );
      }
    }
  }
}

const createdAt = new Date();
const marker = {
  tree,
  head_sha: headSha,
  baseline_origin_main_sha: baselineOriginMain,
  created_at: createdAt.toISOString(),
  expires_at: new Date(
    createdAt.getTime() + MARKER_TTL_HOURS * 3600 * 1000,
  ).toISOString(),
  mode: docsOnly ? "docs-only" : "full",
  gates: evidence.gates,
  evidence_path: evidencePath,
  verdict_path: verdictPath,
  warnings,
};
const markerPath = join(auditDir, `${tree}.json`);
const tmpPath = `${markerPath}.tmp`;
writeFileSync(tmpPath, JSON.stringify(marker, null, 2));
renameSync(tmpPath, markerPath);
console.log(`record-pass: PASS recorded for tree ${tree}`);
console.log(`record-pass: marker ${markerPath} (expires ${marker.expires_at})`);
if (warnings.length > 0)
  console.log(warnings.map((w) => `  warning: ${w}`).join("\n"));
