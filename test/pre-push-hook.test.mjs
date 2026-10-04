// The native pre-push gate, tested hermetically against throwaway repos —
// driven exactly as git drives it: remote name + url as args, ref lines on
// stdin. The six fast gates are the fixture's stubs: each notes that it ran,
// and exits as the test says.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

const hook = resolve(import.meta.dirname, "../scripts/githooks/pre-push");
const SNOOPY_URL = "https://github.com/siddak1234/snoopy.git";
const ZERO = "0000000000000000000000000000000000000000";
// verify's first six, in its order (README "Verification"), read from the
// change audit's list rather than restated here.
const FAST_GATES = [
  ...readFileSync(
    resolve(import.meta.dirname, "../scripts/audit/run-gates.mjs"),
    "utf8",
  ).matchAll(/name: "([^"]+)"/gu),
]
  .map((match) => match[1])
  .slice(0, 6);
const CONTRACTS = [
  "docs/openapi.yaml",
  "docs/openapi/automations.yaml",
  "docs/openapi/connections.yaml",
];

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

// A repository whose six gates are stubs — each writes `ran-<gate>` and exits
// red or green as asked — with the sibling checkout the sixth reads planted
// beside it, or not.
function makeRepo({ red = [], sibling = true, recordGitDir = false } = {}) {
  const base = mkdtempSync(join(tmpdir(), "pre-push-"));
  const repo = join(base, "snoopy");
  mkdirSync(repo);
  git(repo, "init", "-q");
  const scripts = Object.fromEntries(
    FAST_GATES.map((gate) => [
      gate,
      `${recordGitDir ? `printf %s "\${GIT_DIR-unset}" > seen-git-dir-${gate.replace(":", "-")} && ` : ""}touch ran-${gate.replace(":", "-")} && exit ${red.includes(gate) ? 1 : 0}`,
    ]),
  );
  writeFileSync(
    join(repo, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts }),
  );
  git(repo, "add", "package.json");
  git(
    repo,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "-m",
    "one",
  );
  if (sibling) {
    for (const contract of CONTRACTS) {
      const path = join(base, "snoopy-backend", contract);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "openapi: 3.1.0\n");
    }
  }
  return { base, repo };
}

const ran = (repo) =>
  FAST_GATES.filter((gate) =>
    existsSync(join(repo, `ran-${gate.replace(":", "-")}`)),
  );

function runHook(repo, url, lines, extraEnv = {}) {
  // The hook resolves the sibling as the generator does, from the environment
  // or beside the repository; the test's own environment must not reach it.
  const env = { ...process.env };
  delete env.SNOOPY_BACKEND_ROOT;
  Object.assign(env, extraEnv);
  const run = spawnSync("sh", [hook, "origin", url], {
    cwd: repo,
    encoding: "utf8",
    input: lines,
    env,
  });
  return { exit: run.status, stderr: run.stderr };
}

function mark(repo, tree, expiresAt) {
  const gitDir = git(repo, "rev-parse", "--absolute-git-dir");
  mkdirSync(join(gitDir, "autom8x-audit"), { recursive: true });
  writeFileSync(
    join(gitDir, "autom8x-audit", `${tree}.json`),
    JSON.stringify({ tree, expires_at: expiresAt }),
  );
  return join(gitDir, "autom8x-audit", `${tree}.json`);
}

const inAnHour = () => new Date(Date.now() + 3600_000).toISOString();

test("native pre-push gate", (t) => {
  const { base, repo } = makeRepo();
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sha = git(repo, "rev-parse", "HEAD");
  const tree = git(repo, "rev-parse", "HEAD^{tree}");
  const refLine = `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`;

  assert.equal(
    runHook(repo, "https://github.com/other/elsewhere.git", refLine).exit,
    0,
    "another remote is not gated",
  );
  assert.equal(
    runHook(
      repo,
      SNOOPY_URL,
      `refs/heads/gone ${ZERO} refs/heads/gone ${sha}\n`,
    ).exit,
    0,
    "a deletion push is allowed",
  );

  const blocked = runHook(repo, SNOOPY_URL, refLine);
  assert.equal(blocked.exit, 1, "an unaudited tree is blocked");
  assert.match(blocked.stderr, /the six fast gates are green/);
  assert.match(blocked.stderr, /no change-audit PASS marker/);
  assert.deepEqual(ran(repo), FAST_GATES, "the gates ran first, in order");
  for (const gate of ran(repo))
    rmSync(join(repo, `ran-${gate.replace(":", "-")}`));

  const marker = mark(repo, tree, inAnHour());
  const passed = runHook(repo, SNOOPY_URL, refLine);
  assert.equal(passed.exit, 0, "a marked tree passes");
  assert.deepEqual(ran(repo), FAST_GATES, "every fast gate ran, in order");
  assert.match(passed.stderr, /the six fast gates are green/);
  assert.ok(
    !existsSync(join(repo, ".autom8x")),
    "the hook writes no facts file",
  );

  mark(repo, tree, "2000-01-01T00:00:00.000Z");
  const expired = runHook(repo, SNOOPY_URL, refLine);
  assert.equal(expired.exit, 1, "an expired marker blocks");
  assert.match(expired.stderr, /expired/);

  rmSync(marker);
  for (const gate of ran(repo))
    rmSync(join(repo, `ran-${gate.replace(":", "-")}`));
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  assert.equal(
    runHook(repo, SNOOPY_URL, refLine).exit,
    0,
    "a tree identical to origin/main needs no marker",
  );
  assert.deepEqual(ran(repo), [], "and runs no gate: nothing new ships");
});

