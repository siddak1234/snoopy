import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

import { DOCUMENTS } from "../scripts/verify-deployed-contracts.mjs";

/**
 * The structure the register asked for (backend BUILD-PLAN 22.3, 22.4) — each
 * one a thing that was true once and drifted, so each is held here rather than
 * remembered.
 */

const read = (path) => readFileSync(path, "utf8");

function sources(directory) {
  const found = [];
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(ts|tsx)$/u.test(entry)) found.push(path);
  }
  return found;
}
const appAndComponents = [...sources("app"), ...sources("components")];

test("no failure renders Next's own error page (register F26)", () => {
  for (const file of ["app/error.tsx", "app/global-error.tsx"]) {
    assert.ok(existsSync(file), `${file} is missing`);
    assert.match(
      read(file),
      /^"use client";/u,
      `${file} must be a client component`,
    );
    assert.match(
      read(file),
      /retry: \(\) => void/u,
      `${file} takes Next 16's retry`,
    );
  }
  // global-error replaces the root layout, so it brings its document and styles.
  const global = read("app/global-error.tsx");
  assert.match(global, /<html lang="en"/u);
  assert.match(global, /import "\.\/globals\.css";/u);
});

test("one empty-row component, not a private copy per page (register F29)", () => {
  for (const file of appAndComponents) {
    assert.doesNotMatch(
      read(file),
      /^function (?:Empty|EmptyRow)\(/mu,
      `${file} defines its own empty row`,
    );
  }
  assert.ok(existsSync("components/dashboard/EmptyRow.tsx"));
});

test("a whole page with nothing on it is the app's empty screen, and a section stays one line (register F29, the owner's build 9)", () => {
  const row = read("components/dashboard/EmptyRow.tsx");
  // Without a title, one line in a band like every other (`GROUP_BAND`;
  // ~~`py-5`~~ until Round 21's v2).
  assert.match(
    row,
    /if \(!title\) \{\s*return \(\s*<div className=\{GROUP_BAND\}>\s*<p className="text-sm text-\[var\(--muted\)\]">\{text\}<\/p>\s*<\/div>\s*\);\s*\}/u,
  );
  // With one: the icon, decorative, then the title, its line and the action.
  assert.match(row, /<span\s+aria-hidden/u);
  for (const [page, title] of [
    ["app/account/teams/page.tsx", "No departments yet"],
    ["app/account/runs/page.tsx", "No activity yet"],
    ["app/account/approvals/page.tsx", "Nothing needs review"],
    // The catalog with nothing to add (the owner's build 10).
    ["app/account/flows/page.tsx", "No flows to add yet"],
  ]) {
    assert.match(
      read(page),
      new RegExp(
        `<EmptyRow\\s+icon=\\{<\\w+Icon size=\\{32\\} />\\}\\s+title="${title}"`,
        "u",
      ),
      page,
    );
  }
});

test("the destructive action is a Button variant (register F43)", () => {
  assert.match(read("components/ui/Button.tsx"), /danger: "btn-danger"/u);
  assert.match(read("app/globals.css"), /^\.btn-danger \{/mu);
  const dialog = read("components/account/DeleteAccountButton.tsx");
  assert.equal((dialog.match(/variant="danger"/gu) ?? []).length, 2);
  assert.doesNotMatch(
    dialog,
    /error-border-strong/u,
    "no hand-written copy of the style",
  );
});

/**
 * Every button a file draws, parsed: its words (its text, and the strings it
 * picks between — never a nested element's), its `variant`, its classes (every
 * string a class expression can give), the source of its `onClick`, and the
 * classes of each element around it in the same file.
 */
function buttons(path) {
  const source = ts.createSourceFile(
    path,
    read(path),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const strings = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    )
      return [node.text];
    if (
      ts.isJsxElement(node) ||
      ts.isJsxSelfClosingElement(node) ||
      ts.isJsxFragment(node)
    )
      return [];
    // A block, not an expression: forEachChild stops at a truthy return.
    const found = [];
    ts.forEachChild(node, (child) => {
      found.push(...strings(child));
    });
    return found;
  };
  const attribute = (opening, name) => {
    const found = opening.attributes.properties.find(
      (property) =>
        ts.isJsxAttribute(property) && property.name.getText(source) === name,
    );
    return found?.initializer ?? null;
  };
  const classes = (opening) => {
    const value = attribute(opening, "className");
    return value ? strings(value).join(" ") : "";
  };
  const found = [];
  const visit = (node, around) => {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement;
      const tag = opening.tagName.getText(source);
      if (tag === "button" || tag === "Button") {
        const variant = attribute(opening, "variant");
        found.push({
          tag,
          words: node.children
            .flatMap((child) =>
              ts.isJsxText(child)
                ? [child.text]
                : ts.isJsxExpression(child)
                  ? strings(child)
                  : [],
            )
            .map((words) => words.trim())
            .filter(Boolean),
          variant: variant && ts.isStringLiteral(variant) ? variant.text : null,
          className: classes(opening),
          onClick:
            attribute(opening, "onClick")?.expression?.getText(source) ?? null,
          around,
        });
      }
      const own = classes(opening);
      ts.forEachChild(node, (child) =>
        visit(child, own ? [...around, own] : around),
      );
      return;
    }
    ts.forEachChild(node, (child) => visit(child, around));
  };
  visit(source, []);
  return found;
}

const named = (path, words) =>
  buttons(path).filter((button) => button.words.includes(words));

// Drawn red as a button: the danger variant, or its class on a plain button.
const isDanger = (button) =>
  button.tag === "Button"
    ? button.variant === "danger"
    : /(?:^|\s)btn-danger(?:\s|$)/u.test(button.className);
