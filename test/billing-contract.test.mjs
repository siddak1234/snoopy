import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

import { formatPlanPrice } from "../lib/plan-price.ts";

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
  // exists. The guard maps exactly that to null and rethrows everything else;
  // the page, not the facade, gives the two authoritative refusals (403, 404)
  // their meaning. A site with no backend never reaches the billing page — the
  // account layout sends it to sign-in — so it is not special-cased (F32).
  assert.doesNotMatch(
    facade,
    /PlatformNotConfiguredError/u,
    "no branch for a state the page cannot reach",
  );
  assert.match(facade, /PlatformServerError && error\.status === 503/u);
  assert.match(facade, /throw error;/u);
  assert.doesNotMatch(facade, /status === 40\d|status === 502/u);
});

test("the two hosted hand-offs use the generated types and send only what the Edge accepts", () => {
  // The calls live in the facade, where the path is built (register F9); the
  // actions check the workspace and decide what an answer means.
  assert.equal(
    (facade.match(/platformServerJson<HostedBillingSession>/gu) ?? []).length,
    2,
    "checkout and portal must both read HostedBillingSession",
  );
  assert.doesNotMatch(actions, /platformServerJson|\/v1\//u);
  assert.match(actions, /const body: BillingCheckoutRequest = \{ planId \}/u);
  assert.match(facade, /const body: BillingPortalRequest = \{\}/u);
  // Those are the only request bodies: no return URL is ever sent (the Edge
  // refuses any origin but the deployment's own), and prose mentioning one must
  // not satisfy this.
  assert.equal(
    (actions.match(/const body: /gu) ?? []).length +
      (facade.match(/const body: /gu) ?? []).length,
    2,
    "exactly the two request bodies asserted above",
  );
  assert.doesNotMatch(
    `${actions}\n${facade}`,
    /idempotencyKey/u,
    "the billing operations declare no Idempotency-Key",
  );
  assert.match(
    actions,
    /url\.protocol !== "https:"/u,
    "a hosted session is navigated to only when it is an https URL",
  );
  // The portal's 409 is "no billing account yet" → checkout. Checkout's one
  // conflict is a workspace that already has a plan (backend 24.12,
  // `plan_exists`): it opens the portal, where a plan is changed (build 10).
  // Nothing else is mapped as a conflict.
  const portalAt = actions.indexOf("export async function openBillingPortal");
  assert.ok(portalAt > 0, "openBillingPortal not found; this test is blind");
  assert.match(
    actions.slice(portalAt),
    /error\.status === 409\) \{\s*return \{ ok: false, error: error\.message, needsCheckout: true \}/u,
    "the portal's 409 must send the person to checkout",
  );
  const checkout = actions.slice(0, portalAt);
  assert.match(
    checkout,
    /error instanceof PlatformServerError &&\s*error\.status === 409 &&\s*error\.details\?\.reason === "plan_exists"\s*\) \{\s*return openBillingPortal\(shownWorkspaceId\);\s*\}\s*return failure\(error\);/u,
    "a checkout refused for a plan the workspace has opens Manage billing",
  );
  assert.equal(
    (checkout.match(/409/gu) ?? []).length,
    1,
    "checkout maps one conflict, plan_exists, and no other",
  );
  assert.doesNotMatch(
    checkout,
    /needsCheckout: true/u,
    "checkout's failures are never 'no billing account yet'",
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
  // provider still holds — paid, changed or cancelled in the portal, where a
  // card picked then goes (the owner, build 9).
  assert.match(
    panel,
    /const portalManaged =\s*billing\.status !== undefined && billing\.status !== "canceled";/u,
  );
  assert.match(
    panel,
    /portalManaged\s*\? navigate\(plan\.planId, \(\) =>\s*openBillingPortal\(workspaceId\),\s*\)\s*: navigate\(plan\.planId, \(\) =>\s*beginBillingCheckout\(workspaceId, plan\.planId\),\s*\)/u,
  );
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
  // Paying, the Free card says how to reach it: cancel in the portal (build 13 decision 7c).
  // Wrapped where Prettier wraps it; read as one sentence.
  assert.match(
    panel,
    /To move to Free, cancel \{billing\.displayName\} in Manage\s+billing\./u,
  );
  // Not once the plan is cancelled, and the cancelled plan says Free comes next
  // (the owner's build 14 feedback #11).
  assert.match(
    panel,
    /\{billing\.cancelAtPeriodEnd \? null : \(\s*<p[^>]*>\s*To move to Free/u,
  );
  assert.match(
    panel,
    /\{billing\.cancelAtPeriodEnd \? ", then Free" : null\}/u,
  );
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
    assert.match(
      body,
      /const workspaceId = await activeWorkspaceIfShown\(shownWorkspaceId\);/u,
      `${name} resolves the workspace on the server and compares it`,
    );
    const check = body.indexOf(
      "if (!workspaceId) return { ok: false, error: WORKSPACE_CHANGED };",
    );
    const call = body.search(/createBilling(?:Checkout|Portal)\(workspaceId/u);
    assert.ok(
      check > 0 && call > check,
      `${name} must compare before it calls — with the server-resolved workspace`,
    );
  }
  assert.match(
    facade,
    /`\$\{scope\(workspaceId\)\}\/billing\/checkout`/u,
    "the checkout path is built from the workspace it is given, encoded",
  );
  assert.match(facade, /`\$\{scope\(workspaceId\)\}\/billing\/portal`/u);
  assert.match(panel, /beginBillingCheckout\(workspaceId, plan\.planId\)/u);
  assert.match(panel, /openBillingPortal\(workspaceId\)/u);
  assert.match(page, /workspaceId=\{workspaceId\}/u);
});

test("the page gates on owner or admin from the workspace list before any billing read", () => {
  // `roleInWorkspace` reads the public workspace list; `administers` is owner
  // or admin — one rule for every page that gates (register F8).
  assert.match(page, /roleInWorkspace\(workspaceId\)/u);
  assert.doesNotMatch(
    page,
    /session\??\.workspaces/u,
    "roles come from the public workspace list, not the bounded session",
  );
  const gate = page.search(/if \(!administers\(role\)\)/u);
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

test("a plan's price is the provider's minor units, divided by that currency's stated exponent, or said to be at checkout", () => {
  // Backend §12.1 #163, ADR-0031. Behaviour, not source text: the formatter runs.
  assert.equal(
    formatPlanPrice({ amount: 500, currency: "usd", interval: "month" }),
    "$5.00 per month",
  );
  assert.equal(formatPlanPrice({ amount: 1999, currency: "eur" }), "€19.99");
  // Zero-decimal: 500 minor units ARE 500 yen.
  assert.equal(
    formatPlanPrice({ amount: 500, currency: "jpy", interval: "year" }),
    "¥500 per year",
  );
  // A currency whose minor unit this website does not state is not guessed at —
  // Intl's display digits and the provider's minor units disagree for some.
  for (const currency of ["huf", "isk", "kwd", "xyz"]) {
    assert.equal(formatPlanPrice({ amount: 500000, currency }), undefined);
  }
  assert.equal(formatPlanPrice({ amount: 1.5, currency: "usd" }), undefined);
  assert.match(
    panel,
    /formatPlanPrice\(plan\.price\)\) \?\?\s*"Price shown at checkout"/u,
  );
});

test("a plan card is its name and its price, and prints no capability (the owner, build 9)", () => {
  // The card once read "workspace.rate 120" (§12.1 #163); now it reads no
  // capability at all.
  assert.doesNotMatch(panel, /capabilit/iu);
  assert.match(
    panel,
    /<PlanCard\s+key=\{plan\.planId\}\s+name=\{plan\.displayName\}/u,
  );
});

test("three cards: Free, drawn here at no cost and Enrolled on the free floor, then the platform's plans by price (the owner, build 9)", () => {
  // The platform lists only what can be bought, by id — Pro before Plus — so
  // the order is the website's: by price, an unstated one last.
  assert.match(
    panel,
    /const FREE_PRICE = \{ amount: 0, currency: "usd", interval: "month" \} as const;/u,
  );
  assert.equal(
    formatPlanPrice({ amount: 0, currency: "usd", interval: "month" }),
    "$0.00 per month",
  );
  assert.match(
    panel,
    /<PlanCard name="Free" price=\{formatPlanPrice\(FREE_PRICE\) \?\? ""\}>\s*\{onFree \? \(\s*enrolled\(false\)/u,
  );
  assert.match(
    panel,
    /const onFree = billing\.status === undefined \|\| accessEnded;/u,
  );
  assert.match(
    panel,
    /return plan\.price\?\.amount \?\? Number\.MAX_SAFE_INTEGER;/u,
  );
  assert.match(
    panel,
    /\.sort\(\(a, b\) => priceOrder\(a\) - priceOrder\(b\)\)/u,
  );
  assert.match(panel, /\{current \? \(\s*enrolled\(true\)/u);
  assert.match(panel, />\s*Enrolled\s*</u);
  assert.match(panel, /md:grid-cols-3/u);
});

test("Pro is drawn at the owner's price while the platform lists none, gives way to the platform's Pro, and opens neither door; the cards are compact (the owner's build 10)", () => {
  assert.match(panel, /const PRO_NAME = "Pro";/u);
  assert.match(
    panel,
    /const PRO_PRICE = \{ amount: 1000, currency: "usd", interval: "month" \} as const;/u,
  );
  assert.equal(
    formatPlanPrice({ amount: 1000, currency: "usd", interval: "month" }),
    "$10.00 per month",
  );
  // By the name a person reads: a plan's id is the platform's to choose, and
  // the fixture's Pro is not production's.
  assert.match(
    panel,
    /const proListed = plans\.some\(\(plan\) => plan\.displayName === PRO_NAME\);/u,
  );
  // Drawn after the platform's plans, with no control: a checkout for it would
  // be refused, and the portal has no Pro to change to.
  assert.match(
    panel,
    /\{proListed \? null : \(\s*<PlanCard\s+name=\{PRO_NAME\}\s+price=\{formatPlanPrice\(PRO_PRICE\) \?\? ""\}\s*\/>\s*\)\}\s*<\/ul>/u,
  );
  // Compact: no minimum height, nothing pushed to a card's bottom, and no card
  // stretched to the tallest in its row.
  assert.doesNotMatch(panel, /min-h-|mt-auto/u);
  assert.match(panel, /md:grid-cols-3 md:items-start/u);
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
