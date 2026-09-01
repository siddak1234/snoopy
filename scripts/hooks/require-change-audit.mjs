// PreToolUse gate for Claude Code sessions: blocks a `git push` (or
// `gh pr merge`) of this repository until scripts/audit/record-pass.mjs has
// recorded a valid PASS marker for the exact tree being pushed.
//
// Contract: reads the tool-call JSON on stdin; exit 0 allows the call,
// exit 2 blocks it and feeds stderr back to the session as the reason.
// Over-blocking is acceptable (one rephrase); silent under-blocking is not —
// invoker-agnostic coverage is scripts/githooks/pre-push's job.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function block(message) {
  console.error(message);
  process.exit(2);
}

let input;
try {
  input = JSON.parse(readStdin());
} catch {
  process.exit(0);
}
if (input?.tool_name !== "Bash") process.exit(0);
const command = String(input.tool_input?.command ?? "");

// "push" must follow "git" directly (flags allowed between) — matching the
// words anywhere over-blocks wildly: a commit message or echoed JSON that
// merely CONTAINS "push" is not a push. src:dst refspec subtleties are the
// native pre-push hook's job (it sees the real pushed SHAs).
const isGhMerge = /\bgh\s+pr\s+merge\b/.test(command);
const isGitPush =
  /\bgit(?:\s+-C\s+\S+|\s+-c\s+\S+|\s+--?[\w-]+(?:=\S+)?)*\s+push\b/.test(
    command,
  ) && !/\bstash\s+push\b/.test(command);
if (!isGhMerge && !isGitPush) process.exit(0);
if (isGitPush && /--delete\b/.test(command)) process.exit(0);

// Scope to this repository only: a push in snoopy-backend (or anywhere else)
// is not this gate's business. The target repo is the -C argument if the
// command carries one, else the session's cwd.
const cDir = command.match(/\bgit\s+-C\s+(?:"([^"]+)"|'([^']+)'|(\S+))/);
const targetDir =
  cDir?.[1] ?? cDir?.[2] ?? cDir?.[3] ?? input.cwd ?? process.cwd();
const projectDir = process.env.CLAUDE_PROJECT_DIR;
if (!projectDir) process.exit(0);
let toplevel;
try {
  toplevel = git(targetDir, "rev-parse", "--show-toplevel");
} catch {
  process.exit(0);
}
try {
  if (realpathSync(toplevel) !== realpathSync(projectDir)) process.exit(0);
} catch {
  process.exit(0);
}

// Beyond this point the push targets THIS repo: verification errors fail
// closed — a gate that fails open on error is not a gate.
const tree = git(toplevel, "rev-parse", "HEAD^{tree}");
let baselineTree = null;
let originMain = null;
try {
  originMain = git(toplevel, "rev-parse", "origin/main");
  baselineTree = git(toplevel, "rev-parse", "origin/main^{tree}");
} catch {
  /* no origin/main — fall through to the marker requirement */
}
if (baselineTree !== null && tree === baselineTree) process.exit(0); // nothing new ships

const gitDir = git(toplevel, "rev-parse", "--absolute-git-dir");
const markerPath = join(gitDir, "autom8x-audit", `${tree}.json`);
if (!existsSync(markerPath)) {
  block(
    `Change audit required: no PASS marker for tree ${tree}. Run /audit-change first.`,
  );
}
let marker;
try {
  marker = JSON.parse(readFileSync(markerPath, "utf8"));
} catch {
  block(
    `Change audit: the marker for tree ${tree} is unreadable. Re-run /audit-change.`,
  );
}
if (new Date(marker.expires_at).getTime() < Date.now()) {
  block(
    `Change audit: the PASS marker for tree ${tree} expired ${marker.expires_at}. Re-run /audit-change.`,
  );
}
if (originMain !== null && marker.baseline_origin_main_sha !== originMain) {
  block(
    "Change audit: origin/main has moved since this tree was audited. Fetch, rebase if needed, and re-run /audit-change.",
  );
}
process.exit(0);
