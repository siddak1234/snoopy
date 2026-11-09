// The change-aware pre-push gate: which of the website's gates a change needs,
// from the files it changes (Round 21, the owner's go of 2026-11-09).
// It prints the class, the reason, the commands and what it skips FIRST, then
// (with --run) runs them in order and stops at the first red. Three classes:
//
// - full: `npm run verify` and the runtime dependency audit CI's scan runs
//   (.github/workflows/ci.yml, "Audit runtime dependencies"). Any rail below,
//   a deleted or renamed file that is not Markdown, any path this file does not
//   know, an empty change and any error of its own: it never fails open.
// - docs: Markdown only (outside .claude/ and .github/; no app code reads one):
//   format, the docs and map checks, the document-reference check and the
//   contract tests, which hold the records and kit tests.
// - code: verify's fast gates (format, docs, map, lint, types, boundaries, the
//   contract tests, the platform contracts) and the browser specs mapped to the
//   screens the change touches (SCREEN_SPECS), or every browser spec when the
//   mapping is unsure: layouts, shared components, lib, hooks, public assets.
//
// CI stays the authority: every pull request runs the whole suite in all three
// engines (ci.yml has no paths filter), and the change audit
// (scripts/audit/run-gates.mjs) and its marker are unchanged. Usage:
//
//   node scripts/change-class.mjs [--head <sha>]... [--worktree] [--run] [--full]
//   node scripts/change-class.mjs --range <A..B> | --files <path>...
//
// With no --range or --files the change is merge-base(origin/main, head)..head
// for each --head (HEAD by default), plus, with --worktree, what is staged,
// unstaged or untracked. Exit: 0 green (or a plan printed), 10 a red gate;
// anything else is this script failing, and the pre-push hook then runs the
// full class itself.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
export const RED_EXIT = 10;
const BUILD_ORIGIN = "https://backend.invalid";

