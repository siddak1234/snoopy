import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ts from "typescript";

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
  // Without a title, the row it always was.
  assert.match(
    row,
    /if \(!title\) \{\s*return \(\s*<div className="py-5 first:pt-0">\s*<p className="text-sm text-\[var\(--muted\)\]">\{text\}<\/p>\s*<\/div>\s*\);\s*\}/u,
  );
  // With one: the icon, decorative, then the title, its line and the action.
  assert.match(row, /<span\s+aria-hidden/u);
  for (const [page, title] of [
    ["app/account/teams/page.tsx", "No teams yet"],
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
      "Leave team",
      ["text", "danger"],
    ],
    ["components/dashboard/DeleteProjectButton.tsx", "Delete", ["text"]],
    [
      "components/account/LinkedAccountsSection.tsx",
      "Unlink",
      ["danger", "danger"],
    ],
    ["app/account/connections/ConnectionsPanel.tsx", "Disconnect", ["danger"]],
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
    ["app/account/approvals/ApprovalDecision.tsx", "Reject", "secondary", null],
    [
      "components/dashboard/OrgJoinRequestList.tsx",
      "Reject",
      null,
      "btn-secondary",
    ],
    [
      "components/dashboard/TeamAccessRequests.tsx",
      "Deny",
      null,
      "btn-secondary",
    ],
    [
      "app/onboarding/join-org/JoinOrgForm.tsx",
      "Cancel request",
      null,
      "btn-secondary",
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
  // The panel's alert stands down while either dialog is open …
  assert.match(
    panel,
    /\{selectedProvider \|\| replacing \? null : \(\s*<FormError message=\{error\} className="mt-4" \/>\s*\)\}/u,
  );
  // … because each dialog carries its own.
  assert.match(panel, /<FormError message=\{error\} \/>/u);
  assert.match(
    panel,
    /<FormError message=\{replaceError\} className="mt-3" \/>/u,
  );
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

test("one Node major everywhere — .nvmrc, CI, the image and package.json engines (register F17)", () => {
  const major = read(".nvmrc").trim();
  const ci = read(".github/workflows/ci.yml");
  const versions = [...ci.matchAll(/node-version: (\S+)/gu)].map((m) => m[1]);
  assert.ok(versions.length > 0, "CI no longer names a Node version");
  for (const version of versions) assert.equal(version, major, "CI");
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
    job.includes("image: mcr.microsoft.com/playwright@"),
  );
  assert.ok(inImage.length > 0, "no CI job runs in the Playwright image");
  for (const job of inImage) {
    assert.match(job, /^ {4}env:\n {6}HOME: \/root$/mu, job.split("\n")[0]);
  }
});

test("CI's contract tests read the whole history, so a struck document path is checked, not skipped", () => {
  // `scripts/audit-doc-references.mjs` believes a strike only for a file a
  // commit once added; in a one-commit clone every strike reads "not checked".
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("gates:"));
  assert.ok(job, "CI has no gates job");
  assert.match(job, /- run: npm run test:contracts$/mu);
  assert.match(
    job,
    /- uses: actions\/checkout@v7\n(?: {8}#.*\n)*? {8}with:\n {10}fetch-depth: 0$/mu,
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

test("signing in from a join link returns to the organization it named", () => {
  assert.match(
    read("app/onboarding/join-org/page.tsx"),
    /loginHref\(`\/onboarding\/join-org\?w=\$\{encodeURIComponent\(workspaceId\)\}`\)/u,
  );
});

test("a replace answered as reused says so, rather than failing", () => {
  const panel = read("app/account/connections/ConnectionsPanel.tsx");
  const replace = panel.slice(panel.indexOf("const confirmReplace"));
  assert.match(
    replace,
    /if \(result\.ok && result\.alreadyConnectedAs\) \{\s*setReplacing\(null\);/u,
  );
  // The account the platform says is connected, not the row's: the platform
  // never reuses a grant it was asked to replace (backend
  // apps/connections/src/postgres-attempts.ts), so no fixture gives this answer
  // and the page's own name for the row could be stale.
  assert.match(
    replace,
    /setNotice\(\s*`\$\{result\.alreadyConnectedAs\} is still connected/u,
  );
});

test("the signed-in pages say team and flow, never project or automation (BUILD-PLAN 24.11.11)", () => {
  // The owner's words: a team is what the platform's contract calls a project,
  // and "Flows will be the name we use from now on". The code keeps the
  // contract's names; copy is what a person reads, found by parsing — JSX text,
  // and a string or template's text that holds a space or begins with a
  // capital. An identifier, a path, a key and an import are never copy.
  const retired = /\b(projects?|automations?)\b/iu;
  const found = [];
  for (const path of [
    ...sources("app/account"),
    ...sources("components/dashboard"),
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
