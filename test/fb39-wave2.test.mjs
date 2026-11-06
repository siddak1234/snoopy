import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  AGREEMENT_FINALIZING,
  AGREEMENT_UNAVAILABLE,
  CONTRACT_STEP,
  agreementAccepted,
  contractAllowsTurnOn,
  contractStep,
  fillForDisplay,
  signerLine,
} from "../lib/health-agreement.ts";
import { batchRows } from "../lib/run-progress.ts";
import { visibleWords } from "./blocks-harness.mjs";
import {
  cleanupLoaded,
  code,
  draw,
  load,
  tree,
} from "./round21-stage2-harness.mjs";

/**
 * Builds 37 and 39, wave 2 on the website (the owner's items 9 and 10; plan
 * decisions 1, 2, 5 and 8): Set up's "Contract and accept" state and words,
 * the text filled for display, and a batch run's steps by name. The same
 * rows as the app's `snoopy-mobile/__tests__/fb39-wave2.test.ts`. The clicks are
 * `e2e/health-data.spec.ts`; the actions, `round21-stage2-c3-actions.test.mjs`.
 */

after(cleanupLoaded);

test("wave 2 words: the plan's, byte for byte, as the app says them", () => {
  assert.equal(CONTRACT_STEP, "Contract and accept");
  assert.equal(AGREEMENT_FINALIZING, "The agreement is being finalized.");
  assert.equal(AGREEMENT_UNAVAILABLE, "Unavailable");
  assert.equal(
    agreementAccepted(2, "Nov 6, 2026"),
    "Accepted · Version 2 · Nov 6, 2026",
  );
  assert.equal(
    signerLine("Dana Owner", "Practice manager"),
    "Dana Owner, Practice manager",
  );
});

const CURRENT = { version: 1, sha256: "a".repeat(64) };
const ACCEPTANCE = {
  id: "d1",
  kind: "health-data",
  version: 1,
  signerName: "Dana Owner",
  signerTitle: "Practice manager",
  acceptedAt: "2026-11-06T15:00:00.000Z",
};
const TEXT = { version: 1, text: "# BAA", sha256: "a".repeat(64) };
const open = { current: CURRENT, acceptance: null };

test("contractStep: every state, in its precedence — hidden, unavailable, finalizing, accepted, sign, ask-owner", () => {
  const row = (input) => ({
    role: "owner",
    healthData: true,
    read: open,
    text: TEXT,
    readFailed: false,
    ...input,
  });
  for (const [input, state] of [
    // Not a health flow: nothing, whatever was read.
    [{ healthData: false }, "hidden"],
    [{ healthData: false, readFailed: true }, "hidden"],
    // A read that failed wins over everything else.
    [{ readFailed: true }, "unavailable"],
    [
      { readFailed: true, read: { current: null, acceptance: null } },
      "unavailable",
    ],
    [{ readFailed: true, role: "member", read: null }, "unavailable"],
    // Nothing published: for the owner, an admin, and a 503 text read.
    [{ read: { current: null, acceptance: null }, text: null }, "finalizing"],
    [
      { role: "admin", read: { current: null, acceptance: null }, text: null },
      "finalizing",
    ],
    [{ text: "unpublished" }, "finalizing"],
    // Finalizing wins over an acceptance (never sent with `current` null).
    [{ read: { current: null, acceptance: ACCEPTANCE } }, "finalizing"],
    // Accepted, the owner or an admin.
    [
      { read: { current: CURRENT, acceptance: ACCEPTANCE }, text: null },
      "accepted",
    ],
    [
      {
        role: "admin",
        read: { current: CURRENT, acceptance: ACCEPTANCE },
        text: null,
      },
      "accepted",
    ],
    // The owner signs the text read; without it, unavailable.
    [{}, "sign"],
    [{ text: null }, "unavailable"],
    [{ read: null, text: null }, "unavailable"],
    // Anyone else asks the owner: an admin, a member (never read), no role.
    [{ role: "admin", text: null }, "ask-owner"],
    [{ role: "member", read: null, text: null }, "ask-owner"],
    [{ role: undefined, read: null, text: null }, "ask-owner"],
  ])
    assert.equal(contractStep(row(input)), state, JSON.stringify(input));
});

test("contractAllowsTurnOn: a flow without it and an accepted one, yes; the owner's sign only with the box ticked and both fields filled; never finalizing, unavailable or ask-owner", () => {
  const full = { authorized: true, name: "Dana", title: "Owner" };
  for (const [state, signed, allowed] of [
    ["hidden", { authorized: false, name: "", title: "" }, true],
    ["accepted", { authorized: false, name: "", title: "" }, true],
    ["sign", full, true],
    ["sign", { ...full, authorized: false }, false],
    ["sign", { ...full, name: "  " }, false],
    ["sign", { ...full, title: "" }, false],
    ["finalizing", full, false],
    ["unavailable", full, false],
    ["ask-owner", full, false],
  ])
    assert.equal(
      contractAllowsTurnOn(state, signed),
      allowed,
      `${state} ${JSON.stringify(signed)}`,
    );
});

