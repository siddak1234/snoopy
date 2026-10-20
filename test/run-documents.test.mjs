import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  DOWNLOAD_EXCEL,
  DOWNLOAD_FAILED,
  DOWNLOAD_PDF,
  PACKAGE_UNAVAILABLE,
  RUN_PACKAGE_MAXIMUM_BYTES,
  VIEW_PACKAGE,
  documentDate,
  documentMoney,
  documentTime,
  formatFor,
  formatLabel,
  packageAvailable,
  packageFileHref,
  packageRetryWaitMs,
  toDocumentCard,
  toDocumentCards,
} from "../lib/run-documents.ts";

/**
 * A run's documents, each on its own card (Build 21, spec A7; backend
 * ADR-0039; the owner's ~04:05Z: "it was 3 receipts in one picture … we should
 * get a json out that clearly seperates accordingly … cu price, location, and
 * more should be there", and AM7: "ensure invoice number, bill number, or
 * another standard practice from vendors is part of the json schema output").
 * The same tables as the app's (`snoopy-mobile/__tests__/build21-views.test.ts`),
 * so a document reads the same in both clients.
 */

const read = (path) =>
  readFileSync(resolve(import.meta.dirname, "..", path), "utf8");

/** A receipt as v3 writes it (spec §1.1, AM7). */
function doc(overrides = {}) {
  return {
    index: 1,
    status: "recorded",
    statusText: "Recorded in QuickBooks: expense",
    type: "receipt",
    vendor: {
      name: "Lowe's",
      address: "2150 W Shaw Ave",
      city: "Fresno, CA 93711",
      storeNumber: "1234",
    },
    number: "48291",
    numberLabel: null,
    references: [],
    date: "2026-10-14",
    time: "14:32",
    currency: "USD",
    lineItems: [
      {
        description: "2X4-8 STUD",
        quantity: "4",
        unitPrice: "3.98",
        amount: "15.92",
      },
    ],
    lineItemsComplete: true,
    subtotal: "15.92",
    tax: "1.27",
    tip: null,
    discount: null,
    total: "17.19",
    payment: { method: "card", cardLast4: "4417" },
    recordedIn: {
      providerId: "quickbooks",
      recordType: "expense",
      recordId: "1452",
    },
    details: [{ label: "Category", value: "Materials" }],
    ...overrides,
  };
}

test("money is the decimal string as printed, never rounded or a float", () => {
  assert.deepEqual(
    [
      ["17.19", "USD"],
      ["3.5", null],
      ["3.459", "USD"],
      ["-4.00", "USD"],
      ["1234567.5", "USD"],
      ["1234.5", "CAD"],
      ["0", "EUR"],
      ["17.19.1", "USD"],
      [null, "USD"],
    ].map(([value, currency]) => documentMoney(value, currency)),
    [
      "$17.19",
      "$3.50",
      "$3.459",
      "−$4.00",
      "$1,234,567.50",
      "1,234.5 CAD",
      "0 EUR",
      null,
      null,
    ],
  );
});

test("the date and time as printed, with no zone: never a day off", () => {
  assert.deepEqual(
    [
      documentDate("2026-10-14"),
      documentDate("2026-13-01"),
      documentDate(null),
    ],
    ["Oct 14, 2026", null, null],
  );
  assert.deepEqual(
    [
      documentTime("14:32"),
      documentTime("00:05"),
      documentTime("12:00"),
      documentTime("25:00"),
    ],
    ["2:32 PM", "12:05 AM", "12:00 PM", null],
  );
});

test('its numbers: its own under the label printed beside it, else "No.", then every other identifier by its label', () => {
  assert.deepEqual(toDocumentCard(doc(), 1).ids, [
    { label: "No.", value: "48291" },
  ]);
  assert.deepEqual(
    toDocumentCard(
      doc({
        numberLabel: "Invoice #",
        references: [
          { label: "PO number", value: "PO-55" },
          { label: "Register", value: "07" },
        ],
      }),
      1,
    ).ids,
    [
      { label: "Invoice #", value: "48291" },
      { label: "PO number", value: "PO-55" },
      { label: "Register", value: "07" },
    ],
  );
  assert.deepEqual(
    toDocumentCard(doc({ number: null, numberLabel: null }), 1).ids,
    [],
  );
});

