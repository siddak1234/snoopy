import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

/**
 * Account deletion, as ADR-0028 defines it (BUILD-PLAN 20.3.1, Gate 20 line 3).
 *
 * The confirmation must say what `DELETE /v1/account` removes and no more than
 * the route does; a 409 — a partial deletion — must keep the account and say so;
 * and the website must offer no "delete this workspace" action, because the
 * platform publishes none. The last is asserted by the same search Gate 20's
 * cell names, run here so it bites in CI rather than only in a session.
 */

const root = resolve(import.meta.dirname, "..");
const component = readFileSync(
  resolve(root, "components/account/DeleteAccountButton.tsx"),
  "utf8",
);
const settings = readFileSync(
  resolve(root, "app/account/settings/page.tsx"),
  "utf8",
);
const generated = readFileSync(
  resolve(root, "lib/generated/platform-contracts/platform.d.ts"),
  "utf8",
);

test("the confirmation says what the route removes, and promises no more", () => {
  const prose = component.replace(/\s+/gu, " ");
  for (const sentence of [
    "every organization you are the only owner of",
    "including organizations other people belong to",
    "who lose them and everything in them",
    "Organizations that have another owner are kept",
    "Workspaces are removed one at a time",
    "your account stays and you can try again",
    "anything already removed stays removed",
    "This cannot be undone",
  ]) {
    assert.ok(
      prose.includes(sentence),
      `the confirmation no longer says: ${sentence}`,
    );
  }
  assert.doesNotMatch(
    prose,
    /all (your )?data|everything you own|every workspace you belong to/iu,
    "the confirmation must not promise more than the route does",
  );
});

test("a 409 keeps the account: branched on the status, said inline, nothing signed out", () => {
  // The Edge relays the raw Access body with no `title` (backend F1), so the
  // status is the only thing the client can rely on.
  assert.match(
    component,
    /caught instanceof PlatformApiError && caught\.status === 409/u,
    "no 409 branch",
  );
  assert.match(
    component,
    /const RETRY_COPY =\s*"Some of your workspaces could not be removed, so your account is still here\. Anything already removed is gone\. You can try again\."/u,
  );
  // The sign-out is not inside the DELETE's try: a sign-out failure after a
  // successful deletion must not read as "the deletion failed, try again".
  const signOut = component.indexOf("await signOutFromPlatform()");
  const catchAt = component.indexOf("} catch (caught) {");
  assert.ok(
    catchAt > 0 && signOut > catchAt,
    "sign-out happens after the DELETE's catch, never inside its try",
  );
  assert.match(
    component,
    /try \{\s*await signOutFromPlatform\(\);\s*\} catch \{/u,
    "a failed courtesy sign-out must not stop the departure",
  );
  // 502 is the contract's "deleted, but revocation failed": leave as on 200.
  const status502 = component.indexOf("caught.status === 502");
  assert.ok(
    status502 > catchAt && status502 < signOut,
    "502 is handled as deleted",
  );
  const retry = component.indexOf("setError(RETRY_COPY)");
  assert.ok(
    retry > catchAt && retry < status502,
    "the 409 branch comes first and returns",
  );
  assert.doesNotMatch(
    component,
    /alert\(/u,
    "refusals render inline, not as a browser alert",
  );
  assert.match(component, /<FormError message=\{error\}/u);
});

test("no workspace-delete action exists, by the search Gate 20 line 3 names", () => {
  // grep exits 1 when nothing matches, which is the outcome this asserts.
  const grep = spawnSync(
    "grep",
    [
      "-rni",
      "-E",
      "deleteWorkspace|delete[- ]?(this[- ]?)?(workspace|organization)",
      "app",
      "components",
      "lib",
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.ok(
    grep.status === 0 || grep.status === 1,
    `grep failed: ${grep.stderr}`,
  );
  assert.equal(
    grep.stdout.trim(),
    "",
    `a workspace-delete action appeared:\n${grep.stdout}`,
  );
  // The path's own block, bounded at its closing brace, so a `delete:` added
  // to it cannot be missed by a match that ran on into the next path's block.
  const key = '\n  "/v1/workspaces/{workspaceId}": {';
  const start = generated.indexOf(key);
  assert.ok(start > 0, "the generated contract has no workspace path block");
  const block = generated.slice(start, generated.indexOf("\n  };", start));
  assert.match(
    block,
    /\n    delete\?: never;/u,
    "the contract publishes no workspace delete",
  );
  assert.doesNotMatch(
    block,
    /delete: operations/u,
    "a workspace delete appeared in the contract",
  );
  assert.match(
    settings.replace(/\s+/gu, " "),
    /Permanently delete your account, your personal workspace, and every organization you alone own\./u,
  );
});
