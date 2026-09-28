// What the website's two gate runners share — `npm run verify`
// (scripts/verify.mjs) and the change audit's runner (run-gates.mjs) — in one
// module, so the two cannot drift apart (register F24). Both build into .next
// and serve on 3001 and 3443, so they also hold one lock: running them at once
// is refused rather than left to memory.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

// Playwright's web server (playwright.config.ts) and the fixture edge
// (scripts/run-browser-fixtures.mjs) take these.
const SERVER_PORTS = [3001, 3443];
// Every address a stale server could hold while it answers the suites at
// 127.0.0.1: the gates' own servers bind 127.0.0.1; a standalone server.js with
// no HOSTNAME binds 0.0.0.0; `next dev` and `next start` with no --hostname take
// Node's default, `::`. All three are asked because a BSD kernel (macOS), under
// the SO_REUSEADDR Node sets, refuses a bind only on the exact address held;
// Linux refuses across them, so there the extra asks cost nothing.
const SERVER_ADDRESSES = ["127.0.0.1", "0.0.0.0", "::"];

/**
 * Refuses a clone that cannot give an honest answer, then holds the lock until
 * this process exits. `ports` exists for the contract tests, which plant a
 * listener on a port of their own rather than touch the servers'.
 */
export async function preflight({ root, fail, ports = SERVER_PORTS }) {
  refuseConflictCopies(root, fail);
  await refuseBusyPorts(ports, fail);
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
// instead of this tree's build. Asked by binding the port, which the kernel
// answers whoever holds it: lsof 4.95 lists no socket for the process Next
// renames `next-server (v16.3.3)`, so asking lsof let a live standalone server
// on 3001 through (register F61).
async function refuseBusyPorts(ports, fail) {
  for (const port of ports) {
    for (const host of SERVER_ADDRESSES) {
      const code = await bindAndRelease(port, host);
      if (code === "EADDRINUSE") {
        fail(
          `port ${port} is in use (a bind to ${host} was refused); stop whatever holds it first`,
        );
      } else if (code && code !== "EAFNOSUPPORT" && code !== "EADDRNOTAVAIL") {
        // An address family this machine lacks (no IPv6) is one no server can
        // hold either. Anything else leaves the question unanswered, and an
        // unanswered question is not a free port.
        fail(`could not ask whether port ${port} is free on ${host}: ${code}`);
      }
    }
  }
}

// Resolves once the port is released again — the next address's bind must not
// collide with this one — with the bind's error code, or null when it was free.
function bindAndRelease(port, host) {
  return new Promise((settle) => {
    const server = createServer();
    server.once("error", (error) => settle(error.code ?? error.message));
    server.listen({ port, host }, () => server.close(() => settle(null)));
  });
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