// Drawn red as a word: the error text, and every text colour it sets — at rest
// or hovered — an error token, so it never turns grey under the pointer.
const isErrorText = (button) => {
  const colours = [
    ...button.className.matchAll(
      /(?:^|\s)(?:hover:)?text-\[var\(--([a-z0-9-]+)\)\]/gu,
    ),
  ].map((match) => match[1]);
  return (
    colours.includes("error-text") &&
    colours.every((colour) => colour.startsWith("error-"))
  );
};

test("every action that removes or ends something is red, on its page and in its confirm — the danger variant on a button, the error text on a word, never under a dim (the owner's build 12, #5; register F85)", () => {
  // Each file, the words, and how each button with those words is drawn, in
  // the order the file draws them: the page's button, then its confirm.
  for (const [path, words, drawn] of [
    ["app/account/flows/AutomationActions.tsx", "Archive flow", ["danger"]],
    ["app/account/flows/AutomationActions.tsx", "Archive", ["danger"]],
    [
      "app/account/runs/[runId]/CancelRunButton.tsx",
      "Cancel run",
      ["danger", "danger"],
    ],
    [
      "components/dashboard/LeaveProjectButton.tsx",
      "Leave department",
      ["text", "danger"],
    ],
    ["components/dashboard/DeleteProjectButton.tsx", "Delete", ["text"]],
    [
      "components/account/LinkedAccountsSection.tsx",
      "Unlink",
      ["danger", "danger"],
    ],
    [
      "app/account/connections/ConnectionsPanel.tsx",
      "Disconnect",
      ["danger", "danger"],
    ],
    ["components/dashboard/ProjectMemberList.tsx", "Leave", ["text"]],
    ["components/dashboard/ProjectMemberList.tsx", "Remove", ["text"]],
    ["components/dashboard/OrgMemberList.tsx", "Remove", ["text"]],
    ["components/dashboard/OrgMemberList.tsx", "Remove member", ["danger"]],
    ["components/dashboard/OrgDomainSection.tsx", "Revoke", ["text"]],
    [
      "components/account/DeleteAccountButton.tsx",
      "Delete Account",
      ["danger"],
    ],
    ["components/dashboard/AccountTopBar.tsx", "Sign out", ["danger"]],
    ["components/marketing/MarketingNav.tsx", "Sign out", ["text"]],
    ["components/navigation/MobileNavMenu.tsx", "Sign out", ["text"]],
    // An approval's Deny (Build 24, P6): the danger variant, the owner's
    // call for the Approve and Deny pair — ~~Reject, secondary~~ until then.
    ["app/account/approvals/ApprovalDecision.tsx", "Deny", ["danger"]],
  ]) {
    const found = named(path, words);
    assert.deepEqual(
      found.map((button) =>
        isDanger(button) ? "danger" : isErrorText(button) ? "text" : "plain",
      ),
      drawn,
      `${path}: "${words}"`,
    );
    for (const button of found) {
      assert.ok(
        button.around.every((around) => !/(?:^|\s)opacity-\d/u.test(around)),
        `${path}: "${words}" sits under a dimmed element`,
      );
    }
  }
});

test("what can be undone keeps its colour: Pause, Reject, Deny and Cancel request stay as they were, and Withdraw's confirm is the accent (the owner's build 12, #5)", () => {
  for (const [path, words, variant, className] of [
    ["app/account/flows/AutomationActions.tsx", "Pause", "secondary", null],
    [
      "components/dashboard/OrgJoinRequestList.tsx",
      "Reject",
      "secondary",
      null,
    ],
    ["components/dashboard/TeamAccessRequests.tsx", "Deny", "secondary", null],
    [
      "app/onboarding/join-org/JoinOrgForm.tsx",
      "Cancel request",
      "secondary",
      null,
    ],
  ]) {
    const found = named(path, words);
    assert.equal(found.length, 1, `${path}: "${words}"`);
    const [button] = found;
    assert.equal(button.variant, variant, `${path}: "${words}"`);
    if (className)
      assert.match(
        button.className,
        new RegExp(`(?:^|\\s)${className}(?:\\s|$)`, "u"),
        `${path}: "${words}"`,
      );
    assert.doesNotMatch(button.className, /danger|--error-/u, path);
  }
  // Withdraw asks again any time: its confirm is Button's default, the accent
  // outline, and its trigger the muted word it was.
  const withdraw = buttons("components/dashboard/ConfirmRemoveButton.tsx");
  const confirm = withdraw.filter((button) => button.onClick === "confirm");
  assert.equal(confirm.length, 1);
  assert.equal(confirm[0].tag, "Button");
  assert.equal(confirm[0].variant, null);
  assert.doesNotMatch(
    read("components/dashboard/ConfirmRemoveButton.tsx"),
    /danger|--error-/u,
  );
  assert.ok(
    withdraw.some(
      (button) =>
        button.tag === "button" &&
        button.className.includes("text-[var(--muted)]"),
    ),
    "the Withdraw trigger is the muted word it was",
  );
});

test("a danger button keeps AA contrast hovered: its text takes the hover step on the stronger tint (register F85)", () => {
  // Hovered on a dark surface, --error-text on --error-bg-strong computes to
  // 4.45:1; --error-text-hover keeps it at 6.49:1, and 4.99:1 on a light card.
  // The browser test measures it from pixels.
  assert.match(
    read("app/globals.css"),
    /^\.btn-danger:hover \{\s*background: var\(--error-bg-strong\);\s*color: var\(--error-text-hover\);\s*\}/mu,
  );
});

