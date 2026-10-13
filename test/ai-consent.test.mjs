import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
  AI_CONSENT,
  AI_CONSENT_VERSION,
  POLICY_AFTER_LINK,
  POLICY_BEFORE_LINK,
  aiConsentKey,
  hasAiConsent,
  recordAiConsent,
  runCarriesFile,
} from "../app/account/flows/ai-consent.ts";

/**
 * The question the Run window asks before a run whose input carries a file
 * starts — Apple's App Review Guideline 5.1.2(i), asked by the app in the same
 * words (snoopy-mobile, round-17/deletion-and-consent). The words, the key the
 * agreement is kept under, and what counts as agreement are held here; what the
 * browser does with them is held by e2e/public-edge-fixture.spec.ts ("asking
 * before a run's file goes to an AI"). Neither `startRun` nor the platform
 * asks, so the last test here holds the Run window as the only code that starts
 * a run.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the words are the app's, byte for byte", () => {
  assert.equal(AI_CONSENT.title, "AI reads this file");
  assert.equal(
    AI_CONSENT.body,
    "To read the file you give this run, Autom8x sends it to OpenRouter, which passes it to an AI model provider in the United States, using only endpoints that OpenRouter lists as zero data retention.",
  );
  assert.equal(
    AI_CONSENT.policy,
    "Our Privacy Policy names the providers and explains what may be kept.",
  );
  assert.equal(AI_CONSENT.policyLink, "Privacy Policy");
  assert.equal(AI_CONSENT.policyHref, "/privacy");
  assert.equal(AI_CONSENT.agree, "Agree and start");
  assert.equal(AI_CONSENT.cancel, "Cancel");
  // Plain ASCII, so no curly quote or dash can creep in and differ from the
  // app's bytes while reading the same.
  for (const [name, words] of Object.entries(AI_CONSENT)) {
    assert.match(words, /^[\x20-\x7e]+$/u, name);
  }
});

test("the second line links its words Privacy Policy, once, and says the rest around it", () => {
  assert.equal(AI_CONSENT.policy.split(AI_CONSENT.policyLink).length, 2);
  assert.equal(POLICY_BEFORE_LINK, "Our ");
  assert.equal(
    POLICY_AFTER_LINK,
    " names the providers and explains what may be kept.",
  );
  assert.equal(
    `${POLICY_BEFORE_LINK}${AI_CONSENT.policyLink}${POLICY_AFTER_LINK}`,
    AI_CONSENT.policy,
  );
});

test("the agreement is kept under a key naming the consent's version and the person's id, and without an id under none", () => {
  assert.equal(AI_CONSENT_VERSION, 1);
  assert.equal(
    aiConsentKey("22222222-2222-4222-8222-222222222222"),
    "autom8x.ai-consent.v1.22222222-2222-4222-8222-222222222222",
  );
  assert.notEqual(aiConsentKey("a"), aiConsentKey("b"));
  assert.equal(aiConsentKey(""), null);
});

/** A browser's storage, as a map, whose reads and writes can be made to fail. */
function storage({ failRead = false, failWrite = false } = {}) {
  const kept = new Map();
  return {
    kept,
    getItem(key) {
      if (failRead) throw new DOMException("refused", "SecurityError");
      return kept.has(key) ? kept.get(key) : null;
    },
    setItem(key, value) {
      if (failWrite) throw new DOMException("full", "QuotaExceededError");
      kept.set(key, String(value));
    },
  };
}

// Storage a browser will not even hand over: reading `window.localStorage`
// throws.
const unreachable = () => {
  throw new DOMException("refused", "SecurityError");
};

const owner = "22222222-2222-4222-8222-222222222222";
const admin = "12121212-1212-4121-8121-121212121212";
const agreedIn = (store, userId) => hasAiConsent(() => store, userId);
const keepIn = (store, userId) => recordAiConsent(() => store, userId);

test("agreement is read only as the value kept for this person; a read that fails, or storage that cannot be reached, is never agreement", () => {
  const store = storage();
  assert.equal(agreedIn(store, owner), false);
  assert.equal(keepIn(store, owner), true);
  assert.deepEqual([...store.kept], [[aiConsentKey(owner), "agreed"]]);
  assert.equal(agreedIn(store, owner), true);
  // Another person signed in to this browser is asked afresh.
  assert.equal(agreedIn(store, admin), false);
  // A person with no id is never read as agreed, whatever is kept.
  store.kept.set("autom8x.ai-consent.v1.", "agreed");
  assert.equal(agreedIn(store, ""), false);
  // Anything but the value kept is not agreement.
  for (const value of ["true", "1", "yes", "Agreed", "agreed ", ""]) {
    store.kept.set(aiConsentKey(admin), value);
    assert.equal(agreedIn(store, admin), false, value);
  }
  // A read the browser refuses, and storage it will not hand over.
  const refusing = storage({ failRead: true });
  refusing.kept.set(aiConsentKey(owner), "agreed");
  assert.equal(agreedIn(refusing, owner), false);
  assert.equal(hasAiConsent(unreachable, owner), false);
});

