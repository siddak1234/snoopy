import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * Build 22's website guards that are not one module's (spec §4 W1–W3, P1–P4;
 * the owner's build 21 items 1 and 5–7; D5, the session's suggestion the
 * owner approved 21:12Z): no move to another version anywhere — "I also dont
 * want a move to vx number in the flows. The user always gets the latest
 * version. They dont get to oick when to update" — and no version written by
 * any request; one name for the choices page, "Connect integration" (S21);
 * and no team pills on any website page (W3).
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
/** A source file's code alone: its comments — where gone words are struck through — left out. */
const code = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");

/** The website's runtime sources: app/, components/, lib/ and hooks/, less the generated contracts. */
function runtimeFiles() {
  const found = [];
  const walk = (directory) => {
    if (!existsSync(join(root, directory))) return;
    for (const entry of readdirSync(join(root, directory), {
      withFileTypes: true,
    })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (path !== "lib/generated") walk(path);
      } else if (/\.(?:ts|tsx|css)$/u.test(entry.name)) found.push(path);
    }
  };
  for (const directory of ["app", "components", "lib", "hooks"])
    walk(directory);
  return found;
}

test('no move to another version anywhere — no "Move to v", no move action, no MoveVersionButton — and no request writes templateVersion: a flow is only ever read for the version it runs (P4; the owner\'s build 21 item 7)', () => {
  const files = runtimeFiles();
  assert.ok(files.length > 100, "the walk found the runtime files");
  for (const path of files) {
    const source = read(path);
    assert.doesNotMatch(source, /Move to v/u, path);
    assert.doesNotMatch(
      code(source),
      /moveSubscriptionVersion|moveWithConfiguration|MoveVersion|MOVE_REFUSALS/u,
      path,
    );
    // Every templateVersion in code is a read of one (`x.templateVersion`).
    for (const match of code(source).matchAll(/(.)templateVersion\b/gu))
      assert.equal(match[1], ".", `${path} writes templateVersion`);
  }
  assert.equal(
    existsSync(join(root, "app/account/flows/MoveVersionButton.tsx")),
    false,
  );
  const client = read("lib/automations.ts");
  assert.match(
    client,
    /intent: "subscription-config" \| "status" \| "archive",/u,
  );
});

test('one name for the choices page — "Connect integration", as the flow page\'s step 2 — and no "Connect vendor" in any form (S21)', () => {
  for (const path of runtimeFiles())
    assert.doesNotMatch(code(read(path)), /Connect vendor/u, path);
  assert.match(
    read("app/account/flows/[subscriptionId]/vendor/page.tsx"),
    /title="Connect integration"/u,
  );
  assert.match(
    read("app/account/flows/[subscriptionId]/vendor/VendorChoice.tsx"),
    /label="Connect integration"/u,
  );
  const nav = read("components/dashboard/DashboardNav.tsx");
  assert.match(
    nav,
    /if \(pathname\.endsWith\("\/vendor"\)\) return "Connect integration";/u,
  );
  assert.match(
    nav,
    /if \(pathname\.endsWith\("\/email"\)\) return "Who gets the email";/u,
  );
});

test("no team pills on any website page: the scope is the workspace switcher alone (W3)", () => {
  for (const path of runtimeFiles()) {
    const source = code(read(path));
    assert.doesNotMatch(source, /ScopeControl|ScopePill|All teams/u, path);
  }
});
