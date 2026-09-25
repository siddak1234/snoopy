import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

/**
 * The billing page consumes ADR-0025's four published operations and nothing
 * else (BUILD-PLAN 8.3, Gate 20 line 1). These assertions pin what the contract
 * and the Edge require of the client: generated types only, the two hosted
 * hand-offs as URL navigations, no return URLs, no idempotency key, owner or
 * admin before any billing read, and no identifier that is not this platform's.
 *
 * The specification is read from the backend repository beside this one and the
 * tests that need it skip when it is absent, as the other contract tests do.
 */

const SPEC_PATH = resolve(
  import.meta.dirname,
  "..",
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
  "docs/openapi.yaml",
);
const FACADE_PATH = resolve(import.meta.dirname, "../lib/billing.ts");
const GENERATED_PATH = resolve(
  import.meta.dirname,
  "../lib/generated/platform-contracts/platform.d.ts",
);
const ACTIONS_PATH = resolve(
  import.meta.dirname,
  "../app/account/billing/actions.ts",
);
const PANEL_PATH = resolve(
  import.meta.dirname,
  "../app/account/billing/BillingPanel.tsx",
);
const PAGE_PATH = resolve(
  import.meta.dirname,
  "../app/account/billing/page.tsx",
);

const available = existsSync(SPEC_PATH);
const spec = available ? readFileSync(SPEC_PATH, "utf8") : "";
const facade = readFileSync(FACADE_PATH, "utf8");
const generated = readFileSync(GENERATED_PATH, "utf8");
const actions = readFileSync(ACTIONS_PATH, "utf8");
const panel = readFileSync(PANEL_PATH, "utf8");
const page = readFileSync(PAGE_PATH, "utf8");

function generatedUnion(name) {
  const match = new RegExp(
    `${name}: \\{[\\s\\S]*?status\\?:\\s*((?:\\s*\\|\\s*"[a-z_]+")+);`,
    "u",
  ).exec(generated);
  assert.ok(match, `generated ${name}.status union not found`);
  return [...match[1].matchAll(/"([a-z_]+)"/gu)].map((m) => m[1]).sort();
}

function specStatusEnum(name) {
  const block = new RegExp(`    ${name}:\\n([\\s\\S]*?)\\n    [A-Z]`, "u").exec(
    spec,
  );
  assert.ok(block, `spec schema ${name} not found`);
  const status = /status:\s*\n[\s\S]*?enum:\s*\[([^\]]+)\]/u.exec(block[1]);
  assert.ok(status, `spec ${name}.status enum not found`);
  return status[1]
    .split(",")
    .map((value) => value.trim())
    .sort();
}

test("the facade aliases the four published billing operations and nothing hand-written", () => {
  for (const operation of [
    "listPlans",
    "readWorkspaceBilling",
    "createBillingCheckoutSession",
    "createBillingPortalSession",
  ]) {
    assert.ok(
      generated.includes(`${operation}: {`),
      `generated contract lacks ${operation}; regenerate from the backend`,
    );
    assert.match(
      facade,
      new RegExp(`operations\\["${operation}"\\]`, "u"),
      `lib/billing.ts must alias ${operation}`,
    );
  }
  assert.match(facade, /components\["schemas"\]\["PurchasablePlan"\]/u);
  assert.doesNotMatch(
    facade,
    /fetch\(/u,
    "the facade must go through platformServerJson",
  );
});

test("billing that is not configured renders as unavailable, and nothing else is swallowed", () => {
  // Every billing operation answers 503 NotConfigured until a provider key
  // exists — production today. The guard maps exactly that and the site's own
  // unconfigured state to null and rethrows everything else; the page, not the
  // facade, gives the two authoritative refusals (403, 404) their meaning.
  assert.match(
    facade,
    /error instanceof PlatformNotConfiguredError\) return null/u,
  );
  assert.match(facade, /PlatformServerError && error\.status === 503/u);
  assert.match(facade, /throw error;/u);
  assert.doesNotMatch(facade, /status === 40\d|status === 502/u);
});