test("the fast gates are verify's first six, run in its order and stopped at the first red, which is named with the bypass (register F92)", (t) => {
  assert.deepEqual(FAST_GATES, [
    "format:check",
    "lint",
    "typecheck",
    "audit:boundaries",
    "test:contracts",
    "verify:platform-contracts",
  ]);
  assert.match(
    readFileSync(hook, "utf8"),
    new RegExp(`^for gate in ${FAST_GATES.join(" ")}; do$`, "mu"),
    "the hook's list is verify's",
  );
  // Nothing slow, and nothing written: CI runs the builds and the browser
  // suites; only a whole green verify emits facts, only record-pass a marker.
  // Read from the code, not its comments, which say exactly this.
  assert.doesNotMatch(
    readFileSync(hook, "utf8")
      .split("\n")
      .filter((line) => !/^\s*#/u.test(line))
      .join("\n"),
    /npm run build|test:browser|verify\.mjs|record-pass|repo-facts/u,
  );

  // No marker: the gate is named whether or not the process was followed.
  const { base, repo } = makeRepo({ red: ["typecheck"] });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sha = git(repo, "rev-parse", "HEAD");
  const refused = runHook(
    repo,
    SNOOPY_URL,
    `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`,
  );
  assert.equal(refused.exit, 1, "a red gate refuses the push");
  assert.match(refused.stderr, /pre-push: typecheck is red/);
  assert.match(refused.stderr, /git push --no-verify/);
  assert.deepEqual(
    ran(repo),
    FAST_GATES.slice(0, 3),
    "the gates after the red one did not run",
  );
  assert.ok(!existsSync(join(repo, ".autom8x")));
});

test("a sibling checkout that is absent skips verify:platform-contracts out loud, as verify does", (t) => {
  const { base, repo } = makeRepo({ sibling: false });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sha = git(repo, "rev-parse", "HEAD");
  mark(repo, git(repo, "rev-parse", "HEAD^{tree}"), inAnHour());
  const passed = runHook(
    repo,
    SNOOPY_URL,
    `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`,
  );
  assert.equal(passed.exit, 0);
  assert.match(
    passed.stderr,
    /verify:platform-contracts skipped — sibling checkout not present/,
  );
  assert.deepEqual(ran(repo), FAST_GATES.slice(0, 5));
});

test("a push from a linked worktree runs the gates without git's repository variables, so the gates' own git calls cannot touch this repository", (t) => {
  // git exports GIT_DIR (and, with --work-tree, GIT_WORK_TREE) to the hook for
  // a push from a linked worktree or with --git-dir; the gates' tests run git
  // in throwaway repositories, which those variables would redirect here.
  const { base, repo } = makeRepo({ recordGitDir: true });
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const sha = git(repo, "rev-parse", "HEAD");
  mark(repo, git(repo, "rev-parse", "HEAD^{tree}"), inAnHour());
  const gitDir = git(repo, "rev-parse", "--absolute-git-dir");
  const pushed = runHook(
    repo,
    SNOOPY_URL,
    `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`,
    { GIT_DIR: gitDir, GIT_WORK_TREE: repo },
  );
  assert.equal(pushed.exit, 0, pushed.stderr);
  for (const gate of FAST_GATES) {
    const seen = join(repo, `seen-git-dir-${gate.replace(":", "-")}`);
    assert.equal(readFileSync(seen, "utf8"), "unset", `${gate} saw GIT_DIR`);
  }
});