test('every line: its description, its amount, and "{quantity} × {unit price}" only when both were printed', () => {
  const card = toDocumentCard(
    doc({
      lineItems: [
        {
          description: "2X4-8 STUD",
          quantity: "4",
          unitPrice: "3.98",
          amount: "15.92",
        },
        {
          description: "Bag",
          quantity: null,
          unitPrice: "0.10",
          amount: "0.10",
        },
        { description: null, quantity: "1", unitPrice: null, amount: null },
      ],
      lineItemsComplete: false,
    }),
    2,
  );
  assert.deepEqual(card.lines, [
    { description: "2X4-8 STUD", amount: "$15.92", each: "4 × $3.98" },
    { description: "Bag", amount: "$0.10", each: null },
    { description: "—", amount: null, each: null },
  ]);
  assert.equal(card.moreLines, true);
  assert.equal(card.heading, "Invoice 1 of 2");
});

test("the rows: totals, the discount as taken off, how it was paid, the result, then the automation's own lines", () => {
  const card = toDocumentCard(
    doc({
      tip: "2.00",
      discount: "0.50",
      payment: { method: "card", cardLast4: "4417" },
    }),
    1,
  );
  assert.deepEqual(card.rows, [
    { label: "Subtotal", value: "$15.92" },
    { label: "Tax", value: "$1.27" },
    { label: "Tip", value: "$2.00" },
    { label: "Discount", value: "−$0.50" },
    { label: "Total", value: "$17.19", strong: true },
    { label: "Paid", value: "Card ending 4417" },
    { label: "Result", value: "Recorded in QuickBooks: expense" },
    { label: "Category", value: "Materials" },
  ]);
  assert.equal(
    toDocumentCard(
      doc({ payment: { method: "not_shown", cardLast4: null } }),
      1,
    ).rows.some((row) => row.label === "Paid"),
    false,
  );
  assert.ok(
    toDocumentCard(
      doc({ payment: { method: "bank_transfer", cardLast4: null } }),
      1,
    ).rows.some((row) => row.label === "Paid" && row.value === "Bank transfer"),
  );
});

for (const [status, approval, chip, tone] of [
  ["recorded", null, "Recorded", "ok"],
  ["saved", null, "Saved", "ok"],
  ["compared", null, "Compared", "ok"],
  ["not_recorded", null, "Not recorded", "warn"],
  ["unconfirmed", null, "Not confirmed", "warn"],
  ["waiting", null, "Waiting", "warn"],
  ["waiting", "rejected", "Not approved", "muted"],
  ["waiting", "expired", "Not approved", "muted"],
]) {
  test(`a ${status} document (approval ${approval}) reads ${chip}`, () => {
    const card = toDocumentCard(doc({ status }), 1, approval);
    assert.equal(card.chip, chip);
    assert.equal(card.tone, tone);
  });
}

test("every type in words, the seller beside it, its place by the parts printed", () => {
  const types = [
    "bill",
    "invoice",
    "receipt",
    "credit_note",
    "statement",
    "bank_statement",
    "quote",
    "purchase_order",
    "other",
  ];
  assert.deepEqual(
    types.map(
      (type) =>
        toDocumentCard(
          doc({
            type,
            vendor: {
              name: null,
              address: null,
              city: null,
              storeNumber: null,
            },
          }),
          1,
        ).title,
    ),
    [
      "Bill",
      "Invoice",
      "Receipt",
      "Credit note",
      "Statement",
      "Bank statement",
      "Quote",
      "Purchase order",
      "Document",
    ],
  );
  assert.equal(
    toDocumentCard(doc(), 1).location,
    "2150 W Shaw Ave, Fresno, CA 93711 · Store 1234",
  );
  assert.equal(
    toDocumentCard(
      doc({
        vendor: {
          name: "X",
          address: null,
          city: "Oakland, CA",
          storeNumber: null,
        },
      }),
      1,
    ).location,
    "Oakland, CA",
  );
  assert.equal(toDocumentCard(doc(), 1).when, "Oct 14, 2026 · 2:32 PM");
});

