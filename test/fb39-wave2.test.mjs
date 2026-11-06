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
import { batchRows, batchStepsFor, trackerRows } from "../lib/run-progress.ts";
import { visibleWords } from "./blocks-harness.mjs";
import {
  cleanupLoaded,
  code,
  draw,
  load,
  tree,
} from "./round21-stage2-harness.mjs";

/**
 * Builds 37 and 39, wave 2 on the website (the owner's items 9 and 10;
 * backend ADR-0049 amendment 2, ADR-0048 amendment 6): Set up's "Contract
 * and accept" state and words, the text filled for display, and a batch
 * run's steps by name. `contractStep`, `fillForDisplay`, `batchRows` and
 * `batchStepsFor` hold the SAME rows as the app's
 * `snoopy-mobile/__tests__/fb39-wave2.test.ts`, copied as they are. The clicks are
 * `e2e/health-data.spec.ts`; the actions, `round21-stage2-c3-actions.test.mjs`.
 */

after(cleanupLoaded);

test("wave 2 words: byte for byte, as the app says them", () => {
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

// The app's rows, copied as they are.
const CURRENT = { version: 1, sha256: "a".repeat(64) };
const ACCEPTANCE = {
  id: "00000000-0000-4000-8000-0000000000d1",
  kind: "health-data",
  version: 1,
  signerName: "Dana Reyes",
  signerTitle: "Practice manager",
  acceptedAt: "2026-11-04T12:00:00Z",
};
const TEXT = { version: 1, text: "The agreement.", sha256: "a".repeat(64) };
const read = (current, acceptance) => ({
  kind: "health-data",
  current,
  acceptance,
});

test("contractStep: every state, in its precedence (the app's rows)", () => {
  for (const [name, input, state] of [
    [
      "not a health flow (owner)",
      {
        role: "owner",
        healthData: undefined,
        read: undefined,
        text: undefined,
        readFailed: false,
      },
      "hidden",
    ],
    [
      "not a health flow, even with a failed read",
      {
        role: "owner",
        healthData: false,
        read: undefined,
        text: undefined,
        readFailed: true,
      },
      "hidden",
    ],
    [
      "a member (never read)",
      {
        role: "member",
        healthData: true,
        read: undefined,
        text: undefined,
        readFailed: false,
      },
      "ask-owner",
    ],
    [
      "an admin, not accepted",
      {
        role: "admin",
        healthData: true,
        read: read(CURRENT, null),
        text: undefined,
        readFailed: false,
      },
      "ask-owner",
    ],
    [
      "an admin, accepted",
      {
        role: "admin",
        healthData: true,
        read: read(CURRENT, ACCEPTANCE),
        text: undefined,
        readFailed: false,
      },
      "accepted",
    ],
    [
      "an admin, nothing published",
      {
        role: "admin",
        healthData: true,
        read: read(null, null),
        text: undefined,
        readFailed: false,
      },
      "finalizing",
    ],
    [
      "an admin, the read failed",
      {
        role: "admin",
        healthData: true,
        read: undefined,
        text: undefined,
        readFailed: true,
      },
      "unavailable",
    ],
    [
      "the owner, nothing published",
      {
        role: "owner",
        healthData: true,
        read: read(null, null),
        text: undefined,
        readFailed: false,
      },
      "finalizing",
    ],
    [
      "the owner, the text 503",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, null),
        text: "unpublished",
        readFailed: false,
      },
      "finalizing",
    ],
    [
      "the owner, accepted",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, ACCEPTANCE),
        text: undefined,
        readFailed: false,
      },
      "accepted",
    ],
    [
      "the owner, not accepted, the text read",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, null),
        text: TEXT,
        readFailed: false,
      },
      "sign",
    ],
    [
      "the owner, the read failed",
      {
        role: "owner",
        healthData: true,
        read: undefined,
        text: undefined,
        readFailed: true,
      },
      "unavailable",
    ],
    [
      "the owner, the text failed (not 503)",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, null),
        text: undefined,
        readFailed: true,
      },
      "unavailable",
    ],
    [
      "precedence: a failed read over an acceptance",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, ACCEPTANCE),
        text: undefined,
        readFailed: true,
      },
      "unavailable",
    ],
    [
      "precedence: finalizing over an acceptance",
      {
        role: "owner",
        healthData: true,
        read: read(null, ACCEPTANCE),
        text: undefined,
        readFailed: false,
      },
      "finalizing",
    ],
    [
      "precedence: accepted over sign",
      {
        role: "owner",
        healthData: true,
        read: read(CURRENT, ACCEPTANCE),
        text: TEXT,
        readFailed: false,
      },
      "accepted",
    ],
  ])
    assert.equal(contractStep(input), state, name);
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

test("fillForDisplay: the two placeholders, for display only (the app's rows)", () => {
  for (const [name, text, filled] of [
    [
      "both",
      "Between {Covered Entity} and Autom8x, from {Effective date}.",
      "Between Acme Clinic and Autom8x, from 2026-11-06.",
    ],
    [
      "repeated",
      "{Covered Entity} agrees. {Covered Entity} signs on {Effective date}; {Effective date}.",
      "Acme Clinic agrees. Acme Clinic signs on 2026-11-06; 2026-11-06.",
    ],
    ["none", "No placeholders here.", "No placeholders here."],
  ])
    assert.equal(
      fillForDisplay(text, "Acme Clinic", "2026-11-06"),
      filled,
      name,
    );
});

