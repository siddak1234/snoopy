// The change-aware pre-push gate's classifier (scripts/change-class.mjs): each
// class, each rail to the full gate, the screen -> spec map, and the CI
// workflows the change leaves as they were (every pull request still runs the
// whole suite in all three engines).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  classify,
  describe,
  FIXTURE_ONLY,
  fixtureRunnerSpecs,
  parseNameStatus,
  SCREEN_SPECS,
  specsFor,
} from "../scripts/change-class.mjs";

const root = resolve(import.meta.dirname, "..");
const script = join(root, "scripts/change-class.mjs");
const read = (path) => readFileSync(join(root, path), "utf8");
const modified = (...paths) => paths.map((path) => ({ status: "M", path }));
const names = (plan) => plan.commands.map(({ argv }) => argv.join(" "));
const FAST = [
  "npm run format:check",
  "npm run check:docs",
  "npm run map -- --check",
  "npm run lint",
  "npm run typecheck",
  "npm run audit:boundaries",
  "npm run test:contracts",
  "npm run verify:platform-contracts",
];
const FULL = ["npm run verify", "npm audit --omit=dev --audit-level=high"];
const SPECS = readdirSync(join(root, "e2e")).filter((f) =>
  f.endsWith(".spec.ts"),
);

test("docs: Markdown alone runs the docs checks and the contract tests, with the no-skip check", () => {
  for (const path of ["README.md", "docs/ARCHITECTURE.md", "app/CLAUDE.md"]) {
    const plan = classify(modified(path));
    assert.equal(plan.class, "docs", path);
    assert.deepEqual(names(plan), [
      "npm run format:check",
      "npm run check:docs",
      "npm run map -- --check",
      "node scripts/audit-doc-references.mjs",
      "npm run test:contracts",
    ]);
    assert.ok(plan.commands.at(-1).noSkip, "skipped contract tests fail");
  }
  // A deleted doc is still a doc.
  assert.equal(classify([{ status: "D", path: "docs/old.md" }]).class, "docs");
  // No app code reads a Markdown file, so a docs change cannot reach a page.
  const reads = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(root, dir))) {
      const path = `${dir}/${name}`;
      if (statSync(join(root, path)).isDirectory()) walk(path);
      else if (
        /\.(ts|tsx|mjs|js)$/u.test(name) &&
        /\.md["'`]/u.test(read(path))
      )
        reads.push(path);
    }
  };
  for (const dir of ["app", "components", "hooks", "lib"]) walk(dir);
  assert.deepEqual(reads, []);
});

test("docs: Markdown in the kit, CI or the copied contracts takes the full gate", () => {
  for (const path of [
    ".claude/agents/x.md",
    ".github/x.md",
    "scripts/kit/x.md",
    "lib/generated/x.md",
  ]) {
    const plan = classify(modified(path));
    assert.equal(plan.class, "full", path);
    assert.deepEqual(names(plan), FULL);
  }
});

test("code: a mapped screen runs the fast gates, the build and its mapped specs only", () => {
  const plan = classify(modified("app/account/flows/page.tsx"));
  assert.equal(plan.class, "code");
  assert.deepEqual(names(plan), [
    ...FAST,
    "npm run build",
    "npm run test:browser:fixtures",
  ]);
  assert.deepEqual(specsFor("app/account/flows/page.tsx"), [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "flow-items.spec.ts",
    "health-data.spec.ts",
    "public-edge-fixture.spec.ts",
  ]);
  const build = plan.commands.find(({ name }) => name === "build");
  assert.deepEqual(build.env, {
    BACKEND_API_ORIGIN: "https://backend.invalid",
  });
  assert.ok(build.rewrite, "the /api/platform rewrite is asserted");
  assert.ok(plan.skipped.includes("test:browser"));
  assert.match(describe(plan), /^change-class: code/u);
  assert.match(describe(plan), /skip npm audit/u);

  const marketing = classify(modified("app/(marketing)/solutions/page.tsx"));
  const browser = marketing.commands.find(
    ({ name }) => name === "test:browser",
  );
  assert.deepEqual(browser.argv, [
    "npm",
    "run",
    "test:browser",
    "--",
    "e2e/accessibility.spec.ts",
    "e2e/marketing.visual.spec.ts",
  ]);
  assert.deepEqual(browser.env, {
    CI: "1",
    BACKEND_API_ORIGIN: "https://backend.invalid",
  });
  assert.ok(browser.noSkippedBrowser);
  assert.ok(!names(marketing).includes("npm run test:browser:fixtures"));
});

test("code: a shared component, a layout or an unmapped route runs every browser spec", () => {
  for (const path of [
    "components/x.tsx",
    "lib/platform-api.ts",
    "hooks/x.ts",
    "public/x.svg",
    "proxy.ts",
    "instrumentation.ts",
    "app/globals.css",
    "app/layout.tsx",
    "app/account/flows/[subscriptionId]/layout.tsx",
    "app/account/error.tsx",
    "app/(auth)/account-deleted/page.tsx",
    "app/api/health/route.ts",
  ]) {
    const plan = classify(modified(path));
    assert.equal(plan.class, "code", path);
    assert.deepEqual(
      names(plan),
      [
        ...FAST,
        "npm run build",
        "npm run test:browser",
        "npm run test:browser:fixtures",
      ],
      path,
    );
  }
});

