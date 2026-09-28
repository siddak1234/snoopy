// What the website's two gate runners share — `npm run verify`
// (scripts/verify.mjs) and the change audit's runner (run-gates.mjs) — in one
// module, so the two cannot drift apart (register F24). Both build into .next
// and serve on 3001 and 3443, so they also hold one lock: running them at once
// is refused rather than left to memory.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Refuses a clone that cannot give an honest answer, then holds the lock until
 * this process exits.
 */
export function preflight({ root, fail }) {
  refuseConflictCopies(root, fail);
  refuseListeners(fail);
  holdLock(root, fail);
}

// macOS/iCloud Finder conflict copies ("file 2.ts") are invisible to git (the
// repository's own `* 2.*` ignore rule) yet poison typecheck, the test glob and
// the visual baselines. Both patterns: "file 2.ts" AND the dotless "pre-push 2",
// which dodged the ignore rule and reached a commit before an audit caught it.
function refuseConflictCopies(root, fail) {
  const copies = spawnSync(
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
  if (copies) {
    fail(
      `Finder conflict copies contaminate the clone (invisible to git, they poison the gates):\n${copies}\nDelete them and re-run:\n  find . -path ./node_modules -prune -o -name '* 2.*' -print -delete`,
    );
  }
}

// A stale dev or test server on either port would answer the browser suites
// instead of this tree's build.
function refuseListeners(fail) {
  for (const port of [3001, 3443]) {
    const listeners = spawnSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"],
      { encoding: "utf8" },
    );
    if (listeners.status === 0 && listeners.stdout.trim()) {
      fail(`port ${port} has a listener; stop it first:\n${listeners.stdout}`);
    }
  }
}

// Acquired atomically — `wx` refuses an existing file — so two runs started in
// the same instant cannot both pass: the loser reads the winner's pid (register
// F25). A stale lock is cleared once: a dead pid, or an empty or garbled file,
// which must never count as live — pid 0 would signal this process's own group
// and "succeed", wedging every later run.
function holdLock(root, fail) {
  const auditDir = join(root, ".git/autom8x-audit");
  const lockPath = join(auditDir, "lock");
  mkdirSync(auditDir, { recursive: true });

  const acquire = (retry) => {
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
      if (retry) return acquire(false);
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
    acquire(false);
  };
  acquire(true);

  process.on("exit", () => {
    try {
      rmSync(lockPath);
    } catch {
      /* already gone */
    }
  });
  process.on("SIGINT", () => process.exit(130));
  process.on("SIGTERM", () => process.exit(143));
}

/**
 * Mirrors the CI build job: a build without the /api/platform rewrite exits 0
 * while every browser API call would 404 in production.
 */
export function assertPlatformRewrite(root) {
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
