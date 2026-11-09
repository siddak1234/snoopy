// The native pre-push gate, tested hermetically against throwaway repos —
// driven exactly as git drives it: remote name + url as args, ref lines on
// stdin. The repository carries the real classifier (scripts/change-class.mjs)
// and its checks (scripts/audit/preflight.mjs); `npm` is a stub first on PATH
// that notes each command it is asked for and exits as the test says.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
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

const here = resolve(import.meta.dirname, "..");
const hook = join(here, "scripts/githooks/pre-push");
const SNOOPY_URL = "https://github.com/siddak1234/snoopy.git";
const ZERO = "0000000000000000000000000000000000000000";
const DOCS = [
  "format:check",
  "check:docs",
  "map",
  "doc-references",
  "test:contracts",
];
const CODE = [
  "format:check",
  "check:docs",
  "map",
  "lint",
  "typecheck",
  "audit:boundaries",
  "test:contracts",
  "verify:platform-contracts",
];
const FULL = ["verify", "audit"];

function git(cwd, ...args) {
  const run = spawnSync(
    "git",
    ["-c", "user.email=t@t", "-c", "user.name=t", ...args],
    { cwd, encoding: "utf8" },
  );
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

// A repository at origin/main with the classifier, then one pushed commit
// that changes `change` (README.md, a doc, by default).
function makeRepo({ change = "README.md", origin = true, classifier } = {}) {
  const base = mkdtempSync(join(tmpdir(), "pre-push-"));
  const repo = join(base, "snoopy");
  const bin = join(base, "bin");
  const log = join(base, "npm.log");
  // The stub npm: `npm run <name> ...` and `npm audit ...` note their name
  // (and the GIT_DIR they saw), go red when FAKE_RED names them, and
  // test:contracts prints FAKE_TAP's TAP summary.
  write(
    join(bin, "npm"),
    `#!/bin/sh
name="$1"; [ "$1" = "run" ] && name="$2"
echo "$name" >> "${log}"
printf %s "\${GIT_DIR-unset}" > "${base}/git-dir-$(echo "$name" | tr : -)"
case " $FAKE_RED " in *" $name "*) exit 1 ;; esac
[ "$name" = "test:contracts" ] && printf '%b\\n' "\${FAKE_TAP:-# skipped 0\\n# todo 0}"
exit 0
`,
  );
  chmodSync(join(bin, "npm"), 0o755);
  mkdirSync(repo);
  git(repo, "init", "-q");
  write(
    join(repo, "scripts/change-class.mjs"),
    classifier ?? readFileSync(join(here, "scripts/change-class.mjs"), "utf8"),
  );
  write(
    join(repo, "scripts/audit/preflight.mjs"),
    readFileSync(join(here, "scripts/audit/preflight.mjs"), "utf8"),
  );
  write(
    join(repo, "scripts/audit-doc-references.mjs"),
    `import { appendFileSync } from "node:fs";\nappendFileSync(${JSON.stringify(log)}, "doc-references\\n");\n`,
  );
  write(join(repo, "README.md"), "# one\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "one");
  if (origin) git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  write(join(repo, change), "two\n");
  git(repo, "add", ".");
  git(repo, "commit", "-q", "-m", "two");
  const sha = git(repo, "rev-parse", "HEAD");
  return {
    base,
    repo,
    bin,
    tree: git(repo, "rev-parse", "HEAD^{tree}"),
    refLine: `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`,
    ran: () =>
      existsSync(log)
        ? readFileSync(log, "utf8").split("\n").filter(Boolean)
        : [],
    reset: () => rmSync(log, { force: true }),
  };
}

function runHook(fixture, url, lines, extraEnv = {}) {
  const env = { ...process.env };
  delete env.SNOOPY_BACKEND_ROOT;
  delete env.FAKE_RED;
  delete env.FAKE_TAP;
  Object.assign(env, extraEnv);
  env.PATH = `${fixture.bin}:${env.PATH}`;
  const run = spawnSync("sh", [hook, "origin", url], {
    cwd: fixture.repo,
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

test("native pre-push gate: the classifier's gates, then the change-audit marker", (t) => {
  const fixture = makeRepo();
  const { repo, tree, refLine } = fixture;
  t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
  const sha = git(repo, "rev-parse", "HEAD");

  assert.equal(
    runHook(fixture, "https://github.com/other/elsewhere.git", refLine).exit,
    0,
    "another remote is not gated",
  );
  assert.equal(
    runHook(
      fixture,
      SNOOPY_URL,
      `refs/heads/gone ${ZERO} refs/heads/gone ${sha}\n`,
    ).exit,
    0,
    "a deletion push is allowed",
  );
  assert.deepEqual(fixture.ran(), [], "neither ran a gate");

  const blocked = runHook(fixture, SNOOPY_URL, refLine);
  assert.equal(blocked.exit, 1, "an unaudited tree is blocked");
  assert.match(blocked.stderr, /change-class: docs \(Markdown only\)/u);
  assert.match(blocked.stderr, /the change-aware gates are green/u);
  assert.match(blocked.stderr, /no change-audit PASS marker/u);
  assert.deepEqual(fixture.ran(), DOCS, "the docs class ran first, in order");
  fixture.reset();

  const marker = mark(repo, tree, inAnHour());
  const passed = runHook(fixture, SNOOPY_URL, refLine);
  assert.equal(passed.exit, 0, passed.stderr);
  assert.deepEqual(fixture.ran(), DOCS);
  assert.ok(!existsSync(join(repo, ".autom8x")), "no facts file is written");

  mark(repo, tree, "2000-01-01T00:00:00.000Z");
  const expired = runHook(fixture, SNOOPY_URL, refLine);
  assert.equal(expired.exit, 1, "an expired marker blocks");
  assert.match(expired.stderr, /expired/u);

  rmSync(marker);
  fixture.reset();
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  assert.equal(
    runHook(fixture, SNOOPY_URL, refLine).exit,
    0,
    "a tree identical to origin/main needs no marker",
  );
  assert.deepEqual(fixture.ran(), [], "and runs no gate: nothing new ships");
});

test("the hook calls the classifier on the pushed commits and the working tree, and keeps the marker check", () => {
  const source = readFileSync(hook, "utf8");
  const code = source
    .split("\n")
    .filter((line) => !/^\s*#/u.test(line))
    .join("\n");
  assert.match(
    code,
    /^node scripts\/change-class\.mjs --run --worktree \$pushed/mu,
  );
  assert.match(code, /pushed="\$pushed --head \$local_sha"/u);
  assert.doesNotMatch(code, /^for gate in /mu, "no fixed gate list");
  assert.match(code, /no change-audit PASS marker/u);
  assert.match(code, /marker="\$marker_dir\/\$tree\.json"/u);
  // Nothing written: only a whole green verify emits facts, only record-pass
  // a marker.
  assert.doesNotMatch(code, /record-pass|repo-facts/u);
});

test("a code change runs verify's fast gates, stopped at the first red, which is named with the bypass", (t) => {
  const fixture = makeRepo({ change: "test/new.test.mjs" });
  t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
  mark(fixture.repo, fixture.tree, inAnHour());
  const green = runHook(fixture, SNOOPY_URL, fixture.refLine);
  assert.equal(green.exit, 0, green.stderr);
  assert.match(green.stderr, /change-class: code \(code; no screen changed\)/u);
  assert.deepEqual(fixture.ran(), CODE);
  fixture.reset();

  const refused = runHook(fixture, SNOOPY_URL, fixture.refLine, {
    FAKE_RED: "typecheck",
  });
  assert.equal(refused.exit, 1, "a red gate refuses the push");
  assert.match(refused.stderr, /change-class: typecheck is red/u);
  assert.match(refused.stderr, /git push --no-verify/u);
  assert.deepEqual(
    fixture.ran(),
    CODE.slice(0, CODE.indexOf("typecheck") + 1),
    "the gates after the red one did not run",
  );
});

test("a dependency change, or no origin/main to compare with, runs the full class: npm run verify, then the runtime npm audit", (t) => {
  for (const options of [{ change: "package.json" }, { origin: false }]) {
    const fixture = makeRepo(options);
    t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
    mark(fixture.repo, fixture.tree, inAnHour());
    const run = runHook(fixture, SNOOPY_URL, fixture.refLine);
    assert.equal(run.exit, 0, run.stderr);
    assert.match(run.stderr, /change-class: full/u);
    assert.deepEqual(fixture.ran(), FULL, JSON.stringify(options));
    fixture.reset();
    const red = runHook(fixture, SNOOPY_URL, fixture.refLine, {
      FAKE_RED: "audit",
    });
    assert.equal(red.exit, 1, "a red audit refuses the push");
  }
});

test("a classifier that fails runs the full class from the hook: never fail open", (t) => {
  const fixture = makeRepo({ classifier: "process.exit(3);\n" });
  t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
  mark(fixture.repo, fixture.tree, inAnHour());
  const run = runHook(fixture, SNOOPY_URL, fixture.refLine);
  assert.equal(run.exit, 0, run.stderr);
  assert.match(run.stderr, /the change classifier failed \(exit 3\)/u);
  assert.deepEqual(fixture.ran(), FULL);
  fixture.reset();
  const red = runHook(fixture, SNOOPY_URL, fixture.refLine, {
    FAKE_RED: "verify",
  });
  assert.equal(red.exit, 1);
  assert.match(red.stderr, /the full class is red/u);
  assert.deepEqual(fixture.ran(), ["verify"], "the audit did not run after it");
});

test("a skipped or todo contract test refuses the push, as CI's gates job does, and a run with none skipped passes (Round 21 hardening, W-5)", (t) => {
  for (const [summary, refused] of [
    ["# skipped 1\\n# todo 0", true],
    ["# skipped 0\\n# todo 2", true],
    ["# skipped 0\\n# todo 0", false],
  ]) {
    const fixture = makeRepo();
    t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
    mark(fixture.repo, fixture.tree, inAnHour());
    const run = runHook(fixture, SNOOPY_URL, fixture.refLine, {
      FAKE_TAP: `# tests 3\\n# pass 3\\n${summary}`,
    });
    if (refused) {
      assert.equal(run.exit, 1, summary);
      assert.match(run.stderr, /a contract test did not run/u);
      assert.match(run.stderr, /git push --no-verify/u);
    } else {
      assert.equal(run.exit, 0, summary);
    }
    assert.deepEqual(fixture.ran(), DOCS);
  }
});

test("a push from a linked worktree runs the gates without git's repository variables, so the gates' own git calls cannot touch this repository", (t) => {
  const fixture = makeRepo();
  t.after(() => rmSync(fixture.base, { recursive: true, force: true }));
  mark(fixture.repo, fixture.tree, inAnHour());
  const gitDir = git(fixture.repo, "rev-parse", "--absolute-git-dir");
  const pushed = runHook(fixture, SNOOPY_URL, fixture.refLine, {
    GIT_DIR: gitDir,
    GIT_WORK_TREE: fixture.repo,
  });
  assert.equal(pushed.exit, 0, pushed.stderr);
  for (const gate of DOCS.filter((name) => name !== "doc-references")) {
    const seen = join(fixture.base, `git-dir-${gate.replace(":", "-")}`);
    assert.equal(readFileSync(seen, "utf8"), "unset", `${gate} saw GIT_DIR`);
  }
});
