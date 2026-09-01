// The native pre-push gate, tested hermetically against throwaway repos —
// driven exactly as git drives it: remote name + url as args, ref lines on
// stdin.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const hook = resolve(import.meta.dirname, "../scripts/githooks/pre-push");
const SNOOPY_URL = "https://github.com/siddak1234/snoopy.git";
const ZERO = "0000000000000000000000000000000000000000";

function git(cwd, ...args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(run.status, 0, `git ${args.join(" ")}: ${run.stderr}`);
  return run.stdout.trim();
}

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), "pre-push-"));
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

function runHook(repo, url, lines) {
  const run = spawnSync("sh", [hook, "origin", url], {
    cwd: repo,
    encoding: "utf8",
    input: lines,
  });
  return { exit: run.status, stderr: run.stderr };
}

test("native pre-push gate", (t) => {
  const repo = makeRepo();
  t.after(() => rmSync(repo, { recursive: true, force: true }));
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
  assert.match(blocked.stderr, /no change-audit PASS marker/);

  const gitDir = git(repo, "rev-parse", "--absolute-git-dir");
  mkdirSync(join(gitDir, "autom8x-audit"), { recursive: true });
  writeFileSync(
    join(gitDir, "autom8x-audit", `${tree}.json`),
    JSON.stringify({
      tree,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    }),
  );
  assert.equal(
    runHook(repo, SNOOPY_URL, refLine).exit,
    0,
    "a marked tree passes",
  );

  writeFileSync(
    join(gitDir, "autom8x-audit", `${tree}.json`),
    JSON.stringify({
      tree,
      expires_at: "2000-01-01T00:00:00.000Z",
    }),
  );
  const expired = runHook(repo, SNOOPY_URL, refLine);
  assert.equal(expired.exit, 1, "an expired marker blocks");
  assert.match(expired.stderr, /expired/);

  rmSync(join(gitDir, "autom8x-audit", `${tree}.json`));
  git(repo, "update-ref", "refs/remotes/origin/main", "HEAD");
  assert.equal(
    runHook(repo, SNOOPY_URL, refLine).exit,
    0,
    "a tree identical to origin/main needs no marker",
  );
});