test('cards come in the file\'s order, each "Invoice i of n" whatever its type — ~~"Document i of n"~~ until Build 24 (P10)', () => {
  const cards = toDocumentCards([
    doc({ index: 3 }),
    doc({ index: 1, type: "bill" }),
    doc({ index: 2 }),
  ]);
  assert.deepEqual(
    cards.map((card) => card.heading),
    ["Invoice 1 of 3", "Invoice 2 of 3", "Invoice 3 of 3"],
  );
  assert.equal(cards[1].heading, "Invoice 2 of 3");
  assert.deepEqual(toDocumentCards(undefined), []);
});

test("a file's format in a word: PDF, JPEG, PNG, HEIC, else the subtype in capitals — parameters and case aside (P10)", () => {
  assert.deepEqual(
    [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/heic",
      "IMAGE/JPEG",
      "application/pdf; charset=binary",
      "image/webp",
      "image/tiff",
      "text/csv",
      "octet",
    ].map(formatLabel),
    [
      "PDF",
      "JPEG",
      "PNG",
      "HEIC",
      "JPEG",
      "PDF",
      "WEBP",
      "TIFF",
      "CSV",
      "OCTET",
    ],
  );
});

test("a document's Format: its own file's (source.file), else the job's only file's, else none (P10)", () => {
  const pdf = { id: "f-pdf", contentType: "application/pdf" };
  const png = { id: "f-png", contentType: "image/png" };
  // Its own file, among two.
  assert.equal(formatFor({ source: { file: "f-png" } }, [pdf, png]), "PNG");
  assert.equal(
    formatFor({ source: { file: "f-pdf", pages: [1, 2] } }, [pdf, png]),
    "PDF",
  );
  // No source (v5): the job's only file.
  assert.equal(formatFor({}, [png]), "PNG");
  // A source the job's files do not hold, and one file: that one.
  assert.equal(formatFor({ source: { file: "gone" } }, [pdf]), "PDF");
  // None to tell by: two files and no source, or no files at all.
  assert.equal(formatFor({}, [pdf, png]), null);
  assert.equal(formatFor({ source: { file: "gone" } }, [pdf, png]), null);
  assert.equal(formatFor({}, undefined), null);
  assert.equal(formatFor({}, []), null);
});

test("closed, a card says its heading, its chip and {vendor} · {total} (S9); open, it starts with Document type and Format — the row left out when the format is not known (P10)", () => {
  const files = [{ id: "f-1", contentType: "image/jpeg" }];
  const card = toDocumentCard(doc(), 3, null, files);
  assert.equal(card.glance, "Lowe's · $17.19");
  assert.deepEqual(card.facts, [
    { label: "Document type", value: "Receipt" },
    { label: "Format", value: "JPEG" },
  ]);
  assert.deepEqual(toDocumentCard(doc({ type: "bill" }), 1).facts, [
    { label: "Document type", value: "Bill" },
  ]);
  assert.equal(
    toDocumentCard(
      doc({
        vendor: { name: null, address: null, city: null, storeNumber: null },
      }),
      1,
    ).glance,
    "$17.19",
  );
  assert.equal(
    toDocumentCard(doc({ total: null, vendor: { ...doc().vendor } }), 1).glance,
    "Lowe's",
  );
  assert.equal(
    toDocumentCard(
      doc({
        total: null,
        vendor: { name: null, address: null, city: null, storeNumber: null },
      }),
      1,
    ).glance,
    null,
  );
  // Every card is given the job's files.
  assert.deepEqual(
    toDocumentCards([doc({ index: 1 }), doc({ index: 2 })], null, files).map(
      (each) => each.facts.at(-1),
    ),
    [
      { label: "Format", value: "JPEG" },
      { label: "Format", value: "JPEG" },
    ],
  );
});