test("fillForDisplay: every {Covered Entity} the workspace's name and every {Effective date} today's UTC date; a text with neither unchanged", () => {
  assert.equal(
    fillForDisplay(
      "Between {Covered Entity} and Autom8x, effective {Effective date}. {Covered Entity} agrees; from {Effective date}.",
      "Acme Clinic",
      "2026-11-06T23:59:00.000Z",
    ),
    "Between Acme Clinic and Autom8x, effective 2026-11-06. Acme Clinic agrees; from 2026-11-06.",
  );
  assert.equal(fillForDisplay("# BAA", "Acme Clinic", "2026-11-06"), "# BAA");
});

const STEP_FILE = "app/account/flows/[subscriptionId]/setup/ContractStep.tsx";
const VIEW = {
  organization: "Acme Clinic",
  offer: null,
  acceptance: null,
  today: "2026-11-06T12:00:00.000Z",
};
const UNSIGNED = { authorized: false, name: "", title: "" };

async function section(view, signed = UNSIGNED) {
  const { ContractStep } = await load(STEP_FILE);
  return draw(ContractStep, {
    index: 4,
    view: { ...VIEW, ...view },
    signed,
    onSigned: () => {},
  });
}

test("Contract and accept: numbered as the sections before it, then by state — finalizing, accepted with its signer, ask-owner, Unavailable", async () => {
  assert.deepEqual(visibleWords(await section({ state: "finalizing" })), [
    "04",
    "Contract and accept",
    "The agreement is being finalized.",
  ]);
  assert.deepEqual(
    visibleWords(
      await section({
        state: "accepted",
        acceptance: {
          version: 1,
          signerName: "Dana Owner",
          signerTitle: "Practice manager",
          acceptedAt: "2026-11-06T15:00:00.000Z",
        },
      }),
    ),
    [
      "04",
      "Contract and accept",
      "Accepted · Version 1 · Nov 6, 2026",
      "Dana Owner, Practice manager",
    ],
  );
  assert.deepEqual(visibleWords(await section({ state: "ask-owner" })), [
    "04",
    "Contract and accept",
    "Ask your workspace owner to accept the health data agreement.",
  ]);
  assert.deepEqual(visibleWords(await section({ state: "unavailable" })), [
    "04",
    "Contract and accept",
    "Unavailable",
  ]);
});

test("Contract and accept, the owner signing: the text filled in a scroll box the keyboard reaches, then the box, Full name and Title (120)", async () => {
  const markup = await section({
    state: "sign",
    offer: {
      version: 1,
      text: "Between {Covered Entity} and Autom8x, effective {Effective date}.",
      sha256: "a".repeat(64),
    },
  });
  assert.deepEqual(visibleWords(markup), [
    "04",
    "Contract and accept",
    "Between Acme Clinic and Autom8x, effective 2026-11-06.",
    "I'm authorized to sign for Acme Clinic",
    "Full name",
    "Title",
  ]);
  const nodes = tree(markup);
  const box = nodes.find(
    (node) => node.attrs["data-testid"] === "setup-agreement-text",
  );
  assert.equal(box.attrs.tabindex, "0");
  assert.equal(box.attrs.role, "region");
  assert.match(box.attrs.class, /\boverflow-y-auto\b/u);
  assert.equal(
    nodes.filter((node) => node.attrs.maxLength === "120").length,
    2,
  );
  const group = nodes.find(
    (node) => node.attrs["data-testid"] === "setup-contract",
  );
  assert.equal(group.attrs.role, "group");
  assert.equal(group.attrs["aria-label"], "Contract and accept");
});

test("Set up numbers it after the flow's own sections, Connect counted, and holds only Turn on by it", () => {
  const form = code("app/account/flows/[subscriptionId]/setup/SetupForm.tsx");
  assert.match(
    form,
    /index=\{\s*\(hasConnect \? 1 : 0\) \+\s*setupSectionCount\(setup, sections, true\) \+\s*1\s*\}/u,
  );
  assert.match(
    form,
    /const contractHolds =\s*turnOn &&\s*shownContract !== null &&\s*!contractAllowsTurnOn\(shownContract\.state, signed\);/u,
  );
  assert.match(form, /disabled=\{pending \|\| contractHolds\}/u);
  // One press: accept, once, then the save; a 403 on the save reads the
  // section again, never a dialog.
  assert.match(form, /acceptThenRepeat\(!signing, accept, save\)/u);
  assert.doesNotMatch(form, /HealthAgreementDialog/u);
});

