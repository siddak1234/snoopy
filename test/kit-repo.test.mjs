import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * The common kit as this repository wires it (AGENTS.md "Docs always updated";
 * the kit's own tests are scripts/kit/kit.test.mjs, run through
 * test/kit.test.mjs): the map is current, the docs map is sound and the router
 * within its limit, the hooks are named in the settings beside the change
 * audit's, the kit's files are tracked and left unformatted, and every runner
 * the standard names runs the docs check and the map's.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const node = (...args) =>
  spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });

test("docs/MAP.md is what npm run map builds from this tree", () => {
  const run = node("scripts/kit/map.mjs", "--check");
  assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
});

test("the docs map is sound and the router within its limit — AGENTS.md, since CLAUDE.md is only @AGENTS.md", () => {
  assert.equal(read("CLAUDE.md"), "@AGENTS.md\n");
  const run = node("scripts/kit/check-docs.mjs", "--map-only", "--json");
  const result = JSON.parse(run.stdout);
  assert.deepEqual(result.problems, []);
  assert.equal(run.status, 0);
});

test("the wrapper runs the kit's own tests in test:contracts, whose glob does not reach scripts/kit/", () => {
  assert.equal(
    read("test/kit.test.mjs"),
    'import "../scripts/kit/kit.test.mjs";\n',
  );
});

test("the settings name the kit's three hooks and keep both change-audit entries", () => {
  const { hooks } = JSON.parse(read(".claude/settings.json"));
  const kit = (file) => `node "$CLAUDE_PROJECT_DIR/.claude/hooks/${file}"`;
  const audit = hooks.PreToolUse.find((entry) => entry.matcher === "Bash");
  assert.deepEqual(
    audit.hooks.map((hook) => [hook.if, hook.command]),
    [
      [
        "Bash(git *)",
        'node "$CLAUDE_PROJECT_DIR/scripts/hooks/require-change-audit.mjs"',
      ],
      [
        "Bash(gh pr merge*)",
        'node "$CLAUDE_PROJECT_DIR/scripts/hooks/require-change-audit.mjs"',
      ],
    ],
  );
  const guard = hooks.PreToolUse.find(
    (entry) => entry.matcher === "Bash|Write|Edit|NotebookEdit",
  );
  assert.deepEqual(guard.hooks, [
    { type: "command", command: kit("guard.mjs"), timeout: 5 },
  ]);
  for (const [event, file] of [
    ["SessionStart", "session-start.mjs"],
    ["Stop", "stop-check.mjs"],
    ["SubagentStop", "stop-check.mjs"],
  ]) {
    assert.deepEqual(
      hooks[event],
      [{ hooks: [{ type: "command", command: kit(file), timeout: 10 }] }],
      event,
    );
  }
});

test("every kit file is tracked, never ignored, and neither formatted nor linted here", () => {
  const list = /export const KIT_FILES = \[([^\]]+)\]/u.exec(
    read("scripts/kit/kit.test.mjs"),
  );
  assert.ok(list, "scripts/kit/kit.test.mjs no longer lists KIT_FILES");
  const files = [...list[1].matchAll(/'([^']+)'/gu)].map((m) => m[1]);
  assert.ok(files.length >= 11, `KIT_FILES yielded ${files.length}`);
  for (const file of files) {
    // --no-index: the patterns alone, as a new kit file meets them before it
    // is ever added; a tracked file would pass the plain check regardless.
    const args = ["check-ignore", "-q", "--no-index", file];
    const ignored = spawnSync("git", args, { cwd: root });
    assert.equal(ignored.status, 1, `${file} is ignored by git`);
  }
  const prettier = read(".prettierignore").split("\n");
  const eslint = read("eslint.config.mjs");
  for (const folder of [".claude/hooks/", "scripts/kit/"]) {
    assert.ok(prettier.includes(folder), `.prettierignore lacks ${folder}`);
    assert.match(
      eslint,
      new RegExp(
        `globalIgnores\\(\\[[^\\]]*"${folder.replace(/[./]/gu, "\\$&")}"`,
        "u",
      ),
      `eslint.config.mjs does not ignore ${folder}`,
    );
  }
});

test("npm runs the kit's docs check and map, and CI's gates job runs both on the pull request's commits", () => {
  const { scripts } = JSON.parse(read("package.json"));
  assert.equal(scripts["check:docs"], "node scripts/kit/check-docs.mjs");
  assert.equal(scripts.map, "node scripts/kit/map.mjs");
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("gates:"));
  assert.ok(job, "CI has no gates job");
  assert.match(
    job,
    /^ {4}env:\n(?: {6}#.*\n)* {6}DOCS_BASE: origin\/\$\{\{ github\.base_ref \|\| 'main' \}\}$/mu,
  );
  assert.match(job, /^ {10}fetch-depth: 0$/mu);
  assert.match(job, /^ {6}- run: npm run check:docs$/mu);
  assert.match(job, /^ {6}- run: npm run map -- --check$/mu);
});
