import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EMAIL_ASK_ADMIN,
  EMAIL_DUPLICATE,
  EMAIL_EXTRA_LIMIT,
  EMAIL_INVALID,
  EMAIL_LIMIT_REACHED,
  EMAIL_SAVE_FAILED,
  EMAIL_STARTER,
  EMAIL_TITLE,
  FLOW_EMAIL_PATTERN,
  addProblem,
  andMore,
  emailPath,
  isFlowEmail,
  listedAddresses,
  recipientsLine,
  removeAddress,
} from "../lib/flow-email.ts";

/**
 * Who gets a flow's run email (Build 22, P1 and P5; spec §4; backend
 * ADR-0041): the flow page's step 5 and its email page, in the app's words and
 * by its rules (snoopy-mobile `lib/view/flow-email.ts`). The workspace's owners
 * and admins and the person who starts the run always get it — the session's
 * D1, approved by the owner — and an owner or admin adds more addresses.
 * Example addresses only, never a real one in this public repository.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

// The contract the generated types came from, beside this repository (or at
// SNOOPY_BACKEND_ROOT), whose FlowEmailAddress pattern the types do not carry.
const SPEC_PATH = resolve(
  import.meta.dirname,
  "..",
  process.env.SNOOPY_BACKEND_ROOT || "../snoopy-backend",
  "docs/openapi/automations.yaml",
);

const recipients = {
  people: [
    { email: "owner@example.test", role: "owner" },
    { email: "admin@example.test", role: "admin" },
  ],
  extra: ["ap@example.com"],
};

const goodAddresses = [
  "bookkeeper@example.com",
  "  Bookkeeper@Example.COM ",
  "a.b+c@mail.example.co.uk",
];

test("an address is one the platform takes: FlowEmailAddress's pattern, 3–254 characters, trimmed", () => {
  for (const good of goodAddresses) {
    assert.ok(isFlowEmail(good), good);
  }
  const badAddresses = [
    "bookkeeper",
    "a b@c.com",
    "a@b",
    "a@b.c",
    "@example.com",
    "a@@example.com",
    "a<b>@example.com",
    `${"a".repeat(65)}@example.com`,
    `a@${"b".repeat(250)}.com`,
    "",
  ];
  for (const bad of badAddresses) {
    assert.ok(!isFlowEmail(bad), bad);
  }
  // The contract's own pattern answers every sample as this one does: the
  // generated types drop `pattern`, so it is restated here and held to it.
  if (existsSync(SPEC_PATH)) {
    const spec = readFileSync(SPEC_PATH, "utf8");
    const declared = spec
      .slice(spec.indexOf("    FlowEmailAddress:\n"))
      .match(/\n\s+pattern: '([^']+)'/u)?.[1];
    assert.ok(declared, "FlowEmailAddress has a pattern in the contract");
    const contract = new RegExp(declared, "u");
    for (const sample of [...goodAddresses, ...badAddresses]) {
      assert.equal(
        FLOW_EMAIL_PATTERN.test(sample.trim()),
        contract.test(sample.trim()),
        sample,
      );
    }
  }
});

test("Add is refused before anything is sent: not an address, Enter an email address.; already listed, without case — a person always told or an extra — Already on the list. (S30)", () => {
  assert.equal(addProblem("bookkeeper", recipients), "invalid");
  assert.equal(addProblem("Owner@Example.TEST", recipients), "duplicate");
  assert.equal(addProblem(" AP@example.com ", recipients), "duplicate");
  assert.equal(addProblem("bookkeeper@example.com", recipients), null);
  assert.equal(EMAIL_INVALID, "Enter an email address.");
  assert.equal(EMAIL_DUPLICATE, "Already on the list.");
  assert.equal(EMAIL_SAVE_FAILED, "Could not save. Try again.");
});

test("step 5's row: the first address — owners, then admins, then extras — and and {n} more; nobody listed, the person who starts the run (S22; the app's M2)", () => {
  assert.deepEqual(listedAddresses(recipients), [
    "owner@example.test",
    "admin@example.test",
    "ap@example.com",
  ]);
  assert.deepEqual(recipientsLine(recipients), {
    first: "owner@example.test",
    more: "and 2 more",
  });
  assert.deepEqual(
    recipientsLine({ people: [recipients.people[0]], extra: [] }),
    { first: "owner@example.test", more: null },
  );
  assert.deepEqual(recipientsLine({ people: [], extra: [] }), {
    first: EMAIL_STARTER,
    more: null,
  });
  assert.equal(andMore(9), "and 9 more");
});

test("the email page's words are the spec's, byte for byte", () => {
  assert.equal(EMAIL_TITLE, "Who gets the email");
  assert.equal(EMAIL_STARTER, "The person who starts the run");
  assert.equal(EMAIL_EXTRA_LIMIT, 10);
  assert.equal(EMAIL_LIMIT_REACHED, "You can add up to 10.");
  assert.equal(EMAIL_ASK_ADMIN, "Ask an owner or admin to change this.");
  assert.equal(removeAddress("ap@example.com"), "Remove ap@example.com");
  assert.equal(
    emailPath("f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1"),
    "/account/flows/f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1/email",
  );
});

test("the email page: Always then Also send to; for an owner or admin a remove per extra and the field, at ten the line instead, for a member the line alone; every add and remove sends the whole list at once through the server action beside the vendor page's (S12, S13, S30)", () => {
  const form = read(
    "app/account/flows/[subscriptionId]/email/EmailRecipientsForm.tsx",
  );
  const always = form.search(/\{EMAIL_ALWAYS_LABEL\}/u);
  const also = form.search(/\{EMAIL_ALSO_LABEL\}/u);
  assert.ok(always > 0 && also > always, `${always} ${also}`);
  assert.match(form, /canEdit \? \(\s*<button/u);
  assert.match(
    form,
    /\{canEdit \? \(\s*full \? \([\s\S]*?\{EMAIL_LIMIT_REACHED\}[\s\S]*?<form[\s\S]*?\) : \([\s\S]*?\{EMAIL_ASK_ADMIN\}/u,
  );
  assert.match(form, /const full = extra\.length >= EMAIL_EXTRA_LIMIT;/u);
  // Add: checked first, then the whole list with the new address.
  assert.match(
    form,
    /const problem = addProblem\(draft, recipients\);\s*if \(problem\) \{\s*setError\(problem === "invalid" \? EMAIL_INVALID : EMAIL_DUPLICATE\);\s*return;\s*\}/u,
  );
  assert.match(form, /save\(\[\.\.\.extra, draft\.trim\(\)\]/u);
  // Remove: the list without it, at once, "Removing…" meanwhile.
  assert.match(form, /extra\.filter\(\(listed\) => listed !== address\)/u);
  assert.match(form, /line=\{removing === address \? EMAIL_REMOVING : null\}/u);
  // One write at a time.
  assert.match(form, /const writing = adding \|\| removing !== null;/u);
  const actions = read("app/account/flows/actions.ts");
  const vendor = actions.indexOf("export async function saveVendorChoice(");
  const email = actions.indexOf("export async function saveEmailRecipients(");
  assert.ok(vendor > 0 && email > vendor, `${vendor} ${email}`);
  assert.match(
    actions,
    /const recipients = await updateFlowEmailRecipients\(\s*workspaceId,\s*subscriptionId,\s*\{ extra: extra as string\[\] \},\s*\);\s*revalidatePath\("\/account\/flows", "layout"\);/u,
  );
  assert.match(
    actions,
    /if \(error instanceof PlatformServerError\)\s*return \{ ok: false, error: EMAIL_SAVE_FAILED \};/u,
  );
  // Read on the server, through the generated client.
  const client = read("lib/automations.ts");
  assert.match(
    client,
    /platformServerJson<FlowEmailRecipients>\(\s*`\$\{scope\(workspaceId\)\}\/subscriptions\/\$\{encodeURIComponent\(subscriptionId\)\}\/email-recipients`,\s*\{ method: "PUT", body: JSON\.stringify\(body\) \},\s*\);/u,
  );
});
