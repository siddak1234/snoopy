import assert from "node:assert/strict";
import { after, test } from "node:test";
import { ASK_OWNER } from "../lib/health-agreement.ts";
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
    /purpose="run"\s+onAccepted=\{\(\) => send\(offer\.input\)\}/u,
  );
  // Beside the card's dialog, never in its form, whose changes make a new key.
  assert.match(card, /<\/Modal>\s*\{offer \? \(\s*<HealthAgreementDialog/u);
});