test("fillForDisplay: today is the UTC day, as the platform's signed copy writes it", () => {
  assert.equal(
    fillForDisplay(
      "{Effective date}",
      "Acme Clinic",
      new Date("2026-11-06T23:30:00-05:00").toISOString(),
    ),
    "2026-11-07",
  );
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

// ICD-10 Code Check v4, as the catalog publishes it (backend ADR-0048
// amendment 6): the app's rows, copied as they are.
const BATCH = [
  { id: "chunk", title: "Pages counted", description: "d", group: "upload" },
  {
    id: "categorize",
    title: "Pages sorted",
    description: "d",
    group: "upload",
  },
  { id: "organize", title: "Visits found", description: "d", group: "upload" },
  { id: "queue", title: "Visits queued", description: "d", group: "upload" },
];
const GROUPS = [
  { id: "upload", title: "Add visit notes" },
  { id: "read", title: "AI reading" },
  { id: "check", title: "Code check" },
  { id: "approve", title: "Your review" },
  { id: "email", title: "Run completed", platform: "email" },
];
const VISIT = [
  { id: "receive-visit", title: "Visit received", group: "upload" },
  { id: "read-visit", title: "Visit read", group: "read" },
  { id: "check-codes", title: "Codes checked", group: "check" },
  { id: "save-visit", title: "Saved", group: "approve" },
];
const ENTRY = { pipeline: VISIT, groups: GROUPS, batch: { pipeline: BATCH } };
const clock = (iso) => iso.slice(11, 16);
const ok = (stepId, minute) => ({
  stepId,
  outcome: "ok",
  summary: "s",
  occurredAt: `2026-11-06T10:0${minute}:00Z`,
});
const view = (rows) => rows.map(({ title, state, sub }) => [title, state, sub]);

test("batchRows: running after chunk — 1 done, 2 working, 3–4 waiting", () => {
  assert.deepEqual(
    view(
      batchRows([ok("chunk", 1)], BATCH, GROUPS, { status: "running" }, clock),
    ),
    [
      ["1 · Pages counted", "done", "Done · 10:01"],
      ["2 · Pages sorted", "working", "Working…"],
      ["3 · Visits found", "waiting", "Waiting"],
      ["4 · Visits queued", "waiting", "Waiting"],
    ],
  );
});

test('batchRows: succeeded, the email sent — four done, then "5 · Run completed"', () => {
  const steps = [
    ok("chunk", 1),
    ok("categorize", 2),
    ok("organize", 3),
    ok("queue", 4),
  ];
  const email = { status: "sent", sentAt: "2026-11-06T10:05:00Z" };
  assert.deepEqual(
    view(
      batchRows(steps, BATCH, GROUPS, { status: "succeeded" }, clock, {
        email,
      }),
    ),
    [
      ["1 · Pages counted", "done", "Done · 10:01"],
      ["2 · Pages sorted", "done", "Done · 10:02"],
      ["3 · Visits found", "done", "Done · 10:03"],
      ["4 · Visits queued", "done", "Done · 10:04"],
      ["5 · Run completed", "done", "Email sent · 10:05"],
    ],
  );
});

test("batchRows: succeeded, no email from the platform — the four rows only", () => {
  const steps = [
    ok("chunk", 1),
    ok("categorize", 2),
    ok("organize", 3),
    ok("queue", 4),
  ];
  assert.deepEqual(
    batchRows(steps, BATCH, GROUPS, { status: "succeeded" }, clock).map(
      (row) => row.title,
    ),
    [
      "1 · Pages counted",
      "2 · Pages sorted",
      "3 · Visits found",
      "4 · Visits queued",
    ],
  );
});

test("batchRows: failed at organize — its reason there, the rest stopped", () => {
  const steps = [
    ok("chunk", 1),
    ok("categorize", 2),
    { ...ok("organize", 3), outcome: "failed" },
  ];
  assert.deepEqual(
    view(
      batchRows(
        steps,
        BATCH,
        GROUPS,
        { status: "failed", failureReason: "No visits found." },
        clock,
      ),
    ),
    [
      ["1 · Pages counted", "done", "Done · 10:01"],
      ["2 · Pages sorted", "done", "Done · 10:02"],
      ["3 · Visits found", "failed", "No visits found."],
      ["4 · Visits queued", "stopped", "Stopped"],
    ],
  );
});

test("batchRows: a step the batch does not declare — the steps reported, titled from it, and no email row", () => {
  const steps = [ok("chunk", 1), ok("split-pages", 2)];
  const email = { status: "sent", sentAt: "2026-11-06T10:05:00Z" };
  assert.deepEqual(
    view(
      batchRows(steps, BATCH, GROUPS, { status: "succeeded" }, clock, {
        email,
      }),
    ),
    [
      ["1 · Pages counted", "done", "Done · 10:01"],
      ["2 · Step 2", "done", "Done · 10:02"],
    ],
  );
});

test("batchStepsFor: which runs are drawn by their batch steps", () => {
  for (const [name, run, entry, steps] of [
    ["a batch parent of a flow with batch", { batch: true }, ENTRY, BATCH],
    [
      "a batch child (a visit), or any run without `batch`",
      {},
      ENTRY,
      undefined,
    ],
    [
      "a batch parent of a flow without batch",
      { batch: true },
      { ...ENTRY, batch: undefined },
      undefined,
    ],
  ])
    assert.equal(batchStepsFor(run, entry), steps, name);
});

test("batchStepsFor: a child and a flow without batch keep today's group rows", () => {
  const rows = trackerRows(
    [ok("receive-visit", 1)],
    VISIT,
    GROUPS,
    { status: "running" },
    clock,
  );
  assert.deepEqual(
    rows.map((row) => row.title),
    [
      "1 · Add visit notes",
      "2 · AI reading",
      "3 · Code check",
      "4 · Your review",
      "5 · Run completed",
    ],
  );
});
