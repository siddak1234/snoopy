import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
  AI_CONSENT,
  AI_READING_OFF,
  AI_SETTING,
  POLICY_AFTER_LINK,
  POLICY_BEFORE_LINK,
  asksForConsent,
  runCarriesFile,
  runGate,
} from "../lib/ai-consent.ts";

/**
 * The account's AI consent (backend ADR-0038; the spec's §3.G–§3.H): asked
 * once on the account — "AI reads your documents", Allow or Not now — and kept
 * by the platform, never per run and never in this browser (the owner's
 * build-19 feedback #4). The words, when the card shows, and what Start run
 * does with a run are held here; what the browser does with them is held by
 * e2e/public-edge-fixture.spec.ts ("the account's AI consent"). Neither
 * `startRun` nor the platform asks, so the last test holds the Run window as
 * the only code that starts a run, past its gate.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

test("the card's words are the spec's, byte for byte (§3.G)", () => {
  assert.equal(AI_CONSENT.title, "AI reads your documents");
  assert.equal(
    AI_CONSENT.body,
    "Some flows send a document you add to AI models, through OpenRouter, to read it. They don't keep it.",
  );
  assert.equal(AI_CONSENT.policy, "See our Privacy Policy.");
  assert.equal(AI_CONSENT.policyLink, "Privacy Policy");
  assert.equal(AI_CONSENT.policyHref, "/privacy");
  assert.equal(AI_CONSENT.allow, "Allow");
  assert.equal(AI_CONSENT.notNow, "Not now");
  assert.equal(AI_CONSENT.saveFailed, "Could not save your choice. Try again.");
  assert.deepEqual(AI_SETTING, {
    heading: "AI",
    label: "AI reads documents",
    saveFailed: "Could not save. Try again.",
  });
  assert.deepEqual(AI_READING_OFF, {
    line: "AI reading is off.",
    turnOn: "Turn on",
  });
  // Plain ASCII — a straight apostrophe, the spec's — so no curly quote or
  // dash can creep in and differ from the app's bytes while reading the same.
  for (const words of [AI_CONSENT, AI_SETTING, AI_READING_OFF]) {
    for (const [name, value] of Object.entries(words)) {
      assert.match(value, /^[\x20-\x7e]+$/u, name);
    }
  }
});

test("the link line links its words Privacy Policy, once, and says the rest around it", () => {
  assert.equal(AI_CONSENT.policy.split(AI_CONSENT.policyLink).length, 2);
  assert.equal(POLICY_BEFORE_LINK, "See our ");
  assert.equal(POLICY_AFTER_LINK, ".");
  assert.equal(
    `${POLICY_BEFORE_LINK}${AI_CONSENT.policyLink}${POLICY_AFTER_LINK}`,
    AI_CONSENT.policy,
  );
});

test("the card shows only while the account has never answered — not once it has, and not on a platform that does not ask", () => {
  assert.equal(asksForConsent(null), true);
  assert.equal(asksForConsent("allowed"), false);
  assert.equal(asksForConsent("declined"), false);
  assert.equal(asksForConsent(undefined), false);
});

test("Start run starts a run with a file on a flow that reads it with AI only once the account allowed it (§3.H)", () => {
  const gate = (usesAi, carriesFile, choice) =>
    runGate({ usesAi, carriesFile, choice });
  // Never answered: asked first. Not now: off. Allowed: starts.
  assert.equal(gate(true, true, null), "ask");
  assert.equal(gate(true, true, "declined"), "off");
  assert.equal(gate(true, true, "allowed"), "start");
  // No file, a flow with no AI, or a platform that does not ask: it starts.
  for (const choice of [null, "declined", "allowed", undefined]) {
    assert.equal(gate(true, false, choice), "start", String(choice));
    assert.equal(gate(false, true, choice), "start", String(choice));
  }
  assert.equal(gate(true, true, undefined), "start");
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

test("a run carries a file only through a file field with a file's id, never one left empty", () => {
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

test("the account area shows the card once, Start run asks it before a run it gates, and both draw their words from this module", () => {
  const layout = read("app/account/layout.tsx");
  assert.match(
    layout,
    /\{asksForConsent\(aiDocumentReading\) \? <AiConsentOnce \/> : null\}/u,
  );
  const actions = read("app/account/flows/AutomationActions.tsx");
  assert.match(
    actions,
    /const gate = runGate\(\{\s*usesAi,\s*carriesFile: runCarriesFile\(data\),\s*choice: aiChoice,\s*\}\);\s*if \(gate === "ask"\) \{\s*setAwaitingConsent\(data\);\s*return;\s*\}\s*if \(gate === "off"\) \{[\s\S]*?return;\s*\}\s*sendRun\(data\);/u,
  );
  assert.match(
    actions,
    /<form\s+ref=\{runForm\}\s+onSubmit=\{fromForm\(submitRun\)\}/u,
  );
  const card = read("components/account/AiConsentCard.tsx");
  for (const word of [
    "AI_CONSENT.title",
    "AI_CONSENT.body",
    "POLICY_BEFORE_LINK",
    "AI_CONSENT.policyLink",
    "POLICY_AFTER_LINK",
    "AI_CONSENT.policyHref",
    "AI_CONSENT.notNow",
    "AI_CONSENT.allow",
  ]) {
    assert.ok(card.includes(`{${word}}`), word);
  }
  const setting = read("components/account/AiReadingSetting.tsx");
  for (const word of ["AI_SETTING.heading", "AI_SETTING.label"]) {
    assert.ok(setting.includes(`{${word}}`), word);
  }
});

test("the per-run question is gone, in the same change as the card and the switch: no dialog, no words, nothing kept in this browser (§3.G Removed)", () => {
  const modules = websiteModules();
  const said = across(modules, (node) =>
    ts.isStringLiteralLike(node) || ts.isJsxText(node)
      ? (/AI reads this file|Agree and start|autom8x\.ai-consent/u.exec(
          node.text,
        )?.[0] ?? null)
      : null,
  );
  assert.deepEqual(said, []);
  const names = across(
    modules,
    use(["AiConsentDialog", "hasAiConsent", "recordAiConsent", "aiConsentKey"]),
  );
  assert.deepEqual(names, []);
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
  // sendRun is reached only past the gate: from submitRun (held above, with
  // the form's onSubmit), from the card's Allow, and from Turn on — the last
  // two only once the account allowed it.
  const runWindow = modules.filter(
    ({ path }) => path === "app/account/flows/AutomationActions.tsx",
  );
  assert.deepEqual(
    across(runWindow, use(["sendRun", "answered", "allowAndStart"])),
    [
      "app/account/flows/AutomationActions.tsx: allowAndStart declared",
      "app/account/flows/AutomationActions.tsx: allowAndStart passed as onClick",
      "app/account/flows/AutomationActions.tsx: answered declared",
      "app/account/flows/AutomationActions.tsx: answered passed as onAnswered",
      "app/account/flows/AutomationActions.tsx: sendRun called in allowAndStart",
      "app/account/flows/AutomationActions.tsx: sendRun called in answered",
      "app/account/flows/AutomationActions.tsx: sendRun called in submitRun",
      "app/account/flows/AutomationActions.tsx: sendRun declared",
    ],
  );
  const body = (name) =>
    new RegExp(
      `const ${name} = \\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`,
      "u",
    ).exec(read("app/account/flows/AutomationActions.tsx"))?.[0] ?? "";
  assert.match(
    body("answered"),
    /if \(choice === "allowed" && held\) sendRun\(held\);/u,
  );
  assert.match(
    body("allowAndStart"),
    /saveAiDocumentReading\("allowed"\);\s*if \(!result\.ok\) \{[^}]*return;\s*\}/u,
  );
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
