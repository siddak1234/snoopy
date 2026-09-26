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
const platformApi = readFileSync(resolve(root, "lib/platform-api.ts"), "utf8");

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
  // status is the only thing the client can rely on. The status → words table
  // is one pure function, read here.
  assert.match(
    component,
    /function outcomeFor\(\s*failure: PlatformApiError \| null,\s*anAttemptWasLost: boolean,?\s*\): Settled/u,
    "the outcome table is one pure function",
  );
  assert.match(
    component,
    /failure\?\.status === 409\)\s*\{\s*return \{ kind: "failed", message: RETRY_COPY \};/u,
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
  assert.match(
    component,
    /const failure = caught instanceof PlatformApiError \? caught : null;\s*const next = outcomeFor\(failure, anAttemptWasLost\.current\);\s*if \(next\.kind === "unknown"\) anAttemptWasLost\.current = true;\s*setOutcome\(next\);\s*setLoading\(false\);\s*return;/u,
    "every failure ends in the table's outcome, loading cleared, no departure",
  );
  // Any other 4xx is a refusal: the deletion did not run, so the server's own
  // title is the truest thing to show.
  assert.match(
    component,
    /return \{ kind: "failed", message: failure\.message \};\s*\}\s*\n\s*export default function/u,
    "the table's last row is the server's title",
  );
  // Focus goes back to the control that answers the outcome — the confirm
  // button lost it when it was disabled mid-request (NFR-35).
  assert.match(
    component,
    /ref=\{confirmRef\}/u,
    "the confirm button carries the ref",
  );
  assert.match(
    component,
    /else if \(outcome\) confirmRef\.current\?\.focus\(\);/u,
    "focus returns to the confirm button after a refusal or a lost answer",
  );
  assert.doesNotMatch(
    component,
    /alert\(/u,
    "refusals render inline, not as a browser alert",
  );
  assert.match(
    component,
    /<FormError\s+message=\{outcome\?\.message \?\? null\}/u,
    "the dialog's one inline message is the outcome's",
  );
});

test("an answer that may have been lost keeps the account and says the outcome is unknown — never 'deleted'", () => {
  // The contract's 502 ("deleted, but the identity provider could not be
  // reached") is raised only for a bearer caller — `apps/api/src/app.ts` throws
  // it only when `revoking` is set, and `nativeLogoutSession` returns undefined
  // without a bearer (backend F39) — so every 502 a cookie caller can receive
  // here is the Access hop failing. Every other 5xx and no answer at all is the
  // same case: the request may have run and its answer been lost — the
  // standalone server's own rewrite answers 500 when the Edge's answer is lost.
  // Staying strands nothing: the Edge clears the website's cookies before that
  // throw could ever be reached.
  assert.match(
    component,
    /if \(!failure \|\| failure\.status >= 500\) \{\s*return \{ kind: "unknown", message: UNKNOWN_COPY \};/u,
    "no answer and every 5xx get the unknown-outcome copy, not a title",
  );
  assert.match(
    component,
    /const UNKNOWN_COPY =\s*"The platform could not complete this request, so it is not known whether your account was removed\. You can try again\."/u,
  );
  // The only departure is the one after a 200: nothing inside the catch leaves
  // the page or signs out.
  const catchAt = component.indexOf("} catch (caught) {");
  const catchEnd = component.indexOf("\n    }\n", catchAt);
  assert.ok(catchAt > 0 && catchEnd > catchAt, "the catch block is found");
  assert.doesNotMatch(
    component.slice(catchAt, catchEnd),
    /window\.location|signOutFromPlatform/u,
    "nothing in the catch leaves or signs out",
  );
  assert.doesNotMatch(
    component.slice(
      component.indexOf("function outcomeFor("),
      component.indexOf("export default function"),
    ),
    /window\.location|signOutFromPlatform/u,
    "nothing in the outcome table leaves or signs out",
  );
  assert.equal(
    component.split('window.location.replace("/login?deleted=1")').length - 1,
    1,
    "exactly one departure, after the catch",
  );
});

test("an expired session is said inline, with the way back in — not a retry, not a redirect", () => {
  // A retry cannot succeed, and a redirect would bounce a still-valid session
  // straight back and look like a click that did nothing. The copy claims no
  // more than this attempt's outcome — and hedges when an earlier attempt on
  // this page ended unknown, because the session may have ended precisely
  // because that attempt finished.
  const table = component.slice(
    component.indexOf("function outcomeFor("),
    component.indexOf("export default function"),
  );
  const status401 = table.indexOf("failure?.status === 401");
  const status409 = table.indexOf("failure?.status === 409");
  assert.ok(
    status401 >= 0 && status401 < status409,
    "the 401 row comes before the 409 row",
  );
  assert.match(
    table,
    /failure\?\.status === 401\)\s*\{\s*return \{\s*kind: "expired",\s*message: anAttemptWasLost \? EXPIRED_AFTER_UNKNOWN_COPY : EXPIRED_COPY,?\s*\};/u,
    "a 401 is said inline, hedged after an unknown outcome",
  );
  // The hedge outlives the dialog: closing and reopening does not make a lost
  // answer less lost, so the memory is a ref that Cancel does not clear.
  assert.match(
    component,
    /const anAttemptWasLost = useRef\(false\);/u,
    "the lost-answer memory lives for the page, not the dialog",
  );
  assert.match(
    component,
    /const EXPIRED_COPY =\s*"Your session ended, so this attempt did not run\. Sign in again to come back here\."/u,
  );
  assert.match(
    component,
    /const EXPIRED_AFTER_UNKNOWN_COPY =\s*"Your session ended, and your account may already have been removed by the earlier attempt\. Sign in again to check\."/u,
  );
  assert.match(
    component,
    /href=\{loginHref\(pathname\)\}/u,
    "the sign-in link is built by the shared helper from the page the person is on",
  );
  assert.match(
    component,
    /const pathname = usePathname\(\);/u,
    "the return target comes from the router, not a literal",
  );
  assert.match(platformApi, /export function loginHref\(/u);
  assert.match(
    platformApi,
    /encodeURIComponent\(safePlatformReturnTo\(returnTo\)\)/u,
    "loginHref validates the return the way the login page reads it",
  );
  // A dot segment can normalise a local-looking target into "//host", which a
  // browser reads as another site; the guard runs on the parsed path.
  assert.match(
    platformApi,
    /if \(parsed\.pathname\.startsWith\("\/\/"\)\) return DEFAULT_RETURN_TO;/u,
    "a return target that normalises to //host is refused",
  );
  // Focus follows the control the link replaces (NFR-35).
  assert.match(component, /ref=\{signInRef\}/u, "the link carries the ref");
  assert.match(
    component,
    /if \(outcome\?\.kind === "expired"\) signInRef\.current\?\.focus\(\);/u,
    "focus follows the control the sign-in link replaces",
  );
  // An ended session survives Cancel: reopening must not offer the destructive
  // button to a session already known dead.
  assert.match(
    component,
    /setOutcome\(\(current\) =>\s*\(?current\?\.kind === "expired" \? current : null\)?,?\s*\);/u,
    "close keeps the expired state",
  );
  const closeAt = component.indexOf("function close() {");
  const closeBody = component.slice(
    closeAt,
    component.indexOf("\n  }\n", closeAt),
  );
  assert.ok(closeAt > 0, "close() is found");
  assert.doesNotMatch(
    closeBody,
    /anAttemptWasLost/u,
    "closing the dialog does not forget a lost answer",
  );
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
