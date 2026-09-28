import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

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
    "/account/teams",
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

test("one Node major everywhere — .nvmrc, CI and the image (register F17)", () => {
  const major = read(".nvmrc").trim();
  const ci = read(".github/workflows/ci.yml");
  const versions = [...ci.matchAll(/node-version: (\S+)/gu)].map((m) => m[1]);
  assert.ok(versions.length > 0, "CI no longer names a Node version");
  for (const version of versions) assert.equal(version, major, "CI");
  for (const from of read("Dockerfile").matchAll(/^FROM node:(\d+)/gmu)) {
    assert.equal(from[1], major, "Dockerfile");
  }
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

test("CI builds the site with no backend, as a Vercel preview does (register F62)", () => {
  // A platform read on the settings page failed every Vercel preview's build
  // while CI, which builds with the origin set, stayed green.
  const job = read(".github/workflows/ci.yml")
    .split(/^ {2}(?=[a-z][\w-]*:$)/mu)
    .find((entry) => entry.startsWith("build-no-backend:"));
  assert.ok(job, "CI has no build-no-backend job");
  assert.match(job, /^ {6}- run: npm run build:no-backend$/mu);
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
