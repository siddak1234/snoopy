import assert from "node:assert/strict";
import { test } from "node:test";
import { BLOCK_FIXTURES } from "../lib/generated/platform-contracts/block-fixtures.ts";
import { itemBody, runBlocks } from "../e2e/fixtures/page-bodies.ts";

/**
 * The fixture Edge's page bodies are the platform's (backend ADR-0048): the
 * copy in `e2e/fixtures/page-bodies.ts`, built from the same made-up data the
 * platform's parity fixtures are (snoopy-backend scripts/block-fixture-data.ts
 * and block-fixtures.ts, over the committed manifests' words), gives exactly
 * the published blocks. So when the platform's composer or its words change
 * and the copy does not, this fails, and the browser specs that read the
 * copy never pass on words the platform no longer sends.
 */

const AT = "2026-10-14T21:32:00.000Z";
const JOB = "0a0a0a0a-0a0a-4a0a-8a0a-0a0a0a0a0a0a";
const ITEM = "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b";
const FILE = "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c";
const APPROVAL = "0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d";

const file = (filename) => ({
  id: FILE,
  filename,
  contentType: "application/pdf",
  format: "PDF",
  sizeBytes: 48_213,
  pages: 3,
});

const run = (patch = {}) => ({
  id: JOB,
  workspaceId: "workspace",
  subscriptionId: "flow",
  templateId: "flow",
  templateVersion: 1,
  status: "succeeded",
  origin: "manual",
  rootRunId: JOB,
  requestId: "request",
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

const bill = (index, patch = {}) => ({
  index,
  status: "recorded",
  statusText: "Recorded in QuickBooks: bill",
  type: "bill",
  vendor: {
    name: "Harbor Paper Co.",
    address: "18 Dock St",
    city: "Salem, OR",
    storeNumber: null,
  },
  number: `HP-10${index}`,
  numberLabel: "Invoice #",
  references: [{ label: "PO number", value: `PO-77${index}` }],
  date: "2026-10-14",
  time: "14:32",
  currency: "USD",
  lineItems: [
    {
      description: "Copy paper, case",
      quantity: "2",
      unitPrice: "41.50",
      amount: "83.00",
    },
    {
      description: "Delivery",
      quantity: null,
      unitPrice: null,
      amount: "12.00",
    },
  ],
  lineItemsComplete: true,
  subtotal: "95.00",
  tax: "7.60",
  tip: null,
  discount: null,
  total: "102.60",
  payment: { method: "card", cardLast4: "4417" },
  recordedIn: {
    providerId: "quickbooks",
    recordType: "bill",
    recordId: `9${index}`,
  },
  details: [{ label: "Category", value: "Office supplies" }],
  ...patch,
});

const waiting = (index) =>
  bill(index, {
    status: "waiting",
    statusText: "Waiting for approval",
    recordedIn: null,
  });

const item = (patch = {}) => ({
  id: ITEM,
  subscriptionId: "flow",
  title: "Payroll Analyst",
  fields: { department: "Finance", role: "Payroll Analyst" },
  status: "ready",
  sections: [
    {
      title: "Must haves",
      entries: [{ title: "Three years of payroll", text: "Multi-state." }],
    },
    { title: "Nice to haves", entries: [{ title: "Spreadsheet macros" }] },
  ],
  runCount: 3,
  positiveCount: 1,
  negativeCount: 1,
  topScore: 88,
  file: file("payroll-analyst.pdf"),
  createdAt: AT,
  createdByUserId: null,
  archivedAt: null,
  ...patch,
});

const candidates = [
  run({
    id: "r1",
    itemId: ITEM,
    title: "Dana Whitfield",
    score: 88,
    verdict: "positive",
  }),
  run({
    id: "r2",
    itemId: ITEM,
    title: "Omar Reyes",
    score: 41,
    verdict: "negative",
  }),
  run({ id: "r3", itemId: ITEM, status: "running" }),
  run({
    id: "r4",
    itemId: ITEM,
    status: "failed",
    failureReason: "The file had no text.",
  }),
];

/** The committed manifests' words (invoice-processing v7, candidate-reviewer v1 and v2). */
const INVOICE = {
  documentWord: "Invoice",
  fileFields: [{ title: "Document" }],
};
const REVIEWER_RUN = {
  runWord: "Candidate",
  fileFields: [{ title: "Resume" }],
};
const REVIEWER = {
  runWords: { singular: "Candidate", plural: "Candidates" },
  verdictWords: { positive: "Advance", negative: "Decline" },
  file: { title: "Job description" },
};
const REVIEWER_V1 = { runWords: REVIEWER.runWords, file: REVIEWER.file };
const pending = {
  id: APPROVAL,
  status: "pending",
  eligibleRoles: ["owner", "admin"],
};

const item_ = (declared, read, runs) =>
  itemBody({ item: read, runs, declared, runFile: true });

const CASES = {
  "v7-recorded": () =>
    runBlocks({
      ...INVOICE,
      run: run({ resultSummary: "Recorded 3 invoices in QuickBooks." }),
      documents: [bill(1), bill(2), bill(3, { lineItemsComplete: false })],
      files: [file("october-bills.pdf")],
    }),
  "v7-held-waiting": () =>
    runBlocks({
      ...INVOICE,
      run: run({ status: "held" }),
      documents: [bill(1), waiting(2)],
      approval: pending,
    }),
  "v7-held-denied": () =>
    runBlocks({
      ...INVOICE,
      run: run({ status: "held" }),
      documents: [bill(1), waiting(2)],
      approval: { ...pending, status: "rejected" },
    }),
  "v7-failed": () =>
    runBlocks({
      ...INVOICE,
      run: run({
        status: "failed",
        failureReason: "The file could not be read.",
      }),
    }),
  "v2-details": () =>
    runBlocks({
      fileFields: [{ title: "Document" }],
      run: run({ resultSummary: "Saved the bill." }),
      details: [
        { label: "Seller", value: "Harbor Paper Co." },
        { label: "Total", value: "$102.60" },
      ],
    }),
  "reviewer-candidate": () =>
    runBlocks({
      ...REVIEWER_RUN,
      run: run({
        itemId: ITEM,
        title: "Dana Whitfield",
        score: 88,
        verdict: "positive",
        resultSummary: "Strong fit.",
      }),
      files: [file("dana-whitfield.pdf")],
      sections: [
        {
          title: "Experience",
          entries: [
            {
              title: "Payroll Lead",
              subtitle: "Fernwood Foods · 2019–2025",
              text: "Ran payroll for 400 people.",
            },
          ],
        },
        {
          title: "Education",
          entries: [
            {
              title: "B.S. Accounting",
              url: "https://school.example.test/accounting",
            },
          ],
        },
      ],
    }),
  "reviewer-item": () => item_(REVIEWER, item(), candidates).blocks,
  "reviewer-item-reading": () => item_(REVIEWER, item(), candidates).reading,
  "reviewer-v1-item": () => item_(REVIEWER_V1, item(), candidates).blocks,
  "empty-item": () =>
    item_(
      REVIEWER,
      item({ runCount: 0, positiveCount: 0, negativeCount: 0, topScore: null }),
      [],
    ).blocks,
};

for (const [name, build] of Object.entries(CASES))
  test(`the fixture Edge's ${name} body is the platform's, block for block`, () => {
    const published = BLOCK_FIXTURES.find((fixture) => fixture.name === name);
    assert.ok(published, `the platform publishes ${name}`);
    assert.deepEqual(build(), published.blocks);
  });

test("an item's runs say whether one is still going", () => {
  assert.equal(item_(REVIEWER, item(), candidates).going, true);
  assert.equal(item_(REVIEWER, item(), candidates.slice(0, 2)).going, false);
  assert.equal(item_(REVIEWER, item({ status: "reading" }), []).going, true);
});