// ICD-10 Code Check v4 (snoopy-automations manifests/icd10-code-check.v4.json):
// its groups, and its batch run's steps as the catalog publishes them, each
// in the first group (ADR-0048 amendment 6) — which the rows ignore.
const GROUPS = [
  { id: "upload", title: "Add visit notes" },
  { id: "read", title: "AI reading" },
  { id: "check", title: "Code check" },
  { id: "approve", title: "Your review" },
  { id: "email", title: "Run completed", platform: "email" },
];
const BATCH = {
  pipeline: [
    { id: "chunk", title: "Pages counted", description: "", group: "upload" },
    {
      id: "categorize",
      title: "Pages sorted",
      description: "",
      group: "upload",
    },
    { id: "organize", title: "Visits found", description: "", group: "upload" },
    { id: "queue", title: "Visits queued", description: "", group: "upload" },
  ],
};
const T = (minute) =>
  `2026-11-06T14:${String(minute).padStart(2, "0")}:00.000Z`;
const ok = (stepId, minute) => ({
  stepId,
  outcome: "ok",
  summary: "never shown",
  occurredAt: T(minute),
});
const rows = (steps, run, email) =>
  batchRows(steps, BATCH, GROUPS, run, undefined, email ? { email } : {}).map(
    ({ title, state, sub }) => [title, state, sub],
  );

test("batchRows, ICD-10 v4: running after chunk — 1 Done, 2 Working…, 3 and 4 Waiting; never the flow's groups", () => {
  assert.deepEqual(rows([ok("chunk", 32)], { status: "running" }), [
    ["1 · Pages counted", "done", "Done · 2:32 PM"],
    ["2 · Pages sorted", "working", "Working…"],
    ["3 · Visits found", "waiting", "Waiting"],
    ["4 · Visits queued", "waiting", "Waiting"],
  ]);
});

const ALL = [
  ok("chunk", 32),
  ok("categorize", 33),
  ok("organize", 34),
  ok("queue", 35),
];

test("batchRows: succeeded with its email sent — four Done, then 5 · Run completed, Email sent · {time}", () => {
  assert.deepEqual(
    rows(ALL, { status: "succeeded" }, { status: "sent", sentAt: T(40) }),
    [
      ["1 · Pages counted", "done", "Done · 2:32 PM"],
      ["2 · Pages sorted", "done", "Done · 2:33 PM"],
      ["3 · Visits found", "done", "Done · 2:34 PM"],
      ["4 · Visits queued", "done", "Done · 2:35 PM"],
      ["5 · Run completed", "done", "Email sent · 2:40 PM"],
    ],
  );
});

test("batchRows: succeeded with no email — the four steps alone", () => {
  assert.deepEqual(
    rows(ALL, { status: "succeeded" }).map(([title]) => title),
    [
      "1 · Pages counted",
      "2 · Pages sorted",
      "3 · Visits found",
      "4 · Visits queued",
    ],
  );
});

test("batchRows: failed at organize — 1 and 2 Done, 3 the run's reason, 4 Stopped, its email Failed", () => {
  assert.deepEqual(
    rows(
      [
        ok("chunk", 32),
        ok("categorize", 33),
        { ...ok("organize", 34), outcome: "failed" },
      ],
      { status: "failed", failureReason: "No visits were found." },
      { status: "not_sent", sentAt: null },
    ),
    [
      ["1 · Pages counted", "done", "Done · 2:32 PM"],
      ["2 · Pages sorted", "done", "Done · 2:33 PM"],
      ["3 · Visits found", "failed", "No visits were found."],
      ["4 · Visits queued", "stopped", "Stopped"],
      ["5 · Run completed", "failed", "Failed"],
    ],
  );
});

test("batchRows: a step the flow no longer declares — the steps it reported, titled from batch.pipeline, Step {n} for the rest, Working… while it goes", () => {
  assert.deepEqual(
    rows(
      [ok("chunk", 32), ok("split", 33)],
      { status: "running" },
      {
        status: "waiting",
        sentAt: null,
      },
    ),
    [
      ["1 · Pages counted", "done", "Done · 2:32 PM"],
      ["2 · Step 2", "done", "Done · 2:33 PM"],
      ["3 · Step 3", "working", "Working…"],
    ],
  );
});

test("a batch's child and a flow without batch keep the group rows: the run page chooses batchRows only for run.batch with the flow's batch", () => {
  const live = code("app/account/runs/[runId]/RunLive.tsx");
  assert.match(
    live,
    /run\.batch === true && flow\?\.batch\s*\?\s*batchRows\(steps, flow\.batch, flow\.groups, run, undefined, \{/u,
  );
  assert.match(
    live,
    /:\s*trackerRows\(\s*steps,\s*flow\?\.pipeline,\s*flow\?\.groups,/u,
  );
  const data = code("app/account/runs/[runId]/run-page-data.ts");
  assert.match(
    data,
    /\.\.\.\(entry\.batch\s*\?\s*\{\s*batch: \{\s*pipeline: entry\.batch\.pipeline\.map\(\(step\) => \(\{\s*id: step\.id,\s*title: step\.title,\s*\}\)\),/u,
  );
});