test("a write that fails is answered false and never thrown, so the run still starts", () => {
  const full = storage({ failWrite: true });
  assert.equal(keepIn(full, owner), false);
  assert.equal(full.kept.size, 0);
  assert.equal(recordAiConsent(unreachable, owner), false);
  // With no id, nothing is kept at all.
  const store = storage();
  assert.equal(keepIn(store, ""), false);
  assert.equal(store.kept.size, 0);
});

/** A run's form as ManifestFields.tsx and RunFileField.tsx post it. */
function runForm(entries) {
  const form = new FormData();
  for (const [name, value] of entries) form.append(name, value);
  form.set("subscriptionId", "99999999-9999-4999-8999-999999999999");
  form.set("idempotencyKey", "run-0f8b7c1e-0000-4000-8000-000000000000");
  form.set("workspaceId", "11111111-1111-4111-8111-111111111111");
  return form;
}

test("only a run whose input carries a file asks: a file field with a file's id, never one left empty", () => {
  const typed = [
    ["input-control:vendor", "text"],
    ["input:vendor", "Acme Supplies"],
    ["input-control:amount", "money"],
    ["input:amount", "120.50"],
  ];
  assert.equal(runCarriesFile(runForm(typed)), false);
  // The file field drawn, nothing chosen (or a choice refused): no id is posted.
  assert.equal(
    runCarriesFile(
      runForm([...typed, ["input-control:artifactId", "artifact"]]),
    ),
    false,
  );
  for (const blank of ["", "  "]) {
    assert.equal(
      runCarriesFile(
        runForm([
          ...typed,
          ["input-control:artifactId", "artifact"],
          ["input:artifactId", blank],
        ]),
      ),
      false,
      JSON.stringify(blank),
    );
  }
  // A completed upload's id.
  assert.equal(
    runCarriesFile(
      runForm([
        ...typed,
        ["input-control:artifactId", "artifact"],
        ["input:artifactId", "5d1c1f0e-7a8b-4c9d-8e0f-123456789abc"],
      ]),
    ),
    true,
  );
  // Two file fields, one of them chosen.
  assert.equal(
    runCarriesFile(
      runForm([
        ["input-control:receipt", "artifact"],
        ["input-control:invoice", "artifact"],
        ["input:invoice", "5d1c1f0e-7a8b-4c9d-8e0f-123456789abc"],
      ]),
    ),
    true,
  );
  // A value is a file only under a file control: text that looks like an id,
  // or a setup form's control, is not.
  assert.equal(
    runCarriesFile(
      runForm([
        ["input-control:reference", "text"],
        ["input:reference", "5d1c1f0e-7a8b-4c9d-8e0f-123456789abc"],
        ["config-control:artifactId", "artifact"],
        ["config:artifactId", "5d1c1f0e-7a8b-4c9d-8e0f-123456789abc"],
      ]),
    ),
    false,
  );
});

test("the Run window asks before a run with a file, and the dialog draws the words from this module", () => {
  const actions = read("app/account/flows/AutomationActions.tsx");
  assert.match(
    actions,
    /if \(runCarriesFile\(data\) && !hasAiConsent\(browserStorage, userId\)\) \{\s*setAwaitingConsent\(data\);\s*return;\s*\}\s*sendRun\(data\);/u,
  );
  assert.match(actions, /<form\s+onSubmit=\{fromForm\(submitRun\)\}/u);
  const dialog = read("app/account/flows/AiConsentDialog.tsx");
  for (const word of [
    "AI_CONSENT.title",
    "AI_CONSENT.body",
    "POLICY_BEFORE_LINK",
    "AI_CONSENT.policyLink",
    "POLICY_AFTER_LINK",
    "AI_CONSENT.policyHref",
    "AI_CONSENT.cancel",
    "AI_CONSENT.agree",
  ]) {
    assert.ok(dialog.includes(`{${word}}`), word);
  }
});

