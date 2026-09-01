// The Claude PreToolUse push gate, tested hermetically: every case runs
// against a throwaway git repo passed as CLAUDE_PROJECT_DIR, so no test can
// touch this repository's real audit markers.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const hook = resolve(
  import.meta.dirname,
  "../scripts/hooks/require-change-audit.mjs",
);

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "audit-hook-"));
  git(dir, "init", "-q");
  git(
    dir,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "one",
  );
  return dir;
}

function runHook(repo, command, cwd = repo) {
  const run = spawnSync("node", [hook], {
    encoding: "utf8",
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: repo },
  });
  return { exit: run.status, stderr: run.stderr };
}

function markerPath(repo, tree) {
  const gitDir = git(repo, "rev-parse", "--absolute-git-dir");
  mkdirSync(join(gitDir, "autom8x-audit"), { recursive: true });
  return join(gitDir, "autom8x-audit", `${tree}.json`);
}

test("push gate: command shapes", (t) => {
  const repo = makeRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));

  assert.equal(runHook(repo, "npm run lint").exit, 0, "non-push allows");
  assert.equal(
    runHook(repo, "git stash push -m wip").exit,
    0,
    "stash push allows",
  );
  assert.equal(
    runHook(repo, "git push --delete origin old").exit,
    0,
    "deletion push allows",
  );
  assert.equal(
    runHook(repo, 'git commit -m "do not push yet"').exit,
    0,
    "the word push inside a message is not a push",
  );
  assert.equal(
    runHook(repo, "git push", "/").exit,
    0,
    "push outside any repo allows",
  );

  const blocked = runHook(repo, "git push -u origin feature");
  assert.equal(blocked.exit, 2, "unaudited push blocks");
  assert.match(blocked.stderr, /no PASS marker/);
  assert.equal(
    runHook(repo, "gh pr merge 7 --squash").exit,
    2,
    "gh pr merge blocks too",
  );
});

test("push gate: marker lifecycle", (t) => {
  const repo = makeRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const tree = git(repo, "rev-parse", "HEAD^{tree}");

  const marker = (overrides = {}) => ({
    tree,
    baseline_origin_main_sha: null,
    expires_at: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  });

  writeFileSync(markerPath(repo, tree), JSON.stringify(marker()));
  assert.equal(runHook(repo, "git push").exit, 0, "valid marker allows");

  writeFileSync(
    markerPath(repo, tree),
    JSON.stringify(
      marker({ expires_at: new Date(Date.now() - 1000).toISOString() }),
    ),
  );
  const expired = runHook(repo, "git push");
  assert.equal(expired.exit, 2, "expired marker blocks");
  assert.match(expired.stderr, /expired/);

  // Pin origin/main: a marker recorded against a baseline that has since
  // moved must block, and a tree identical to origin/main needs no marker.
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(
    repo,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "two",
  );
  const newTree = git(repo, "rev-parse", "HEAD^{tree}");
  assert.equal(newTree, tree, "an empty commit keeps the tree");
  assert.equal(
    runHook(repo, "git push").exit,
    0,
    "tree identical to origin/main allows without a marker",
  );

  const divergent = mkdtempSync(join(tmpdir(), "audit-hook-div-"));
  t.after(() => rmSync(divergent, { recursive: true, force: true }));
  git(divergent, "init", "-q");
  git(
    divergent,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "base",
  );
  git(divergent, "update-ref", "refs/remotes/origin/main", "HEAD");
  const divergentMain = git(divergent, "rev-parse", "origin/main");
  writeFileSync(join(divergent, "f.txt"), "x");
  git(divergent, "add", "f.txt");
  git(
    divergent,
    "-c",
    "user.email=t@t",
    "-c",
    "user.name=t",
    "commit",
    "-q",
    "-m",
    "change",
  );
  const divergentTree = git(divergent, "rev-parse", "HEAD^{tree}");
  writeFileSync(
    markerPath(divergent, divergentTree),
    JSON.stringify({
      tree: divergentTree,
      baseline_origin_main_sha: "0000000000000000000000000000000000000000",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
  const moved = spawnSync("node", [hook], {
    encoding: "utf8",
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "git push" },
      cwd: divergent,
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: divergent },
  });
  assert.equal(
    moved.status,
    2,
    "marker with a stale origin/main baseline blocks",
  );
  assert.match(moved.stderr, /origin\/main has moved/);
  writeFileSync(
    markerPath(divergent, divergentTree),
    JSON.stringify({
      tree: divergentTree,
      baseline_origin_main_sha: divergentMain,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
  const current = spawnSync("node", [hook], {
    encoding: "utf8",
    input: JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "git push" },
      cwd: divergent,
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: divergent },
  });
  assert.equal(
    current.status,
    0,
    "marker pinned to the current baseline allows",
  );
});
