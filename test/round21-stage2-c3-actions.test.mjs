import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  AGREEMENT_NOT_PUBLISHED,
  ASK_OWNER,
  acceptThenRepeat,
} from "../lib/health-agreement.ts";
import {
  cleanupLoaded,
  code,
  load,
  platform,
  platformError,
} from "./round21-stage2-harness.mjs";

/**
 * Round 21, Stage 2 on the website, C3's server actions against the platform
 * stub (`round21-stage2-harness.mjs`): what each sends, and how each refusal
 * is said. The screens are `round21-stage2-c3.test.mjs`; the clicks,
 * `e2e/health-data.spec.ts`.
 */

const ACTIONS = "app/account/flows/actions.ts";

after(cleanupLoaded);

const REQUIRED = {
  reason: "agreement_required",
  kind: "health-data",
  version: 1,
};
const TEXT = {
  "/v1/agreements/health-data": {
    version: 1,
    text: "# Business Associate Agreement",
    sha256: "a".repeat(64),
  },
};
const OFFER = {
  version: 1,
  text: "# Business Associate Agreement",
  sha256: "a".repeat(64),
  organization: "Acme Clinic",
};

const ITEMS = "/v1/workspaces/w1/subscriptions/s1/items";
const ITEM = {
  workspaceId: "w1",
  subscriptionId: "s1",
  fields: { name: "March list" },
  fieldKeys: ["name"],
  file: "f1",
  idempotencyKey: "item-0123456789abcdef",
};

/** `createItem` (or, with `mutate`, a bite's copy) against the platform's `answer` for the item. */
async function upload(answer, { role = "owner", mutate } = {}) {
  const { createItem } = await load(ACTIONS, mutate);
  platform({ [ITEMS]: answer, ...TEXT }, { role });
  return createItem(ITEM);
}

test("C3-b, an item: the owner's upload of a flow that carries health data, refused, is given the agreement — from one workspace read and one text read — and nothing is drawn again", async () => {
  const answer = await upload(platformError(403, REQUIRED));
  assert.deepEqual(answer, {
    ok: false,
    error: "",
    state: "agreement-required",
    agreement: OFFER,
  });
  assert.deepEqual(globalThis.__asked, [
    ITEMS,
    "/v1/workspaces",
    "/v1/agreements/health-data",
  ]);
  assert.equal(globalThis.__sent[0].idempotencyKey, ITEM.idempotencyKey);
  assert.deepEqual(globalThis.__revalidated, []);
});

test("C3-b, an item: an admin's upload of it says Ask your workspace owner…, never Only an owner or admin can do this., and the text is never read", async () => {
  const answer = await upload(platformError(403, REQUIRED), { role: "admin" });
  assert.deepEqual(answer, {
    ok: false,
    error: ASK_OWNER,
    state: "agreement-required",
  });
  assert.deepEqual(globalThis.__asked, [ITEMS, "/v1/workspaces"]);
});

test("C3-b, an item: a member, whom the platform refuses first as a member, is told only an owner or admin can, with nothing more read", async () => {
  const answer = await upload(platformError(403, { requiredRole: "admin" }), {
    role: "member",
  });
  assert.deepEqual(answer, {
    ok: false,
    error: "Only an owner or admin can do this.",
    state: "forbidden",
  });
  assert.deepEqual(globalThis.__asked, [ITEMS]);
});

test("C3-b, an item: made, it is the item, its flow's page drawn again; the platform's key is the card's", async () => {
  const item = { id: "i1", title: "March list" };
  const answer = await upload({ item });
  assert.deepEqual(answer, { ok: true, item });
  assert.equal(globalThis.__sent[0].idempotencyKey, ITEM.idempotencyKey);
  assert.deepEqual(globalThis.__revalidated, [["/account/flows/s1"]]);
});