test("no dead focus utility — the global :focus-visible rule decides (register F44)", () => {
  // `app/globals.css` sets :focus-visible unlayered, and Tailwind v4 emits
  // utilities in `@layer utilities`, so an unlayered rule always wins: the
  // utility never applied anywhere, and code that says it does misleads.
  assert.doesNotMatch(read("app/globals.css"), /@layer/u);
  assert.match(read("app/globals.css"), /^:focus-visible \{/mu);
  for (const file of appAndComponents) {
    assert.doesNotMatch(read(file), /focus-visible:outline-none/u, file);
  }
});

test("one refusal, one alert, in the connections dialogs (register F52)", () => {
  const panel = read("app/account/connections/ConnectionsPanel.tsx");
  // A connect's answer is said under its own row; each dialog carries its own
  // alert, and nothing repeats it outside (Build 21: the one connection row).
  assert.match(
    panel,
    /\{failed \? \(\s*<p\s+role="alert"[^>]*>\s*\{rowError\.message\}/u,
  );
  assert.equal(
    (panel.match(/<FormError message=\{error\} \/>/gu) ?? []).length,
    1,
  );
  assert.match(
    panel,
    /<FormError\s+message=\{disconnectError\}\s+className=\{SPACING\.inner\.top\}\s+\/>/u,
  );
  assert.doesNotMatch(panel, /<FormError message=\{error\} className=/u);
  // The vendor page has one refusal line under its rows, and no dialog.
  const vendor = read(
    "app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx",
  );
  assert.equal(
    (vendor.match(/<FormError /gu) ?? []).length,
    1,
    "the vendor page says a refused save once",
  );
  assert.doesNotMatch(vendor, /<Modal\b/u);
});

test("a problem's title is rendered only when it is a non-empty string (register F41)", () => {
  assert.match(
    read("lib/platform-api.ts"),
    /typeof body\.title === "string" &&\s*body\.title\.length > 0/u,
  );
});

test("every sign-in return is built by loginHref (register F42)", () => {
  for (const file of [...appAndComponents, "proxy.ts"]) {
    assert.doesNotMatch(
      read(file),
      /["'`]\/login\?callbackUrl=/u,
      `${file} builds a sign-in return by hand`,
    );
  }
  assert.match(
    read("proxy.ts"),
    /loginHref\(`\$\{request\.nextUrl\.pathname\}\$\{request\.nextUrl\.search\}`\)/u,
  );
});

test("no link or redirect points at the removed builder (register F53)", () => {
  for (const file of [...appAndComponents, "next.config.ts"]) {
    assert.doesNotMatch(
      read(file),
      /account\/builder|%2Faccount%2Fbuilder/u,
      file,
    );
  }
});

test("no route or facade that nothing calls (BUILD-PLAN 22.4.6)", () => {
  assert.ok(
    !existsSync("app/api/session/route.ts"),
    "/api/session has no caller",
  );
  assert.doesNotMatch(
    read("lib/tenancy.ts"),
    /export async function getProject\(/u,
  );
});

test('every account page has its small-screen title, not "Dashboard" (register F56)', () => {
  const nav = read("components/dashboard/DashboardNav.tsx");
  const titled = new Set(
    [...nav.matchAll(/^\s+"(\/account[^"]*)": "[^"]+",$/gmu)].map((m) => m[1]),
  );
  const linked = [
    ...[...nav.matchAll(/\{ href: "(\/account[^"]*)", label:/gu)].map(
      (m) => m[1],
    ),
    "/account/organization",
  ];
  for (const href of linked)
    assert.ok(titled.has(href), `${href} has no title`);
});

test("every launch configuration runs a script that exists (register F13)", () => {
  const scripts = JSON.parse(read("package.json")).scripts;
  const { configurations } = JSON.parse(read(".claude/launch.json"));
  for (const { name, runtimeExecutable, runtimeArgs } of configurations) {
    if (runtimeExecutable !== "npm" || runtimeArgs[0] !== "run") continue;
    assert.ok(runtimeArgs[1] in scripts, `${name} runs a missing script`);
  }
});

test("one Node everywhere — .nvmrc's exact version in CI, its major in the image and package.json engines (register F17; Round 21 hardening, PIN-8)", () => {
  // .nvmrc names one exact Node (the setup-node cache otherwise keeps
  // whichever 22.x a runner has), and every setup-node reads it: no workflow
  // names a version of its own.
  const pinned = read(".nvmrc").trim();
  assert.match(pinned, /^\d+\.\d+\.\d+$/u, ".nvmrc names an exact version");
  const major = pinned.split(".")[0];
  for (const file of [
    ".github/workflows/ci.yml",
    ".github/workflows/main.yml",
  ]) {
    const workflow = read(file);
    assert.doesNotMatch(workflow, /node-version: /u, `${file} names a Node`);
    const setups = [
      ...workflow.matchAll(
        /- uses: actions\/setup-node@\S+.*\n {8}with:\n((?: {10}.*\n?)+)/gu,
      ),
    ];
    assert.ok(setups.length > 0, `${file} sets up no Node`);
    for (const [, inputs] of setups) {
      assert.match(inputs, /^ {10}node-version-file: \.nvmrc$/mu, file);
    }
  }
  for (const from of read("Dockerfile").matchAll(/^FROM node:(\d+)/gmu)) {
    assert.equal(from[1], major, "Dockerfile");
  }
  // Vercel builds production on `engines.node`, over its own project setting
  // (24.x today): the range ">=22" let it build on 24 while CI, the image and
  // .nvmrc were on 22. Exactly this major, as Vercel spells it.
  assert.equal(
    JSON.parse(read("package.json")).engines.node,
    `${major}.x`,
    "package.json engines",
  );
});

test("all-green needs every other CI job, runs whatever they did, and passes only when each succeeded (register F88)", () => {
  // The ruleset will require this one check in place of four job names, so a
  // job left out of its needs, or a result it lets through, is a gate lost.
  const ci = read(".github/workflows/ci.yml");
  const jobs = ci
    .slice(ci.indexOf("\njobs:\n"))
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .slice(1);
  const ids = jobs.map((job) => job.slice(0, job.indexOf(":")));
  const allGreen = jobs.find((job) => job.startsWith("all-green:"));
  assert.ok(allGreen, "CI has no all-green job");
  assert.match(
    allGreen,
    /^ {4}if: always\(\)$/mu,
    "a failure upstream must not skip it",
  );
  const needs = /^ {4}needs:\n((?: {6}- [\w-]+\n)+)/mu.exec(allGreen);
  assert.ok(needs, "all-green names no needs list");
  assert.deepEqual(
    [...needs[1].matchAll(/- ([\w-]+)/gu)].map((m) => m[1]).sort(),
    ids.filter((id) => id !== "all-green").sort(),
  );
  // Only "success" passes: a skipped job is a gate that did not run.
  assert.match(allGreen, /\.result != "success"/u);
});

test("every CI job in the Playwright image runs with a HOME that root owns (register F58)", () => {
  // A container job's HOME is /github/home, owned by the image's pwuser, and
  // Firefox will not start as root under it: CI's Firefox failed to launch
  // while every local run of the same image, with HOME=/root, passed.
  const jobs = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .slice(1);
  const inImage = jobs.filter((job) =>
    job.includes("image: mcr.microsoft.com/playwright:"),
  );
  assert.ok(inImage.length > 0, "no CI job runs in the Playwright image");
  for (const job of inImage) {
    assert.match(job, /^ {4}env:\n {6}HOME: \/root$/mu, job.split("\n")[0]);
  }
});

test("the fixture suite runs one engine per CI leg: every Playwright project, each leg its own, none stopped by another's failure (register F90)", () => {
  // Run in series in one job, the three engines were 13-14 of the run's 15-16
  // minutes. A project missing from the matrix is an engine CI no longer
  // tests; a leg without `--project` is the series again, three times over.
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("fixtures:"));
  assert.ok(job, "CI has no fixtures job");
  const matrix =
    /^ {4}strategy:\n {6}fail-fast: false\n {6}matrix:\n {8}project: \[([^\]]+)\]$/mu.exec(
      job,
    );
  assert.ok(
    matrix,
    "the fixtures job is not a fail-fast: false matrix over project",
  );
  const projects = [
    ...read("playwright.config.ts").matchAll(/^ +(?:\{ )?name: "([a-z]+)"/gmu),
  ].map((m) => m[1]);
  assert.deepEqual(
    matrix[1]
      .split(",")
      .map((name) => name.trim())
      .sort(),
    projects.sort(),
  );
  // Each leg is named by its engine, or the three read as one job.
  assert.match(job, /^ {4}name: .*\$\{\{ matrix\.project \}\}/mu);
  assert.match(
    job,
    /^ {6}- run: npm run test:browser:fixtures -- --project=\$\{\{ matrix\.project \}\}$/mu,
  );
});

test("the fixture legs leave out exactly the accessibility tests the browser job already runs — the public routes but /login, and the ghost buttons — and the browser job runs them all (register F91)", () => {
  // Twelve tests of e2e/accessibility.spec.ts ran in the browser job and again
  // in each fixture leg, on pages that read the same against the fixture as
  // against no backend. The runner's --grep-invert must take exactly those:
  // one it lets through runs twice again; /login, an authenticated baseline or
  // another spec's test taken is a scan only the fixture can make, gone. What
  // the pattern takes is read from Playwright itself (`--list --grep`), not
  // from a model of its titles: the pattern's first draft matched a title shape
  // Playwright does not use, and took nothing.
  const runner = read("scripts/run-browser-fixtures.mjs");
  const declared = /^const browserJobOnly =\s*String\.raw`([^`]+)`;$/mu.exec(
    runner,
  );
  assert.ok(declared, "the runner declares no browserJobOnly pattern");
  assert.match(
    runner,
    /"--workers=1",\n(?: {6}\/\/.*\n)* {6}"--grep-invert",\n {6}browserJobOnly,\n/u,
    "the runner does not hand the pattern to Playwright as --grep-invert",
  );
  const invocation = runner.slice(
    runner.indexOf('"node_modules/@playwright/test/cli.js"'),
    runner.indexOf('"--workers=1"'),
  );
  const specs = [...invocation.matchAll(/"(e2e\/[^"]+\.spec\.ts)"/gu)].map(
    (match) => match[1],
  );

  // What the legs leave out, as Playwright lists it: `--grep` with the same
  // pattern lists exactly what `--grep-invert` drops (one title string, one
  // matcher). No browser and no build: a listing only. AUTOM8X_WEBKIT=1: the
  // legs are CI's, where WebKit runs too (register F104), so the pattern is
  // read in all three engines on any machine.
  let listing;
  try {
    listing = execFileSync(
      process.execPath,
      [
        "node_modules/@playwright/test/cli.js",
        "test",
        ...specs,
        "--list",
        "--reporter=list",
        "--grep",
        declared[1],
      ],
      {
        encoding: "utf8",
        env: { ...process.env, CI: "1", AUTOM8X_WEBKIT: "1" },
      },
    );
  } catch (error) {
    // "No tests found" exits 1; what it printed is the listing.
    listing = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  const taken = [
    ...listing.matchAll(/^\s+\[([^\]]+)\] › (\S+?):\d+:\d+ › (.+)$/gmu),
  ]
    .map((match) => `${match[1]} › ${basename(match[2])} › ${match[3]}`)
    .sort();

  // What they should leave out: the spec's own public routes but /login, and
  // its ghost buttons in both themes, in every project — so a route or button
  // added to the spec is held to the pattern too.
  const spec = read("e2e/accessibility.spec.ts");
  const quoted = (block) =>
    [...block.matchAll(/"([^"]*)"/gu)].map((match) => match[1]);
  const publicRoutes = quoted(
    /const publicRoutes = \[([^\]]+)\]/u.exec(spec)[1],
  );
  const ghostButtons = [
    .../const ghostButtons = \[([\s\S]+?)\] as const;/u
      .exec(spec)[1]
      .matchAll(/\["([^"]+)", "([^"]+)"\]/gu),
  ].map((match) => [match[1], match[2]]);
  const templates = [...spec.matchAll(/test\(\s*`([^`]+)`/gu)].map(
    (match) => match[1],
  );
  const publicTitle = templates.find(
    (template) =>
      template.includes("${route}") && !template.includes("${name}"),
  );
  const ghostTitle = templates.find((template) => template.includes("${name}"));
  assert.ok(
    publicRoutes.includes("/login") &&
      ghostButtons.length > 0 &&
      publicTitle &&
      ghostTitle,
    "the spec's lists or titles moved",
  );
  const fill = (template, values) =>
    template.replace(/\$\{(\w+)\}/gu, (_, name) => values[name]);
  const projects = [
    ...read("playwright.config.ts").matchAll(/^ +(?:\{ )?name: "([a-z]+)"/gmu),
  ].map((match) => match[1]);
  const expected = projects
    .flatMap((project) => [
      ...publicRoutes
        .filter((route) => route !== "/login")
        .map(
          (route) =>
            `${project} › accessibility.spec.ts › ${fill(publicTitle, { route })}`,
        ),
      ...["dark", "light"].flatMap((theme) =>
        ghostButtons.map(
          ([route, name]) =>
            `${project} › accessibility.spec.ts › ${fill(ghostTitle, { route, name, theme })}`,
        ),
      ),
    ])
    .sort();
  assert.deepEqual(taken, expected);

  // And the browser job still runs every one of them: `playwright test`, no grep.
  const browser = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("browser:"));
  assert.ok(browser, "CI has no browser job");
  assert.match(browser, /^ {6}- run: npm run test:browser$/mu);
  assert.equal(
    JSON.parse(read("package.json")).scripts["test:browser"],
    "playwright test",
  );
});

test("CI's contract tests read the whole history, so a struck document path is checked, not skipped", () => {
  // `scripts/audit-doc-references.mjs` believes a strike only for a file a
  // commit once added; in a one-commit clone every strike reads "not checked".
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("gates:"));
  assert.ok(job, "CI has no gates job");
  assert.match(job, /^ {10}npm run test:contracts \| tee /mu);
  assert.match(
    job,
    /- uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n(?: {8}#.*\n)*? {8}with:\n {10}fetch-depth: 0$/mu,
  );
});

test("every action is pinned by commit with its version, the image's base by digest with its tag, and Dependabot moves them weekly (Round 21 hardening, PIN-1..3, PIN-7, PIN-9)", () => {
  // A tag is a promise its owner can rewrite; a commit is not. The comment is
  // the version that commit is, and the line Dependabot rewrites with it.
  for (const file of readdirSync(".github/workflows")) {
    const workflow = read(`.github/workflows/${file}`);
    for (const [line, ref] of workflow.matchAll(
      /^\s+(?:- )?uses: (\S+.*)$/gmu,
    )) {
      if (ref.startsWith("./")) continue;
      assert.match(
        ref,
        /^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/u,
        `${file}: ${line.trim()}`,
      );
    }
  }
  const froms = [...read("Dockerfile").matchAll(/^FROM (\S+)/gmu)].map(
    (m) => m[1],
  );
  assert.ok(froms.length > 0, "the Dockerfile has no FROM");
  for (const from of froms) {
    assert.match(from, /^node:[\w.-]+@sha256:[0-9a-f]{64}$/u, from);
  }
  const dependabot = read(".github/dependabot.yml");
  for (const ecosystem of ["github-actions", "docker"]) {
    assert.match(
      dependabot,
      new RegExp(
        `- package-ecosystem: ${ecosystem}\\n {4}directory: /\\n {4}schedule:\\n {6}interval: weekly\\n`,
        "u",
      ),
      ecosystem,
    );
  }
  // No npm version updates: the website's dependency bumps are a deliberate
  // step each round (backend §12.1 #278).
  assert.deepEqual(
    [...dependabot.matchAll(/^ {2}- package-ecosystem: (\S+)$/gmu)].map(
      (m) => m[1],
    ),
    ["github-actions", "docker"],
  );
  // The image's Node major is .nvmrc's (the test above), so Dependabot never
  // offers a new one: that pull request would sit red, and hold the one slot
  // the digest's refresh needs.
  const docker = dependabot.slice(
    dependabot.indexOf("- package-ecosystem: docker"),
  );
  assert.match(
    docker,
    /^ {4}ignore:\n {6}- dependency-name: node\n {8}update-types: \["version-update:semver-major"\]$/mu,
  );
});

test("the Playwright image CI's browser jobs run in is named by its tag and pinned by digest, and the tag is the lockfile's @playwright/test (Round 21 hardening, W-1)", () => {
  // Nothing moves this image but a hand, so the tag says which version the
  // digest is, and a bump of @playwright/test without the image is red here.
  const images = [
    ...read(".github/workflows/ci.yml").matchAll(
      /^ {6}image: (mcr\.microsoft\.com\/playwright\S*)$/gmu,
    ),
  ].map((m) => m[1]);
  assert.ok(images.length > 0, "no CI job runs in the Playwright image");
  const locked = JSON.parse(read("package-lock.json")).packages[
    "node_modules/@playwright/test"
  ].version;
  for (const image of images) {
    const pinned =
      /^mcr\.microsoft\.com\/playwright:v(\d+\.\d+\.\d+)-noble@sha256:[0-9a-f]{64}$/u.exec(
        image,
      );
    assert.ok(pinned, `${image} is not tag@digest`);
    assert.equal(pinned[1], locked, "the image's tag is not the lockfile's");
  }
});

test("CI runs nightly on main, and a red nightly opens or comments on one issue from all-green (Round 21 hardening, NIGHT-6, NIGHT-9)", () => {
  const ci = read(".github/workflows/ci.yml");
  const triggers = ci.slice(ci.indexOf("\non:\n"), ci.indexOf("\njobs:\n"));
  assert.match(triggers, /^ {2}schedule:\n {4}- cron: "27 9 \* \* \*"$/mu);
  const green = ci
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("all-green:"));
  assert.ok(green, "CI has no all-green job");
  assert.match(
    green,
    /^ {4}permissions:\n {6}contents: read\n {6}issues: write\n/mu,
  );
  const step = green.slice(
    green.indexOf("- name: A red nightly reports itself"),
  );
  assert.match(
    step,
    /^ {8}if: failure\(\) && github\.event_name == 'schedule'$/mu,
  );
  // Block-style env: `${{` inside a flow mapping does not parse.
  assert.match(step, /^ {8}env:\n {10}GH_TOKEN: \$\{\{ github\.token \}\}$/mu);
  assert.match(step, /gh issue comment "\$n"/u);
  assert.match(step, /gh issue create .*--title 'Nightly red'/u);
  // A called workflow can only keep or lower its caller's permissions, so
  // main.yml's full suite grants what all-green asks for.
  const full = read(".github/workflows/main.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("full:"));
  assert.ok(full, "main.yml has no full job");
  assert.match(
    full,
    /^ {4}permissions:\n {6}contents: read\n {6}issues: write\n/mu,
  );
});

test("CI builds the site with no backend, as a Vercel preview does (register F62)", () => {
  // A platform read on the settings page failed every Vercel preview's build
  // while CI, which builds with the origin set, stayed green.
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("build-no-backend:"));
  assert.ok(job, "CI has no build-no-backend job");
  assert.match(job, /^ {6}- run: npm run build:no-backend$/mu);
  // And serves it, straight after, from that build's output.
  assert.match(
    job,
    /^ {6}- run: npm run build:no-backend\n(?: {6}#.*\n)* {6}- run: npm run probe:no-backend$/mu,
  );
  assert.doesNotMatch(
    job,
    /continue-on-error|^\s+if:|^\s+needs:/mu,
    "the job, and every step in it, must run and be able to fail",
  );
  assert.equal(
    JSON.parse(read("package.json")).scripts["build:no-backend"],
    "BACKEND_API_ORIGIN= npm run build",
    "the origin is emptied for this build, whatever the shell holds",
  );
});

test("main runs a smoke on the tree its pull request's all-green proved, and the whole suite otherwise (register F92)", () => {
  // Every push to main ran ci.yml again on a tree its pull request had proved:
  // squash-only and strict, the squashed commit's tree is the PR head's. So
  // ci.yml runs on pull requests, and on main only when main.yml calls it.
  const ci = read(".github/workflows/ci.yml");
  const triggers = ci.slice(ci.indexOf("\non:\n"), ci.indexOf("\njobs:\n"));
  assert.match(triggers, /^ {2}pull_request:$/mu);
  assert.match(
    triggers,
    /^ {2}workflow_call:$/mu,
    "main's full suite calls ci.yml",
  );
  assert.doesNotMatch(
    triggers,
    /^ {2}push:/mu,
    "a push to main runs main.yml, not ci.yml",
  );

  const main = read(".github/workflows/main.yml");
  assert.match(main, /^on:\n {2}push:\n {4}branches: \[main\]$/mu);
  const jobs = main
    .slice(main.indexOf("\njobs:\n"))
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .slice(1);
  const ids = jobs.map((job) => job.slice(0, job.indexOf(":")));
  const job = (id) => jobs.find((entry) => entry.startsWith(`${id}:`));

  // The verdict: the merged pull request whose squash commit this is, its
  // head's tree against HEAD's, and all-green from GitHub Actions (app 15368)
  // on that head. One way to the smoke, the last word; every other is full.
  const verdict = job("verdict");
  assert.ok(verdict, "main.yml has no verdict job");
  assert.match(
    verdict,
    /^ {6}suite: \$\{\{ steps\.decide\.outputs\.suite \}\}$/mu,
  );
  assert.match(verdict, /tree=\$\(git rev-parse 'HEAD\^\{tree\}'\)/u);
  assert.match(verdict, /commits\/\$\{GITHUB_SHA\}\/pulls/u);
  assert.match(
    verdict,
    /\.merged_at != null and \.base\.ref == \\"main\\" and \.merge_commit_sha == \\"\$\{GITHUB_SHA\}\\"/u,
  );
  assert.match(verdict, /git\/commits\/\$\{head\}" --jq \.tree\.sha/u);
  assert.match(
    verdict,
    /if \[ "\$pr_tree" != "\$tree" \]; then\n\s+decide full/u,
  );
  assert.match(
    verdict,
    /commits\/\$\{head\}\/check-runs\?check_name=all-green&app_id=15368/u,
  );
  assert.match(
    verdict,
    /if \[ "\$conclusion" != "success" \]; then\n\s+decide full/u,
  );
  assert.deepEqual(
    [...verdict.matchAll(/^\s+decide (\w+) /gmu)].map((m) => m[1]),
    ["full", "full", "full", "smoke"],
  );

  // The smoke: the cheap gates, on setup-node's npm cache after npm ci, so the
  // cache under main's scope — the one a PR's first run restores — stays
  // seeded. Nothing slow: the builds and the browser suites are the PR's.
  const smoke = job("smoke");
  assert.ok(smoke, "main.yml has no smoke job");
  assert.match(smoke, /^ {4}if: needs\.verdict\.outputs\.suite == 'smoke'$/mu);
  assert.match(smoke, /^ {4}timeout-minutes: 5$/mu);
  assert.match(
    smoke,
    /^ {6}- uses: actions\/setup-node@[0-9a-f]{40} # v\d+\.\d+\.\d+\n {8}with:\n {10}node-version-file: \.nvmrc\n {10}cache: npm$/mu,
  );
  assert.match(smoke, /^ {6}- run: npm ci$/mu);
  for (const gate of ["lint", "format:check", "typecheck"]) {
    assert.match(smoke, new RegExp(`^ {6}- run: npm run ${gate}$`, "mu"), gate);
  }
  assert.match(smoke, /^ {10}npm run test:contracts \| tee /mu);
  assert.doesNotMatch(smoke, /npm run build|test:browser|docker /u);

  // Otherwise the whole of ci.yml, as a reusable workflow.
  const full = job("full");
  assert.ok(full, "main.yml has no full job");
  assert.match(full, /^ {4}if: needs\.verdict\.outputs\.suite == 'full'$/mu);
  assert.match(full, /^ {4}uses: \.\/\.github\/workflows\/ci\.yml$/mu);

  // main-green, in all-green's shape: needs every other job, runs whatever
  // they did, and passes only when the verdict was made, the suite it chose
  // succeeded and the other was skipped.
  const green = job("main-green");
  assert.ok(green, "main.yml has no main-green job");
  assert.match(green, /^ {4}if: always\(\)$/mu);
  const needs = /^ {4}needs:\n((?: {6}- [\w-]+\n)+)/mu.exec(green);
  assert.ok(needs, "main-green names no needs list");
  assert.deepEqual(
    [...needs[1].matchAll(/- ([\w-]+)/gu)].map((m) => m[1]).sort(),
    ids.filter((id) => id !== "main-green").sort(),
  );
  assert.match(green, /^ {4}timeout-minutes: 5$/mu);
  assert.match(green, /\[ "\$verdict" = "success" \] \|\| fail/u);
  assert.match(
    green,
    /smoke\)\n\s+\[ "\$smoke" = "success" \] \|\| fail[^\n]*\n\s+\[ "\$full" = "skipped" \] \|\| fail/u,
  );
  assert.match(
    green,
    /full\)\n\s+\[ "\$full" = "success" \] \|\| fail[^\n]*\n\s+\[ "\$smoke" = "skipped" \] \|\| fail/u,
  );
  assert.match(green, /\*\)\n\s+fail/u, "no suite chosen is red");
});