test("the two hosted hand-offs use the generated types and send only what the Edge accepts", () => {
  assert.equal(
    (actions.match(/platformServerJson<HostedBillingSession>/gu) ?? []).length,
    2,
    "checkout and portal must both read HostedBillingSession",
  );
  assert.match(actions, /const body: BillingCheckoutRequest = \{ planId \}/u);
  assert.match(actions, /const body: BillingPortalRequest = \{\}/u);
  // The two bodies above are the only request bodies in the file: no return URL
  // is ever sent (the Edge refuses any origin but the deployment's own), and
  // prose mentioning one must not satisfy this.
  assert.equal(
    (actions.match(/const body: /gu) ?? []).length,
    2,
    "actions.ts must declare exactly the two request bodies asserted above",
  );
  assert.doesNotMatch(
    actions,
    /idempotencyKey/u,
    "the billing operations declare no Idempotency-Key",
  );
  assert.match(
    actions,
    /url\.protocol !== "https:"/u,
    "a hosted session is navigated to only when it is an https URL",
  );
  // Only the portal documents a 409 (no billing account yet → checkout). The
  // rule lives in the portal's handler; nothing before it maps a conflict.
  const portalAt = actions.indexOf("export async function openBillingPortal");
  assert.ok(portalAt > 0, "openBillingPortal not found; this test is blind");
  assert.match(
    actions.slice(portalAt),
    /error\.status === 409\) \{\s*return \{ ok: false, error: error\.message, needsCheckout: true \}/u,
    "the portal's 409 must send the person to checkout",
  );
  assert.doesNotMatch(
    actions.slice(0, portalAt),
    /409|needsCheckout: true/u,
    "checkout's failures are shown as they are, never as 'no billing account yet'",
  );
});

test("the page shows an authoritative refusal as one and rethrows breakage", () => {
  // The workspace list can be a moment stale; the server decides. A 403 or 404
  // from the workspace's billing read — the one operation that documents them —
  // is rendered as lost access. The plan list documents neither, so its
  // failures, like every other, are breakage and are rethrown.
  const billingRead = page.indexOf("readWorkspaceBilling(workspaceId)).catch(");
  assert.ok(billingRead > 0, "only the billing read maps refusals");
  assert.doesNotMatch(
    page,
    /listPlans\)\.catch|listPlans\(\)\.catch/u,
    "the plan list documents no 403 or 404",
  );
  assert.match(
    page,
    /error instanceof PlatformServerError &&\s*\(error\.status === 403 \|\| error\.status === 404\)/u,
  );
  const refusal = page.indexOf("error.status === 403");
  assert.ok(
    refusal > billingRead,
    "the refusal branch belongs to the billing read",
  );
  assert.ok(
    page.indexOf("throw error;", refusal) > refusal,
    "every other failure must be rethrown after the refusal branch",
  );
  assert.match(page, /if \(billing === REFUSED\)/u);
  assert.match(
    page,
    /You no longer have access to this workspace's billing\./u,
  );
});