/**
 * The website's own modules — app/, components/, hooks/ and lib/, less the
 * contracts generated into lib/generated/, which name every operation — and the
 * root's proxy.ts and instrumentation.ts, each parsed by TypeScript, so a
 * comment or a sentence is never taken for code.
 */
function websiteModules() {
  const found = [];
  const walk = (directory) => {
    const at = resolve(import.meta.dirname, "..", directory);
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) {
        if (path !== "lib/generated") walk(path);
      } else if (/\.tsx?$/u.test(entry.name)) found.push(path);
    }
  };
  for (const directory of ["app", "components", "hooks", "lib"])
    walk(directory);
  found.push("proxy.ts", "instrumentation.ts");
  return found.map((path) => ({
    path,
    source: ts.createSourceFile(
      path,
      read(path),
      ts.ScriptTarget.Latest,
      true,
      path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  }));
}

/** The function a node is in: the nearest one with a name, or held by a const. */
function enclosingName(node) {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name) return at.name.text;
    if (
      (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) &&
      ts.isVariableDeclaration(at.parent) &&
      ts.isIdentifier(at.parent.name)
    )
      return at.parent.name.text;
  }
  return "the module";
}

/** Every node `found` answers for, as "<file>: <what it says>", sorted. */
function across(modules, found) {
  const said = [];
  for (const { path, source } of modules) {
    const visit = (node) => {
      const what = found(node);
      if (what) said.push(`${path}: ${what}`);
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return said.sort();
}

/** How a name is used where it appears in code. */
function use(names) {
  return (node) => {
    if (!ts.isIdentifier(node) || !names.includes(node.text)) return null;
    const { parent } = node;
    if (
      (ts.isFunctionDeclaration(parent) || ts.isVariableDeclaration(parent)) &&
      parent.name === node
    )
      return `${node.text} declared`;
    if (ts.isImportSpecifier(parent)) return `${node.text} imported`;
    if (ts.isCallExpression(parent) && parent.expression === node)
      return `${node.text} called in ${enclosingName(node)}`;
    if (ts.isJsxExpression(parent) && ts.isJsxAttribute(parent.parent))
      return `${node.text} passed as ${parent.parent.name.getText()}`;
    return `${node.text} used in ${enclosingName(node)}`;
  };
}

test("the Run window is the only code here that starts a run: neither startRun nor the platform asks before a run's file goes to an AI", () => {
  const modules = websiteModules();
  assert.ok(
    modules.length > 100 &&
      modules.some(({ path }) => path === "lib/automations.ts"),
    "the walk found too little; it is now blind",
  );
  // The platform's start is called by startRun alone, and startRun by the Run
  // window's sendRun alone: no other code imports, calls or passes either.
  assert.deepEqual(across(modules, use(["createRun", "startRun"])), [
    "app/account/flows/AutomationActions.tsx: startRun called in sendRun",
    "app/account/flows/AutomationActions.tsx: startRun imported",
    "app/account/flows/actions.ts: createRun called in startRun",
    "app/account/flows/actions.ts: createRun imported",
    "app/account/flows/actions.ts: startRun declared",
    "lib/automations.ts: createRun declared",
  ]);
  // sendRun is reached only after the question: from submitRun past its gate
  // (held above, with the form's onSubmit) and from Agree and start.
  const runWindow = modules.filter(
    ({ path }) => path === "app/account/flows/AutomationActions.tsx",
  );
  assert.deepEqual(across(runWindow, use(["sendRun", "agreeAndStart"])), [
    "app/account/flows/AutomationActions.tsx: agreeAndStart declared",
    "app/account/flows/AutomationActions.tsx: agreeAndStart passed as onAgree",
    "app/account/flows/AutomationActions.tsx: sendRun called in agreeAndStart",
    "app/account/flows/AutomationActions.tsx: sendRun called in submitRun",
    "app/account/flows/AutomationActions.tsx: sendRun declared",
  ]);
  // Nothing else names the platform's runs, so no other code — in the browser,
  // through /api/platform, or on the server — can start one: lib/automations.ts
  // alone, in its four functions.
  const runsPath = (node) =>
    (ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)) &&
    /(?<!\/account)\/runs\b/u.test(node.text)
      ? `the platform's runs in ${enclosingName(node)}`
      : null;
  assert.deepEqual(across(modules, runsPath), [
    "lib/automations.ts: the platform's runs in cancelRun",
    "lib/automations.ts: the platform's runs in createRun",
    "lib/automations.ts: the platform's runs in listRuns",
    "lib/automations.ts: the platform's runs in readRun",
  ]);
});