test("the committed platform types are checked against the deployed platform's contract — in CI before a merge, and after every production deploy — and fail closed (register F94)", () => {
  // CI: a job all-green needs (the F88 test) that runs the check and can fail.
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("contract-deployed:"));
  assert.ok(job, "CI has no contract-deployed job");
  assert.match(
    job,
    /^ {6}- run: node scripts\/verify-deployed-contracts\.mjs$/mu,
  );
  assert.match(job, /^ {4}timeout-minutes: 5$/mu);
  assert.doesNotMatch(
    job,
    /continue-on-error|^\s+if:|^\s+needs:/mu,
    "the job, and every step in it, must run and be able to fail",
  );
  // After a deploy: the platform production reads, through the rewrite,
  // against the deployed sha's own headers, for every document the check
  // compares — and no marker is red. The probe has no escape.
  const probe = read(".github/workflows/post-deploy-probe.yml");
  const step = probe.slice(
    probe.indexOf("- name: The platform serves the contract"),
  );
  assert.match(step, /"\$\{ORIGIN\}\/api\/platform\/health\/live"/u);
  assert.match(
    step,
    /raw\.githubusercontent\.com\/\$\{GITHUB_REPOSITORY\}\/\$\{DEPLOYED_SHA\}\/\$\{file\}/u,
  );
  assert.match(step, /has\("contracts"\)/u, "no marker must be red");
  assert.doesNotMatch(
    step,
    /platform-requirement|continue-on-error|^\s+if:/mu,
    "the probe compares production with the platform, with no escape",
  );
  for (const [document, { file }] of Object.entries(DOCUMENTS)) {
    assert.ok(
      step.includes(`${document}:${basename(file)}`),
      `the probe does not compare ${document}`,
    );
  }
});