test("checkout is offered only when the provider holds no subscription, and an ended plan is not current", () => {
  // `canceled` and `unpaid` end access (the contract's words on `status`).
  assert.match(
    panel,
    /const accessEnded =\s*billing\.status === "canceled" \|\| billing\.status === "unpaid";/u,
  );
  assert.match(
    panel,
    /const current = !accessEnded && plan\.planId === billing\.planId;/u,
  );
  // Checkout starts a NEW subscription: only the free floor (no status) or a
  // canceled one may use it. `unpaid` and `incomplete` are subscriptions the
  // provider still holds — paid, changed or cancelled in the portal.
  assert.match(
    panel,
    /const portalManaged =\s*billing\.status !== undefined && billing\.status !== "canceled";/u,
  );
  assert.match(panel, /\) : portalManaged \? null : \(/u);
  assert.equal(
    (panel.match(/beginBillingCheckout\(/gu) ?? []).length,
    1,
    "checkout starts from exactly one place: the card of a workspace the provider holds nothing for",
  );
  // No period line once access has ended: a period end can lie in the future.
  assert.match(panel, /periodEnd && !accessEnded \?/u);
  assert.doesNotMatch(panel, /"Ended"/u);
});

test("only the control that was pressed reports that it is opening, nothing re-enables while the browser leaves, and a failed action stays in the panel", () => {
  assert.match(
    panel,
    /const opening = \(action: string\) => busy && pendingAction === action;/u,
  );
  assert.match(panel, /opening\("portal"\) \? "Opening…" : "Manage billing"/u);
  assert.match(panel, /opening\(plan\.planId\) \? "Opening…" : "Choose plan"/u);
  // `window.location.assign` returns before the hosted page loads; the lock
  // is taken before it and never released by this page.
  assert.match(panel, /const busy = pending \|\| departing;/u);
  assert.match(
    panel,
    /setDeparting\(true\);\s*window\.location\.assign\(result\.url\);/u,
  );
  assert.doesNotMatch(
    panel,
    /setDeparting\(false\)/u,
    "the departure lock is never lifted in place",
  );
  // A back/forward-cache restore carries the pre-purchase state: reload it.
  assert.match(
    panel,
    /if \(!event\.persisted\) return;\s*window\.location\.reload\(\);/u,
  );
  // An action that never answers is said in the panel, not by the error page.
  assert.match(
    panel,
    /try \{\s*result = await run\(\);\s*\} catch \{[\s\S]*?setError\("Billing could not be reached\. Try again\."\);/u,
  );
});

test("both hand-offs refuse when the page's workspace is no longer the active one", () => {
  // The browser only names the workspace it rendered; the path always uses
  // the one the server resolves, and a mismatch refuses before any call.
  for (const name of ["beginBillingCheckout", "openBillingPortal"]) {
    const at = actions.indexOf(`export async function ${name}(`);
    assert.ok(at > 0, `${name} not found; this test is blind`);
    const body = actions.slice(at, actions.indexOf("\n}\n", at));
    assert.match(
      body,
      /shownWorkspaceId: string/u,
      `${name} takes the shown workspace`,
    );
    const check = body.indexOf("if (workspaceId !== shownWorkspaceId)");
    const call = body.indexOf("platformServerJson<HostedBillingSession>");
    assert.ok(
      check > 0 && call > check,
      `${name} must compare before it calls`,
    );
    assert.match(
      body,
      /`\/v1\/workspaces\/\$\{workspaceId\}\/billing\//u,
      `${name}'s path uses the server-resolved workspace`,
    );
  }
  assert.match(panel, /beginBillingCheckout\(workspaceId, plan\.planId\)/u);
  assert.match(panel, /openBillingPortal\(workspaceId\)/u);
  assert.match(page, /workspaceId=\{workspaceId\}/u);
});

test("the page gates on owner or admin from the workspace list before any billing read", () => {
  assert.match(page, /listWorkspaces\(\)/u);
  assert.doesNotMatch(
    page,
    /session\??\.workspaces/u,
    "roles come from the public workspace list, not the bounded session",
  );
  const gate = page.search(/role !== "owner" && role !== "admin"/u);
  const read = page.indexOf("readWorkspaceBilling(");
  assert.ok(gate > 0, "the page must gate on owner or admin");
  assert.ok(read > gate, "the billing read must come after the role gate");
  assert.match(page, /billingWhenUnavailable\(/u);
});

test("no billing file names the provider or renders a provider identifier", () => {
  for (const [name, text] of [
    ["lib/billing.ts", facade],
    ["actions.ts", actions],
    ["BillingPanel.tsx", panel],
    ["page.tsx", page],
  ]) {
    assert.doesNotMatch(
      text,
      /stripe|provider_|customerId|priceId|subscriptionId/iu,
      name,
    );
  }
  // The panel renders the plan's own id only as a comparison, never as text.
  assert.doesNotMatch(
    panel,
    /[^=]\{(?:billing|plan)\.planId\}/u,
    "the plan id is compared and keyed, never rendered as text",
  );
});

test("every billing status the contract names has a tone in StatusPill", () => {
  // One status pill for every vocabulary the platform returns: billing status
  // renders through it, never through a private copy of its job.
  const pill = readFileSync(
    resolve(import.meta.dirname, "../components/dashboard/StatusPill.tsx"),
    "utf8",
  );
  const mapped = new Set(
    [
      ...pill.matchAll(
        /^\s{2}"?([a-z_-]+)"?:\s*"(success|warning|error|info|neutral)"/gmu,
      ),
    ].map((match) => match[1]),
  );
  for (const status of generatedUnion("WorkspaceBillingResponse")) {
    assert.ok(
      mapped.has(status),
      `billing status "${status}" has no tone in StatusPill`,
    );
  }
  assert.match(panel, /<StatusPill status=\{billing\.status\} \/>/u);
  assert.doesNotMatch(
    panel,
    /statusCopy|Record<\s*NonNullable<WorkspaceBillingResponse\["status"\]>/u,
    "no private status map beside StatusPill",
  );
  // snake_case statuses read as words (past_due → "past due").
  assert.match(pill, /status\.replace\(\/\[-_\]\/g, " "\)/u);
});

test(
  "the billing status vocabulary matches the server exactly",
  {
    skip: available
      ? false
      : "snoopy-backend is not checked out beside this repository",
  },
  () => {
    assert.deepEqual(
      generatedUnion("WorkspaceBillingResponse"),
      specStatusEnum("WorkspaceBillingResponse"),
    );
  },
);