test("C3-b, an item: the upload card opens the owner's dialog beside its form, and Accept and start run sends the refused item again as it was sent — the same values, the same key", () => {
  const card = code("app/account/flows/UploadItemCard.tsx");
  assert.match(
    card,
    /if \(result\.agreement\) \{\s*setOffer\(\{ agreement: result\.agreement, input \}\);\s*return null;\s*\}/u,
  );
  assert.match(
    card,
    /workspaceId=\{workspaceId\}\s+onAccepted=\{\(\) => send\(offer\.input\)\}/u,
  );
  // Beside the card's dialog, never in its form, whose changes make a new key.
  assert.match(card, /<\/Modal>\s*\{offer \? \(\s*<HealthAgreementDialog/u);
});

const AGREEMENT_ACTIONS = "app/account/flows/agreement-actions.ts";
const ACCEPT = "/v1/workspaces/w1/agreements";
/** The dialog's form, as a press of Accept sends it. */
const SIGNED = {
  version: "1",
  sha256: "a".repeat(64),
  signerName: " Dana Owner ",
  signerTitle: "Practice manager",
  authorized: "true",
  agreementKey: "agreement-0123456789abcdef",
  workspaceId: "w1",
};

/** `acceptHealthAgreement` of `fields` against the platform's `answer` for the acceptance. */
async function acceptance(answer, fields = SIGNED, { active } = {}) {
  const { acceptHealthAgreement } = await load(AGREEMENT_ACTIONS);
  platform({ [ACCEPT]: answer }, { active });
  const data = new FormData();
  for (const [name, value] of Object.entries(fields))
    if (value !== undefined) data.set(name, value);
  return acceptHealthAgreement(data);
}

test("C3 Accept: what this person read and signed is sent once, under the dialog's key — the version, the text's hash, the name and title trimmed, authorized — and the organization's Documents are drawn again", async () => {
  assert.deepEqual(await acceptance({ document: { id: "d1" } }), { ok: true });
  assert.equal(globalThis.__sent.length, 1);
  const [sent] = globalThis.__sent;
  assert.equal(sent.path, ACCEPT);
  assert.equal(sent.method, "POST");
  assert.equal(sent.idempotencyKey, SIGNED.agreementKey);
  assert.deepEqual(JSON.parse(sent.body), {
    kind: "health-data",
    version: 1,
    sha256: SIGNED.sha256,
    signerName: "Dana Owner",
    signerTitle: "Practice manager",
    authorized: true,
  });
  assert.deepEqual(globalThis.__revalidated, [
    ["/account/organization", "layout"],
  ]);
});

test("C3 Accept: a form the platform could not take — no version, a hash that is not 64 hex, a name or title empty or over 120, the box unticked, no key — says Reopen the form and try again. and sends nothing", async () => {
  for (const [field, value] of [
    ["version", "0"],
    ["version", "1.5"],
    ["sha256", "A".repeat(64)],
    ["sha256", "a".repeat(63)],
    ["signerName", "   "],
    ["signerName", "x".repeat(121)],
    ["signerTitle", ""],
    ["signerTitle", "x".repeat(121)],
    ["authorized", undefined],
    ["authorized", "on"],
    ["agreementKey", "short"],
  ]) {
    const answer = await acceptance(
      { document: { id: "d1" } },
      { ...SIGNED, [field]: value },
    );
    assert.deepEqual(
      answer,
      { ok: false, error: "Reopen the form and try again." },
      `${field}: ${value}`,
    );
    assert.deepEqual(globalThis.__sent, [], `${field}: ${value}`);
  }
});

test("C3 Accept: refused, it is said in place — 403 asks the owner, 503 agreement_not_published isn't available yet, anything else in the platform's words; another workspace now active, nothing is sent", async () => {
  const said = async (error) => (await acceptance(error)).error;
  assert.equal(
    await said(platformError(403, { requiredRole: "owner" })),
    ASK_OWNER,
  );
  assert.equal(
    await said(
      platformError(
        503,
        { reason: "agreement_not_published" },
        "Service Unavailable",
      ),
    ),
    AGREEMENT_NOT_PUBLISHED,
  );
  assert.equal(
    await said(platformError(503, { reason: "other" }, "Service Unavailable")),
    "Service Unavailable",
  );
  assert.equal(
    await said(
      platformError(
        409,
        { reason: "agreement_changed" },
        "The agreement changed",
      ),
    ),
    "The agreement changed",
  );
  const moved = await acceptance({ document: {} }, SIGNED, { active: "w2" });
  assert.deepEqual(moved, { ok: false, error: "WORKSPACE_CHANGED" });
  assert.deepEqual(globalThis.__sent, []);
});

test("C3 Accept: once per opening — a press after the repeat was refused sends the repeat alone; a refused acceptance sends no repeat", async () => {
  const calls = [];
  const accept = (ok) => async () => {
    calls.push("accept");
    return ok ? { ok: true } : { ok: false, error: ASK_OWNER };
  };
  const repeat = (error) => async () => {
    calls.push("repeat");
    return error;
  };
  const busy = "Could not add this flow. Try again.";
  assert.deepEqual(await acceptThenRepeat(false, accept(true), repeat(busy)), {
    accepted: true,
    error: busy,
  });
  assert.deepEqual(await acceptThenRepeat(true, accept(true), repeat(null)), {
    accepted: true,
    error: null,
  });
  assert.deepEqual(calls, ["accept", "repeat", "repeat"]);
  calls.length = 0;
  assert.deepEqual(await acceptThenRepeat(false, accept(false), repeat(null)), {
    accepted: false,
    error: ASK_OWNER,
  });
  assert.deepEqual(calls, ["accept"]);
  // The dialog keeps what the press came to, and the next press reads it.
  const dialog = code("app/account/flows/HealthAgreementDialog.tsx");
  assert.match(
    dialog,
    /const pressed = await acceptThenRepeat\(\s*accepted,\s*\(\) => acceptHealthAgreement\(data\),\s*onAccepted,\s*\);\s*setAccepted\(pressed\.accepted\);\s*setError\(pressed\.error\);/u,
  );
});

const SUBSCRIPTIONS = "/v1/workspaces/w1/subscriptions";
const FLOW = "/v1/workspaces/w1/subscriptions/s1";

/** `subscribeToAutomation` (Add) against the platform's `answer` for the add. */
async function add(answer, { mutate } = {}) {
  const { subscribeToAutomation } = await load(ACTIONS, mutate);
  platform({ ...TEXT });
  // One path, two asks: the list (none held), then the add.
  let asked = 0;
  Object.defineProperty(globalThis.__platform, SUBSCRIPTIONS, {
    get: () => (asked++ === 0 ? { subscriptions: [] } : answer),
  });
  const data = new FormData();
  data.set("templateId", "icd10-code-check");
  data.set("workspaceId", "w1");
  data.set("idempotencyKey", "subscribe-0123456789abcdef");
  return subscribeToAutomation(data);
}

test("wave 2, Add: a flow that carries health data is added as a draft, and a refusal for the agreement (an older platform's) offers no agreement — nothing more is read", async () => {
  assert.deepEqual(await add({ subscription: { id: "s1" } }), {
    ok: true,
    subscriptionId: "s1",
  });
  const refused = await add(platformError(403, REQUIRED));
  assert.equal(refused.ok, false);
  assert.equal(refused.agreement, undefined);
  assert.notEqual(refused.state, "agreement-required");
  assert.ok(!globalThis.__asked.includes("/v1/agreements/health-data"));
  assert.ok(!globalThis.__asked.includes("/v1/workspaces"));
});

/** Set up's `saveSetup` against the platform's `answer` for the flow's change. */
async function save(answer, { turnOn = true, mutate } = {}) {
  const { saveSetup } = await load(ACTIONS, mutate);
  platform({ [FLOW]: answer, ...TEXT });
  const data = new FormData();
  data.set("subscriptionId", "s1");
  data.set("workspaceId", "w1");
  data.set("turnOn", turnOn ? "true" : "false");
  return saveSetup(data);
}

test("wave 2, Set up: a turn-on refused 403 agreement_required answers agreement-required with no line and no agreement — the form reads its section again; nothing else is read, nothing drawn again", async () => {
  assert.deepEqual(await save(platformError(403, REQUIRED)), {
    ok: false,
    error: "",
    state: "agreement-required",
  });
  assert.deepEqual(globalThis.__asked, [FLOW]);
  assert.equal(JSON.parse(globalThis.__sent[0].body).status, "live");
  assert.deepEqual(globalThis.__revalidated, []);
  // Turned on, the flow's pages are drawn again.
  assert.deepEqual(await save({ subscription: { id: "s1" } }), {
    ok: true,
    subscriptionId: "s1",
  });
});

test("wave 2, Set up: the form turns the refusal into a re-read of the section (router.refresh), never a dialog", () => {
  const form = code("app/account/flows/[subscriptionId]/setup/SetupForm.tsx");
  assert.match(
    form,
    /if \(result\.state === "agreement-required"\) \{\s*router\.refresh\(\);\s*return null;\s*\}/u,
  );
  // A 409 on the acceptance: read again, the box unticked, a new key.
  assert.match(
    form,
    /if \(!answer\.ok && answer\.state === "agreement-changed"\) \{\s*setSigned\(\(current\) => \(\{ \.\.\.current, authorized: false \}\)\);\s*setAgreementKey\(`agreement-\$\{crypto\.randomUUID\(\)\}`\);\s*router\.refresh\(\);/u,
  );
});

test("wave 2, Accept: a text changed since it was read (409 agreement_changed) answers agreement-changed in the platform's words", async () => {
  assert.deepEqual(
    await acceptance(
      platformError(
        409,
        { reason: "agreement_changed" },
        "The agreement changed",
      ),
    ),
    { ok: false, error: "The agreement changed", state: "agreement-changed" },
  );
});
