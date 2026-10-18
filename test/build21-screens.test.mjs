import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

/**
 * Build 21's website guards that are not one module's (spec A1, A3, A8 and the
 * privacy page; the owner's build 20 items and AM1–AM8): no AI consent
 * anywhere, the sign-in line unchanged, no "Connect vendor" button, no request
 * id shown, and the privacy page saying only what v3 changed — and since
 * Build 22, who gets a run's email (D1). Build 22's own are in
 * `build22-screens.test.mjs`.
 */

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");

/** The website's runtime sources: app/, components/, lib/ and hooks/, less the generated contracts. */
function runtimeFiles() {
  const found = [];
  const walk = (directory) => {
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

test("no runtime file says or wires the AI consent — its card, its setting, its gate or the account's answer (A1; the owner's D1)", () => {
  // The spec's own grep (A1 "Done means"), over every runtime file.
  const banned = /ai reads|aiDocumentReading|ai-reading|AiConsent|usesAi/iu;
  const found = runtimeFiles().filter((path) => banned.test(read(path)));
  assert.deepEqual(found, []);
  for (const gone of [
    "components/account/AiConsentCard.tsx",
    "components/account/AiReadingSetting.tsx",
    "lib/ai-consent.ts",
    "lib/ai-document-reading.ts",
    "app/account/ai-consent-actions.ts",
  ]) {
    assert.equal(existsSync(join(root, gone)), false, gone);
  }
});

test("the sign-in line is today's, word for word, and says nothing of AI (A1; the owner's D1: the Terms and the Privacy Policy cover it)", () => {
  const form = read("app/(auth)/login/LoginForm.tsx").replace(/\s+/gu, " ");
  assert.match(
    form,
    /By continuing, you agree to our\{" "\} <Link prefetch=\{false\} href="\/terms" className="[^"]*" > Terms of Service <\/Link>\{" "\} and\{" "\} <Link prefetch=\{false\} href="\/privacy" className="[^"]*" > Privacy Policy <\/Link> \. <\/p>/u,
  );
  assert.doesNotMatch(form, /\bAI\b/u);
});

test('"Connect vendor ›" is gone, and no page draws a "Connect vendor" button — the vendor row says its state (A3; the owner\'s build 20 items 4 and 5)', () => {
  for (const path of runtimeFiles()) {
    const source = read(path);
    assert.doesNotMatch(source, /Connect vendor ›/u, path);
    // Since Build 22 the vendor page is "Connect integration" too (S21), so
    // nothing says it (build22-screens holds every form of it).
    assert.doesNotMatch(source, />\s*Connect vendor\s*</u, path);
  }
});

test("a run's request id is never shown (A8): no page that shows runs reads it", () => {
  // A join request's id (onboarding) is another thing; these are a run's pages.
  for (const path of runtimeFiles()) {
    if (!/^app\/account\/(?:runs|flows|approvals|page\.tsx)/u.test(path))
      continue;
    assert.doesNotMatch(read(path), /requestId/u, path);
  }
});

/** The privacy page's text, as a person reads it: JSX's lines joined, its entities read. */
function privacyText() {
  return read("app/(marketing)/privacy/page.tsx")
    .replace(/\{" "\}/gu, " ")
    .replace(/&apos;/gu, "'")
    .replace(/&quot;/gu, '"')
    .replace(/\s+/gu, " ");
}

test("the privacy page says what v3 does — every financial document in a file, each one's details kept and downloadable, the results emailed to the owners and admins, the person who started the run and the flow's other addresses (Build 22, D1) — and no longer what it does not", () => {
  const text = privacyText();
  for (const said of [
    "Effective and last updated: October 17, 2026.",
    "Invoice Processing does, to read the bills, invoices, receipts, credit notes, statements and other financial documents in it before saving their details, recording them in QuickBooks Online, or comparing them with what QuickBooks holds.",
    // The spec's sentence, word for word.
    "What the run makes of each document, including its line items and the store's location when printed, is kept with the run's results, shown to the members of your workspace, and can be downloaded as a file.",
    // Build 22 (spec §4, S28): who gets it since D1 — the session's
    // suggestion the owner approved, replacing AM3 — the rest unchanged.
    "The results of each Invoice Processing run are emailed to the workspace's owners and admins, to the person who started it, and to any other address an owner or admin adds to the flow: each document's type, seller and total and what happened to it, built from the details read from the document and, when it records the document in QuickBooks or compares it with what QuickBooks holds, from QuickBooks' answer.",
  ]) {
    assert.ok(text.includes(said), said);
  }
  for (const gone of [
    "October 14, 2026",
    "to read a bill, receipt, credit note or statement before saving its details",
    "up to five",
    "What the run makes of the document is kept",
    "Also email",
    "Send results to",
    "bookkeeper",
    // AM3's sentence, untrue since D1.
    "to the person who started it or, for a run nobody started",
  ]) {
    assert.ok(!text.includes(gone), gone);
  }
});