test("signing in from a join link returns to the organization it named", () => {
  assert.match(
    read("app/onboarding/join-org/page.tsx"),
    /loginHref\(`\/onboarding\/join-org\?w=\$\{encodeURIComponent\(workspaceId\)\}`\)/u,
  );
});

test("Replace account is off the connection row, and nothing names a connection to replace (Build 21, spec A4)", () => {
  // The owner's build 20 items 6 and 7: one standard row — mark, name, the
  // account's email, one button. The platform's replace route stays, unused.
  for (const path of [
    "app/account/connections/ConnectionsPanel.tsx",
    "app/account/connections/actions.ts",
    "app/account/flows/VendorRows.tsx",
  ]) {
    // Code only: the comments may say what was removed.
    const code = read(path)
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/^\s*\/\/.*$/gmu, "");
    assert.doesNotMatch(code, /Replace account|replaceConnectionId/u, path);
  }
});

test("the signed-in pages and onboarding say department and flow, never team, project, automation, solution or pipeline (BUILD-PLAN 24.11.11; Build 23's B1; 25.4.24's spec words since build 25)", () => {
  // The owner's words: a department is what the platform's contract calls a
  // project — ~~a team~~ until Build 23 — and "Flows will be the name we use
  // from now on". The code keeps the contract's names and the routes
  // (`/account/teams`); copy is what a person reads, found by parsing — JSX
  // text, and a string or template's text that holds a space or begins with a
  // capital. An identifier, a path, a key and an import are never copy.
  const retired = /\b(projects?|automations?|teams?|solutions?|pipelines?)\b/iu;
  const found = [];
  for (const path of [
    ...sources("app/account"),
    ...sources("app/onboarding"),
    ...sources("components/dashboard"),
    "lib/team-types.ts",
  ]) {
    const source = ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node) => {
      let text = null;
      if (ts.isJsxText(node)) text = node.getText(source);
      else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) ||
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        const words = node.text.trim();
        const moduleName =
          ts.isImportDeclaration(node.parent) ||
          ts.isExportDeclaration(node.parent);
        if (!moduleName && (/\s/u.test(words) || /^[A-Z]/u.test(words)))
          text = node.text;
      }
      if (text && retired.test(text))
        found.push(`${path}: ${JSON.stringify(text.trim())}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(found, []);
});

test("no silent skips in CI: a skipped or todo contract test fails gates and smoke, the regeneration check runs, and the browser job fails on a skip (Round 21 hardening, W12, W13, W17)", () => {
  const jobOf = (file, id) =>
    read(file)
      .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
      .find((entry) => entry.startsWith(`${id}:`));
  const gates = jobOf(".github/workflows/ci.yml", "gates");
  assert.match(gates, /^ {6}- run: npm run verify:platform-contracts$/mu);
  const browser = jobOf(".github/workflows/ci.yml", "browser");
  assert.match(
    browser,
    /^ {6}- run: npm run test:browser\n(?: {6}#.*\n)* {6}- run: node scripts\/no-skipped-browser-tests\.mjs$/mu,
  );
  // The guard itself, run as the runner runs it (bash -e), with an `npm` that
  // prints the TAP summary it is handed: red on a skip or a todo, and red when
  // the tests fail (pipefail), green only on a clean run.
  const dir = mkdtempSync(join(tmpdir(), "skip-guard-"));
  try {
    writeFileSync(
      join(dir, "npm"),
      '#!/bin/sh\nprintf "%b" "$TAP"\nexit "${NPM_EXIT:-0}"\n',
    );
    chmodSync(join(dir, "npm"), 0o755);
    for (const [file, id] of [
      [".github/workflows/ci.yml", "gates"],
      [".github/workflows/main.yml", "smoke"],
    ]) {
      const job = jobOf(file, id);
      const block =
        /- name: Contract tests, none skipped\n {8}run: \|\n((?: {10}.*\n?)+)/u.exec(
          job,
        );
      assert.ok(block, `${file} ${id} has no skip guard`);
      const script = block[1].replace(/^ {10}/gmu, "");
      const run = (tap, npmExit = "0") =>
        spawnSync("bash", ["-e", "-c", script], {
          env: {
            ...process.env,
            PATH: `${dir}:${process.env.PATH}`,
            RUNNER_TEMP: dir,
            TAP: tap,
            NPM_EXIT: npmExit,
          },
          encoding: "utf8",
        }).status;
      const clean = "# tests 3\\n# pass 3\\n# skipped 0\\n# todo 0\\n";
      assert.equal(run(clean), 0, `${file} ${id}: a clean run`);
      assert.notEqual(
        run("# tests 3\\n# pass 2\\n# skipped 1\\n# todo 0\\n"),
        0,
        `${file} ${id}: a skip`,
      );
      assert.notEqual(
        run("# tests 3\\n# pass 2\\n# skipped 0\\n# todo 1\\n"),
        0,
        `${file} ${id}: a todo`,
      );
      assert.notEqual(run(clean, "1"), 0, `${file} ${id}: a failing run`);

      // The guard over the real command: package.json's test:contracts on a
      // file with one skipped test, piped as on the runner. It must print TAP
      // on any Node (Node 24's default reporter prints `ℹ skipped 1`, which
      // the guard would not see), so it names the TAP reporter itself.
      const real = mkdtempSync(join(tmpdir(), "skip-guard-real-"));
      try {
        writeFileSync(
          join(real, "npm"),
          '#!/bin/sh\nexec sh -c "$CONTRACTS"\n',
        );
        chmodSync(join(real, "npm"), 0o755);
        const command = JSON.parse(read("package.json")).scripts[
          "test:contracts"
        ];
        const runReal = (body) => {
          const spec = join(real, "one.test.mjs");
          writeFileSync(spec, `import { test } from "node:test";\n${body}`);
          // NODE_TEST_CONTEXT would make the child report to this run.
          const env = { ...process.env };
          delete env.NODE_TEST_CONTEXT;
          return spawnSync("bash", ["-e", "-c", script], {
            env: {
              ...env,
              PATH: `${real}:${process.env.PATH}`,
              RUNNER_TEMP: real,
              CONTRACTS: command.replace("test/*.test.mjs", spec),
            },
            encoding: "utf8",
          }).status;
        };
        assert.equal(
          runReal('test("runs", () => {});\n'),
          0,
          `${file} ${id}: the real command, clean`,
        );
        assert.notEqual(
          runReal(
            'test("runs", () => {});\ntest("skips", { skip: true }, () => {});\n',
          ),
          0,
          `${file} ${id}: the real command, one skip`,
        );
      } finally {
        rmSync(real, { recursive: true, force: true });
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a browser run with any test skipped, or no report, fails; forbidOnly and the JSON report are on under CI (Round 21 hardening, W17)", () => {
  const config = read("playwright.config.ts");
  assert.match(config, /forbidOnly: Boolean\(process\.env\.CI\)/u);
  assert.match(
    config,
    /\["json", \{ outputFile: "test-results\/playwright-report\.json" \}\]/u,
  );
  // Each run empties test-results/ first: no report outlives its run.
  assert.match(read(".gitignore"), /^\/test-results\/$/mu);
  assert.match(
    read("scripts/no-skipped-browser-tests.mjs"),
    /process\.argv\[2\] \?\? "test-results\/playwright-report\.json"/u,
  );
  assert.match(
    read("scripts/run-browser-fixtures.mjs"),
    /execFileSync\(process\.execPath, \["scripts\/no-skipped-browser-tests\.mjs"\]/u,
  );
  const dir = mkdtempSync(join(tmpdir(), "no-skips-"));
  try {
    const check = (stats) => {
      const report = join(dir, "report.json");
      if (stats) writeFileSync(report, JSON.stringify({ stats }));
      else rmSync(report, { force: true });
      return spawnSync(
        process.execPath,
        ["scripts/no-skipped-browser-tests.mjs", report],
        { encoding: "utf8" },
      ).status;
    };
    const clean = { expected: 48, skipped: 0, unexpected: 0, flaky: 0 };
    assert.equal(check(clean), 0);
    assert.equal(check({ ...clean, skipped: 1 }), 1);
    assert.equal(check(null), 1, "no report is red");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