test("the run package's words, the app's (Build 24, P12; ~~Download JSON~~ until then); offered once the job has documents and has ended or is held", () => {
  assert.equal(VIEW_PACKAGE, "View package");
  assert.equal(DOWNLOAD_PDF, "Download PDF");
  assert.equal(DOWNLOAD_EXCEL, "Download Excel");
  assert.equal(DOWNLOAD_FAILED, "Could not download. Try again.");
  assert.equal(PACKAGE_UNAVAILABLE, "This run has no package yet.");
  const documents = [doc()];
  assert.equal(packageAvailable("succeeded", documents), true);
  assert.equal(packageAvailable("held", documents), true);
  assert.equal(packageAvailable("failed", documents), true);
  assert.equal(packageAvailable("running", documents), false);
  assert.equal(packageAvailable("pending", documents), false);
  assert.equal(packageAvailable("succeeded", []), false);
  assert.equal(packageAvailable("succeeded", undefined), false);
});

test("the platform busy building others: asked once more after its retry-after (2 s when none, not past 10 s); the frame's route by the job's id and the browser's zone; the platform's 32 MB bound, as MiB (P12)", () => {
  assert.deepEqual([undefined, 0, 1, 5, 10, 11, 300].map(packageRetryWaitMs), [
    2_000,
    0,
    1_000,
    5_000,
    10_000,
    null,
    null,
  ]);
  assert.equal(
    packageFileHref("fixture-run-invoice", "America/Chicago"),
    "/account/runs/fixture-run-invoice/package/file?timeZone=America%2FChicago",
  );
  assert.equal(
    packageFileHref("a b", null),
    "/account/runs/a%20b/package/file",
  );
  assert.equal(RUN_PACKAGE_MAXIMUM_BYTES, 33_554_432);
});

test("Download PDF and Download Excel: the platform's link, asked through /api/platform in the browser's zone with a key, then followed — a busy platform asked once more, a refusal said; never a hand-written fetch, and Download JSON gone (P12)", () => {
  const live = read("app/account/runs/[runId]/RunLive.tsx");
  assert.match(
    live,
    /platformApiJson<RunPackageFile>\(\s*`\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}\/runs\/\$\{encodeURIComponent\(runId\)\}\/package`,\s*\{\s*method: "POST",\s*headers: \{\s*"content-type": "application\/json",\s*"idempotency-key": `run-package-\$\{format\}-\$\{crypto\.randomUUID\(\)\}`,/u,
  );
  assert.match(live, /\.\.\.\(zone \? \{ timeZone: zone \} : \{\}\)/u);
  assert.match(live, /window\.location\.assign\(file\.downloadUrl\);/u);
  assert.match(
    live,
    /error instanceof PlatformApiError && error\.status === 503\s*\? packageRetryWaitMs\(error\.retryAfterSeconds\)\s*: null;\s*if \(wait === null\) throw error;\s*await new Promise\(\(resolve\) => setTimeout\(resolve, wait\)\);\s*return ask\(\);/u,
  );
  assert.match(live, /setError\(DOWNLOAD_FAILED\);/u);
  // Offered once the job can be packaged, with View package on the run page.
  assert.match(
    live,
    /\{packageAvailable\(run\.status, documents\) \? \(\s*<PackageActions workspaceId=\{workspaceId\} runId=\{run\.id\} view \/>/u,
  );
  // Gone, but in the struck-through history of its comments.
  assert.doesNotMatch(
    live.replace(/~~[\s\S]*?~~/gu, ""),
    /Download JSON|DOWNLOAD_JSON|documentsFileName/u,
  );
  assert.doesNotMatch(live, /\bfetch\(/u);
  assert.doesNotMatch(read("lib/platform-api.ts"), /platformApiFile/u);
});