test("code: a changed spec runs itself, and a fixture spec the whole fixture suite; a contract test runs no browser", () => {
  const dialogs = classify(modified("e2e/dialogs.spec.ts"));
  assert.deepEqual(names(dialogs), [
    ...FAST,
    "npm run build",
    "npm run test:browser:fixtures",
  ]);
  const visual = classify(modified("e2e/marketing.visual.spec.ts"));
  assert.ok(
    names(visual).includes(
      "npm run test:browser -- e2e/marketing.visual.spec.ts",
    ),
  );
  const contract = classify([
    { status: "A", path: "test/new.test.mjs" },
    ...modified("README.md"),
  ]);
  assert.equal(contract.class, "code");
  assert.deepEqual(names(contract), [
    ...FAST.slice(0, 3),
    "node scripts/audit-doc-references.mjs",
    ...FAST.slice(3),
  ]);
});

test("full: every rail, a deletion, an unknown path, an empty change, an error and --full take npm run verify and the runtime npm audit", () => {
  for (const path of [
    "package.json",
    "package-lock.json",
    ".npmrc",
    ".nvmrc",
    "Dockerfile",
    "compose.yml",
    ".dockerignore",
    "playwright.config.ts",
    "eslint.config.mjs",
    "tsconfig.json",
    "next.config.ts",
    "e2e/helpers.ts",
    "e2e/fixtures/public-edge.ts",
    "test/blocks-harness.mjs",
    "test/spacing-baseline.json",
    ".github/workflows/ci.yml",
    "scripts/githooks/pre-push",
    "scripts/install-git-hooks.sh",
    "scripts/change-class.mjs",
    "test/change-class.test.mjs",
    "scripts/verify.mjs",
    "scripts/kit/map.mjs",
    ".claude/hooks/guard.mjs",
    "lib/generated/x.ts",
    "platform-requirement.json",
    "foo.txt",
  ]) {
    const plan = classify(modified("README.md", "app/x.tsx", path));
    assert.equal(plan.class, "full", path);
    assert.deepEqual(names(plan), FULL, path);
    assert.match(
      plan.reason,
      new RegExp(path.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"),
    );
  }
  // Each rail is its own reason, not only the unknown-path fallback.
  for (const [path, rail] of [
    ["package.json", /a dependency file/u],
    ["package-lock.json", /a dependency file/u],
    ["Dockerfile", /the image/u],
    ["playwright.config.ts", /the test tooling/u],
    ["e2e/fixtures/public-edge.ts", /the test tooling/u],
    [".github/workflows/ci.yml", /CI or the git hooks/u],
    ["scripts/githooks/pre-push", /CI or the git hooks/u],
    ["scripts/change-class.mjs", /this classifier/u],
    ["test/change-class.test.mjs", /this classifier/u],
    ["lib/generated/x.ts", /the platform contracts/u],
    [".claude/agents/x.md", /the kit/u],
    ["scripts/verify.mjs", /the gates and tooling/u],
  ]) {
    assert.match(classify(modified(path)).reason, rail, path);
  }
  assert.match(
    classify([{ status: "D", path: "app/x.tsx" }]).reason,
    /deleted or renamed/u,
  );
  assert.match(classify([]).reason, /no changed file/u);
  assert.match(classify([null]).reason, /^classifier error/u);
  assert.equal(classify(modified("README.md"), { full: true }).class, "full");
  assert.match(describe(classify([], {})), /run {2}npm audit --omit=dev/u);
});

test("the command line: --files and --range classify, a renamed file is a deletion, and a bad argument or a missing origin/main falls back to full", (t) => {
  const plan = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  assert.match(plan("--files", "README.md").stdout, /^change-class: docs/u);
  assert.match(
    plan("--range", "HEAD..HEAD").stdout,
    /^change-class: full \(no changed file/u,
  );
  const bogus = plan("--bogus");
  assert.equal(bogus.status, 0);
  assert.match(bogus.stdout, /^change-class: full \(classifier error/u);

  const repo = mkdtempSync(join(tmpdir(), "change-class-"));
  t.after(() => rmSync(repo, { recursive: true, force: true }));
  const git = (...args) =>
    spawnSync(
      "git",
      ["-C", repo, "-c", "user.email=t@t", "-c", "user.name=t", ...args],
      {
        encoding: "utf8",
      },
    );
  git("init", "-q");
  writeFileSync(join(repo, "a.tsx"), "one\n");
  git("add", ".");
  git("commit", "-q", "-m", "one");
  git("mv", "a.tsx", "b.tsx");
  git("commit", "-q", "-m", "two");
  const output = spawnSync(
    "git",
    ["-C", repo, "diff", "--name-status", "--no-renames", "-z", "HEAD^..HEAD"],
    {
      encoding: "utf8",
    },
  ).stdout;
  const entries = parseNameStatus(output);
  assert.deepEqual(entries, [
    { status: "D", path: "a.tsx" },
    { status: "A", path: "b.tsx" },
  ]);
  assert.equal(classify(entries).class, "full");

  // A head git cannot resolve: the merge-base fails, and the class is full.
  const lonely = spawnSync(
    process.execPath,
    [script, "--head", "no-such-ref"],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
  assert.match(lonely.stdout, /^change-class: full \(classifier error/u);
});

test("the screen -> spec map names specs that exist, and every spec runs in some suite the classifier can call", () => {
  for (const [screen, specs] of Object.entries(SCREEN_SPECS)) {
    assert.ok(existsSync(join(root, screen)), `${screen} exists`);
    for (const spec of specs) {
      assert.ok(SPECS.includes(spec), `${screen} -> ${spec} exists`);
    }
  }
  // The fixture-only list is playwright.config.ts's.
  const config = read("playwright.config.ts");
  const block = config.slice(
    config.indexOf("const fixtureOnly"),
    config.indexOf("const notCollected"),
  );
  assert.deepEqual(
    [...block.matchAll(/\/([\w.-]+)\\\.spec\\\.ts\//gu)].map(
      (m) => `${m[1].replaceAll("\\", "")}.spec.ts`,
    ),
    FIXTURE_ONLY,
  );
  // Every spec is collected by test:browser (not fixture-only) or run by the
  // fixture runner, which "every spec" runs whole.
  const runner = fixtureRunnerSpecs();
  for (const spec of FIXTURE_ONLY) assert.ok(runner.includes(spec), spec);
  for (const spec of SPECS) {
    assert.ok(
      !FIXTURE_ONLY.includes(spec) || runner.includes(spec),
      `${spec} is reachable`,
    );
  }
  // Every spec named by some screen, or by a shared path's "every".
  assert.equal(specsFor("components/x.tsx"), "every");
});

// A screen key's route: "app/(marketing)/contact/" -> "/contact",
// "app/account/page.tsx" -> "/account". Keys that name one file of a screen
// (TodayTiles.tsx) have no route of their own.
const routeOf = (key) => {
  if (!key.endsWith("/") && !key.endsWith("/page.tsx")) return undefined;
  const path = key
    .replace(/^app\//u, "")
    .replace(/(page\.tsx|\/)$/u, "")
    .split("/")
    .filter((segment) => segment && !/^\(.*\)$/u.test(segment))
    .join("/");
  return `/${path}`;
};

test("each public spec is mapped from every screen it opens", () => {
  // The public specs open routes by literal (accessibility.spec.ts's and
  // marketing.visual.spec.ts's route lists, connection-callback.spec.ts's
  // goto). The screen that serves each route must name the spec, or a change
  // to that screen would skip it. Fixture specs run as one suite.
  const keys = Object.keys(SCREEN_SPECS).filter((key) => routeOf(key));
  let checked = 0;
  for (const spec of SPECS.filter((spec) => !FIXTURE_ONLY.includes(spec))) {
    const routes = [
      ...read(`e2e/${spec}`).matchAll(/["'`](\/[\w\-/]*)[?"'`]/gu),
    ].map((m) => m[1]);
    assert.ok(routes.length > 0, `${spec} opens a route`);
    for (const route of new Set(routes)) {
      const key = keys
        .filter((key) => {
          const base = routeOf(key);
          return (
            route === base || (base !== "/" && route.startsWith(`${base}/`))
          );
        })
        .sort((a, b) => routeOf(b).length - routeOf(a).length)[0];
      assert.ok(key, `${spec}: ${route} is served by a mapped screen`);
      assert.ok(
        SCREEN_SPECS[key].includes(spec),
        `${key} (${route}) names ${spec}`,
      );
      checked += 1;
    }
  }
  assert.ok(checked >= 13, `${checked} routes checked`);
});

test("unchanged: CI runs the whole suite on every pull request in three engines, scans both dependency trees, and main and nightly call it", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /^on:\n {2}pull_request:\n {2}workflow_call:\n/mu);
  assert.doesNotMatch(ci, /paths(-ignore)?:/u, "no paths filter");
  assert.match(ci, /project: \[chromium, firefox, webkit\]/u);
  assert.match(ci, /run: npm audit --omit=dev --audit-level=high/u);
  assert.match(ci, /run: npm audit --audit-level=high/u);
  for (const caller of ["main.yml", "nightly.yml"]) {
    assert.match(
      read(`.github/workflows/${caller}`),
      /uses: \.\/\.github\/workflows\/ci\.yml/u,
      caller,
    );
  }
  // The full class is verify's whole list (test/verify-gate.test.mjs keeps it
  // equal to the change audit's), and the change audit is untouched.
  assert.match(read("scripts/verify.mjs"), /name: "test:browser:fixtures"/u);
  assert.match(read("scripts/audit/run-gates.mjs"), /const docsOnly =/u);
});