// A path that always takes the whole gate: dependencies and the image, the
// contracts, the kit, CI and the hooks, and the test tooling.
const RAILS = [
  [
    /^(package\.json|package-lock\.json|\.npmrc|\.nvmrc)$/u,
    "a dependency file",
  ],
  [/^(Dockerfile|compose\.ya?ml|\.dockerignore)$/u, "the image"],
  [
    /^(lib\/generated\/|platform-requirement\.json$|scripts\/[^/]*platform-contracts[^/]*$|scripts\/backend-contract\.mjs$)/u,
    "the platform contracts",
  ],
  [/^(\.claude\/|scripts\/kit\/)/u, "the kit"],
  [
    /^(\.github\/|scripts\/githooks\/|scripts\/install-git-hooks\.sh$)/u,
    "CI or the git hooks",
  ],
  [
    /^(playwright\.config\.ts|eslint\.config\.mjs|tsconfig\.json|\.prettierrc\.json|\.prettierignore|next\.config\.ts|postcss\.config\.mjs|e2e\/helpers\.ts)$/u,
    "the test tooling",
  ],
  [
    /^(e2e\/fixtures\/|test\/[^/]*harness[^/]*\.mjs$|test\/[^/]*\.json$)/u,
    "the test tooling",
  ],
  [
    /^(scripts\/change-class\.mjs|test\/change-class\.test\.mjs)$/u,
    "this classifier",
  ],
  [/^scripts\//u, "the gates and tooling"],
];

const CODE = [
  /^(app|components|hooks|public)\//u,
  /^lib\/(?!generated\/)/u,
  /^(proxy|instrumentation)\.ts$/u,
  /^test\/[^/]+\.test\.mjs$/u,
  /^e2e\/[^/]+\.spec\.ts$/u,
];

// The specs that need the fixture Edge (playwright.config.ts's fixtureOnly):
// only scripts/run-browser-fixtures.mjs runs them, and only all together.
export const FIXTURE_ONLY = [
  "public-edge-fixture.spec.ts",
  "account-surfaces.spec.ts",
  "dialogs.spec.ts",
  "flow-items.spec.ts",
  "health-data.spec.ts",
  "ehr-connect.spec.ts",
  "accessibility-authenticated.spec.ts",
  "keyboard-journey.spec.ts",
];

// SCREEN -> SPEC: a screen's files (a route directory, or one file) -> the
// specs that open it, from the routes their goto( calls and route lists name.
// The longest matching key wins. A path under app/ no key matches, and any
// layout, template, error or not-found file, runs every spec.
const ACCOUNT_HOME = [
  "accessibility-authenticated.spec.ts",
  "account-surfaces.spec.ts",
  "dialogs.spec.ts",
  "ehr-connect.spec.ts",
  "flow-items.spec.ts",
  "health-data.spec.ts",
  "keyboard-journey.spec.ts",
  "public-edge-fixture.spec.ts",
];
const MARKETING = ["accessibility.spec.ts", "marketing.visual.spec.ts"];
export const SCREEN_SPECS = {
  "app/(marketing)/page.tsx": [
    ...MARKETING,
    "account-surfaces.spec.ts",
    "flow-items.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/(marketing)/solutions/": MARKETING,
  "app/(marketing)/contact/": [...MARKETING, "account-surfaces.spec.ts"],
  "app/(marketing)/automation-builder/": [
    ...MARKETING,
    "account-surfaces.spec.ts",
  ],
  "app/(marketing)/privacy/": [...MARKETING, "public-edge-fixture.spec.ts"],
  "app/(marketing)/terms/": [...MARKETING, "public-edge-fixture.spec.ts"],
  "app/(auth)/login/": [
    "accessibility.spec.ts",
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/page.tsx": ACCOUNT_HOME,
  "app/account/TodayTiles.tsx": ACCOUNT_HOME,
  "app/account/YourFlows.tsx": ACCOUNT_HOME,
  "app/account/home-flows.ts": ACCOUNT_HOME,
  "app/account/approvals/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/billing/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/connections/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "ehr-connect.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/flows/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "flow-items.spec.ts",
    "health-data.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/organization/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "health-data.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/runs/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "flow-items.spec.ts",
    "health-data.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/settings/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/share/": [
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/account/support/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
  ],
  "app/account/teams/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "dialogs.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/onboarding/setup-org/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/onboarding/join-org/": [
    "accessibility-authenticated.spec.ts",
    "account-surfaces.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
  "app/connections/": [
    "account-surfaces.spec.ts",
    "connection-callback.spec.ts",
    "public-edge-fixture.spec.ts",
  ],
};
const SHARED_APP_FILE =
  /\/(layout|template|error|global-error|not-found|loading|default)\.tsx?$/u;

const HARD_RAIL = /^(\.claude|\.github|scripts\/kit|lib\/generated)\//u;
const isDocs = (path) =>
  path.endsWith(".md") && !/^(\.claude|\.github)\//u.test(path);
const rail = (path) => RAILS.find(([pattern]) => pattern.test(path))?.[1];
const isCode = (path) => CODE.some((pattern) => pattern.test(path));

/** The specs one code path needs: a list, or "every". */
export function specsFor(path) {
  if (/^test\//u.test(path)) return [];
  if (/^e2e\//u.test(path)) return [path.slice("e2e/".length)];
  if (!path.startsWith("app/") || SHARED_APP_FILE.test(`/${path}`)) {
    return "every";
  }
  const key = Object.keys(SCREEN_SPECS)
    .filter((candidate) =>
      candidate.endsWith("/") ? path.startsWith(candidate) : path === candidate,
    )
    .sort((a, b) => b.length - a.length)[0];
  return key ? SCREEN_SPECS[key] : "every";
}

const npm = (name, extra = {}) => ({
  name,
  argv: ["npm", "run", name, ...(extra.args ?? [])],
  ...extra,
});
const contracts = npm("test:contracts", { capture: true, noSkip: true });

const FULL = [
  { name: "verify", argv: ["npm", "run", "verify"] },
  {
    name: "npm audit",
    argv: ["npm", "audit", "--omit=dev", "--audit-level=high"],
  },
];

/**
 * entries: [{ status: "A"|"M"|"D"|"R"|..., path }]. Returns the class, why,
 * the commands in order and what is skipped. Never throws.
 */
export function classify(entries, { full = false } = {}) {
  try {
    if (full) return fullClass("--full asked for the whole gate");
    if (entries.length === 0) {
      return fullClass("no changed file was found: the safe default");
    }
    let docs = false;
    let code = false;
    for (const { status, path } of entries) {
      // Markdown is docs, but for the kit's, CI's and the copied contracts'.
      const why = rail(path);
      if (why && (!isDocs(path) || HARD_RAIL.test(path))) {
        return fullClass(`${path}: ${why}`);
      }
      if (/^[DR]/u.test(status) && !path.endsWith(".md")) {
        return fullClass(`${path}: deleted or renamed`);
      }
      if (isDocs(path)) docs = true;
      else if (isCode(path)) code = true;
      else return fullClass(`${path}: a path this classifier does not know`);
    }
    return code ? codeClass(entries, docs) : docsClass();
  } catch (error) {
    return fullClass(`classifier error: ${error.message}`);
  }
}

function fullClass(reason) {
  return {
    class: "full",
    reason,
    commands: FULL,
    skipped: [],
  };
}

function docsClass() {
  return {
    class: "docs",
    reason: "Markdown only",
    commands: [
      npm("format:check"),
      npm("check:docs"),
      npm("map", { args: ["--", "--check"] }),
      {
        name: "doc-references",
        argv: ["node", "scripts/audit-doc-references.mjs"],
      },
      contracts,
    ],
    skipped: [
      "lint, typecheck, audit:boundaries, verify:platform-contracts",
      "the builds and both browser suites",
      "npm audit (no dependency file changed; CI's scan runs it)",
    ],
  };
}

function codeClass(entries, docs) {
  let every = false;
  const specs = new Set();
  for (const { path } of entries) {
    if (isDocs(path)) continue;
    const found = specsFor(path);
    if (found === "every") every = true;
    else for (const spec of found) specs.add(spec);
  }
  const commands = [
    npm("format:check"),
    npm("check:docs"),
    npm("map", { args: ["--", "--check"] }),
    ...(docs
      ? [
          {
            name: "doc-references",
            argv: ["node", "scripts/audit-doc-references.mjs"],
          },
        ]
      : []),
    npm("lint"),
    npm("typecheck"),
    npm("audit:boundaries"),
    contracts,
    npm("verify:platform-contracts"),
  ];
  const skipped = [
    "build:no-backend and probe:no-backend (CI's build job runs them)",
    "npm audit (no dependency file changed; CI's scan runs it)",
  ];
  const publicSpecs = [...specs].filter((s) => !FIXTURE_ONLY.includes(s));
  const fixtureSpecs = [...specs].filter((s) => FIXTURE_ONLY.includes(s));
  const browserEnv = { CI: "1", BACKEND_API_ORIGIN: BUILD_ORIGIN };
  if (every || specs.size > 0) {
    commands.push(
      npm("build", {
        env: { BACKEND_API_ORIGIN: BUILD_ORIGIN },
        rewrite: true,
      }),
    );
  }
  if (every) {
    commands.push(
      npm("test:browser", { env: browserEnv, noSkippedBrowser: true }),
      npm("test:browser:fixtures"),
    );
  } else {
    if (publicSpecs.length > 0) {
      commands.push(
        npm("test:browser", {
          args: ["--", ...publicSpecs.map((s) => `e2e/${s}`)],
          env: browserEnv,
          noSkippedBrowser: true,
        }),
      );
    }
    if (fixtureSpecs.length > 0) commands.push(npm("test:browser:fixtures"));
    if (specs.size === 0) skipped.push("the build and both browser suites");
    else {
      if (publicSpecs.length === 0) skipped.push("test:browser");
      if (fixtureSpecs.length === 0) skipped.push("test:browser:fixtures");
      skipped.push("browser specs no changed screen maps to");
    }
  }
  return {
    class: "code",
    reason: every
      ? "code; a shared or unmapped path, so every browser spec"
      : specs.size > 0
        ? `code; the specs its screens map to: ${[...specs].join(", ")}`
        : "code; no screen changed",
    commands,
    skipped,
  };
}

// --- input -------------------------------------------------------------------

function git(...args) {
  const run = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (run.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${run.stderr.trim()}`);
  }
  return run.stdout;
}

/** `git diff --name-status -z` output -> entries (renames as D + A). */
export function parseNameStatus(output) {
  const tokens = output.split("\0").filter(Boolean);
  const entries = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    entries.push({ status: tokens[i], path: tokens[i + 1] });
  }
  return entries;
}

const diff = (...range) =>
  parseNameStatus(git("diff", "--name-status", "--no-renames", "-z", ...range));

export function parseArgs(argv) {
  const options = { heads: [], files: null, range: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--run") options.run = true;
    else if (arg === "--full") options.full = true;
    else if (arg === "--worktree") options.worktree = true;
    else if (arg === "--head") options.heads.push(argv[++i]);
    else if (arg === "--range") options.range = argv[++i];
    else if (arg === "--files") {
      options.files = argv.slice(i + 1);
      break;
    } else throw new Error(`unknown argument ${arg}`);
  }
  return options;
}

function changedEntries(options) {
  if (options.files) {
    return options.files.map((path) => ({ status: "M", path }));
  }
  if (options.range) return diff(options.range);
  const entries = [];
  for (const head of options.heads.length ? options.heads : ["HEAD"]) {
    const base = git("merge-base", "origin/main", head).trim();
    entries.push(...diff(`${base}..${head}`));
  }
  if (options.worktree) {
    entries.push(...diff("HEAD"));
    for (const path of git("ls-files", "--others", "--exclude-standard", "-z")
      .split("\0")
      .filter(Boolean)) {
      entries.push({ status: "A", path });
    }
  }
  return entries;
}

// --- output and run ------------------------------------------------------------

const show = ({ argv, env }) =>
  [
    ...Object.entries(env ?? {}).map(([key, value]) => `${key}=${value}`),
    ...argv,
  ].join(" ");

export function describe(plan) {
  return [
    `change-class: ${plan.class} (${plan.reason})`,
    ...plan.commands.map((command) => `change-class: run  ${show(command)}`),
    ...plan.skipped.map((what) => `change-class: skip ${what}`),
    "change-class: CI runs the whole suite, in all three engines, on the pull request.",
  ].join("\n");
}

async function run(plan) {
  if (plan.commands.some(({ name }) => /^(build|test:browser)/u.test(name))) {
    // The builds and the browser suites hold verify's lock and ports.
    const { preflight } = await import("./audit/preflight.mjs");
    await preflight({
      root,
      fail: (message) => {
        console.error(`change-class: ${message}`);
        process.exit(RED_EXIT);
      },
    });
  }
  const checks = await import("./audit/preflight.mjs");
  const started = Date.now();
  for (const command of plan.commands) {
    const begun = Date.now();
    const result = spawnSync(command.argv[0], command.argv.slice(1), {
      cwd: root,
      stdio: command.capture ? ["inherit", "pipe", "inherit"] : "inherit",
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ...(command.env ?? {}) },
    });
    if (command.capture && result.stdout) process.stdout.write(result.stdout);
    let red = result.status !== 0;
    if (!red) {
      try {
        if (command.noSkip) checks.assertNoSkippedTests(result.stdout ?? "");
        if (command.rewrite) checks.assertPlatformRewrite(root);
        if (command.noSkippedBrowser) checks.assertNoSkippedBrowserTests(root);
      } catch (error) {
        console.error(`change-class: ${error.message}`);
        red = true;
      }
    }
    const seconds = Math.round((Date.now() - begun) / 1000);
    if (red) {
      console.error(
        `change-class: ${command.name} is red (${seconds}s) — refused. Fix it, or bypass deliberately with git push --no-verify.`,
      );
      return RED_EXIT;
    }
    console.error(`change-class: ${command.name} ok (${seconds}s)`);
  }
  console.error(
    `change-class: the ${plan.class} gates are green (${Math.round((Date.now() - started) / 1000)}s)`,
  );
  return 0;
}

async function main(argv) {
  let options = {};
  let plan;
  try {
    options = parseArgs(argv);
    plan = classify(changedEntries(options), options);
  } catch (error) {
    plan = fullClass(`classifier error: ${error.message}`);
  }
  console.log(describe(plan));
  if (!options.run && !argv.includes("--run")) return 0;
  return run(plan);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exit(await main(process.argv.slice(2)));
}

// For the tests: the list scripts/run-browser-fixtures.mjs runs.
export function fixtureRunnerSpecs() {
  const source = readFileSync(
    resolve(root, "scripts/run-browser-fixtures.mjs"),
    "utf8",
  );
  return [...source.matchAll(/"e2e\/([^"]+\.spec\.ts)"/gu)].map((m) => m[1]);
}
