/**
 * A run's documents, as the run page's Documents cards draw them (Build 21,
 * spec A7; backend ADR-0039 — `RunDocument`, the one shape at every hop). The
 * owner's ~04:05Z: "it was 3 receipts in one picture. that should work … we
 * should get a json out that clearly seperates accordingly … its possible
 * different receipts from different vendors is there. cu price, location, and
 * more should be there", and his AM7 (~22:35Z): "ensure invoice number, bill
 * number, or another standard practice from vendors is part of the json schema
 * output. thats how we know which bill is what from records."
 *
 * Every value is the automation's, as printed; nothing is computed or rounded.
 * The same rules and words as the app's `snoopy-mobile/lib/view/documents.ts`,
 * so a document reads the same in both clients: money drawn
 * by hand from the decimal string — "$17.19" in US dollars or when the
 * document names no currency, at least two decimals and every digit printed
 * ("$3.459"), else the amount and its code ("17.19 CAD"), as the results email
 * writes a total (spec C3).
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** `RunDocument` as the contract publishes it (`lib/generated/platform-contracts/automations.d.ts`). */
export type RunDocument = {
  index: number;
  status:
    | "recorded"
    | "saved"
    | "not_recorded"
    | "unconfirmed"
    | "compared"
    | "waiting";
  statusText: string;
  type:
    | "bill"
    | "invoice"
    | "receipt"
    | "credit_note"
    | "statement"
    | "bank_statement"
    | "quote"
    | "purchase_order"
    | "other";
  vendor: {
    name: string | null;
    address: string | null;
    city: string | null;
    storeNumber: string | null;
  };
  number: string | null;
  numberLabel: string | null;
  references: readonly { label: string; value: string }[];
  date: string | null;
  time: string | null;
  currency: string | null;
  lineItems: readonly {
    description: string | null;
    quantity: string | null;
    unitPrice: string | null;
    amount: string | null;
  }[];
  lineItemsComplete: boolean;
  subtotal: string | null;
  tax: string | null;
  tip: string | null;
  discount: string | null;
  total: string | null;
  payment: {
    method: "card" | "cash" | "check" | "bank_transfer" | "other" | "not_shown";
    cardLast4: string | null;
  };
  recordedIn: {
    providerId: string;
    recordType: string;
    recordId: string;
  } | null;
  details: readonly { label: string; value: string }[];
  /** The uploaded file it came from (Invoice Processing v6; optional). */
  source?: { file: string; pages?: readonly number[] };
};

/** `RunFile` as the contract publishes it: one file uploaded for the job — what a document's Format is read from. */
export type RunFile = { id: string; contentType: string };

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** What each document type is called on its card (spec A7; the email's words, C3). */
const TYPE_WORDS: Record<RunDocument["type"], string> = {
  bill: "Bill",
  invoice: "Invoice",
  receipt: "Receipt",
  credit_note: "Credit note",
  statement: "Statement",
  bank_statement: "Bank statement",
  quote: "Quote",
  purchase_order: "Purchase order",
  other: "Document",
};

/**
 * The chip on each card (spec A7); `Not approved` for a waiting one whose
 * approval was refused or ran out (S21). ~~Skipped~~ is gone with the owner's
 * AM6–AM8: every financial document goes through, and only a page that is
 * clearly not one waits.
 */
const STATUS_CHIPS: Record<RunDocument["status"], string> = {
  recorded: "Recorded",
  saved: "Saved",
  not_recorded: "Not recorded",
  unconfirmed: "Not confirmed",
  compared: "Compared",
  waiting: "Waiting",
};

const PAYMENT_WORDS: Record<
  Exclude<RunDocument["payment"]["method"], "not_shown">,
  string
> = {
  card: "Card",
  cash: "Cash",
  check: "Check",
  bank_transfer: "Bank transfer",
  other: "Other",
};

/** The tone of a card's chip: done, waiting on someone, or not done. */
export type DocumentTone = "ok" | "warn" | "muted";

const STATUS_TONES: Record<RunDocument["status"], DocumentTone> = {
  recorded: "ok",
  saved: "ok",
  compared: "ok",
  not_recorded: "warn",
  unconfirmed: "warn",
  waiting: "warn",
};

/** Said under a document's lines when it has more than were read. */
export const DOCUMENT_MORE_LINES = "More lines on the document.";

/**
 * "Invoice 1 of 3" — the closed row's heading (Build 24, P10; the owner's
 * build 23 words), whatever the document's type; the type is the body's first
 * row. ~~"Document 1 of 3"~~ until Build 24.
 */
export function documentOf(index: number, count: number): string {
  return `Invoice ${index} of ${count}`;
}

/** The formats said by name; any other is its content type's subtype in capitals. */
const FORMAT_WORDS: Readonly<Record<string, string>> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
};

/**
 * A file's format in a word (Build 24, P10): PDF, JPEG, PNG, HEIC, else the
 * content type's subtype in capitals ("image/webp" → "WEBP"); parameters and
 * case are not part of it.
 */
export function formatLabel(contentType: string): string {
  const type = contentType.split(";")[0]!.trim().toLowerCase();
  return FORMAT_WORDS[type] ?? (type.split("/")[1] ?? type).toUpperCase();
}

/**
 * A document's Format: its own file's (`source.file`), else the job's only
 * file's, else none — the row is then left out (Build 24, P10).
 */
export function formatFor(
  document: Pick<RunDocument, "source">,
  files: readonly RunFile[] | undefined,
): string | null {
  const list = files ?? [];
  const own = document.source
    ? list.find((file) => file.id === document.source!.file)
    : undefined;
  const file = own ?? (list.length === 1 ? list[0] : undefined);
  return file ? formatLabel(file.contentType) : null;
}

function grouped(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
}

/**
 * A decimal string as money, by hand and exact: "17.19" → "$17.19", "3.5" →
 * "$3.50", "3.459" → "$3.459", "-4.00" → "−$4.00", "1234.5" in CAD →
 * "1,234.5 CAD". Null, or a value not a decimal string, is null — never "NaN".
 */
export function documentMoney(
  value: string | null,
  currency: string | null,
): string | null {
  if (value === null) return null;
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u.exec(value);
  if (!match) return null;
  const [, sign, whole, fraction = ""] = match;
  const negative = sign === "-" ? "−" : "";
  if (currency === null || currency === "USD") {
    const cents = fraction.padEnd(2, "0");
    return `${negative}$${grouped(whole!)}.${cents}`;
  }
  return `${negative}${grouped(whole!)}${fraction ? `.${fraction}` : ""} ${currency}`;
}

/** A printed date, YYYY-MM-DD, as these pages say a day: "Oct 14, 2026" — no zone, so never a day off. */
export function documentDate(value: string | null): string | null {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value) : null;
  if (!match) return null;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}, ${match[1]}` : null;
}

/** A printed time, 24-hour HH:MM, as these pages say one: "2:32 PM". */
export function documentTime(value: string | null): string | null {
  const match = value ? /^([01][0-9]|2[0-3]):([0-5][0-9])$/u.exec(value) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}

export type DocumentLineView = {
  description: string;
  amount: string | null;
  each: string | null;
};
export type DocumentRowView = { label: string; value: string; strong?: true };

/** One document's card: a closed row that opens in place (Build 24, P10). */
export type DocumentCardView = {
  index: number;
  heading: string;
  chip: string;
  tone: DocumentTone;
  /**
   * The closed row's second line, `{vendor} · {total}` — the parts printed
   * (the session's S9: three rows each "Invoice n of 3" are otherwise found
   * only by opening each).
   */
  glance: string | null;
  /** The body's first rows: Document type, then Format when it is known. */
  facts: DocumentRowView[];
  /** `{Type} · {vendor}`, or the type alone when no seller was read. */
  title: string;
  /** `{address}, {city} · Store {number}` — the parts printed. */
  location: string | null;
  /** `{date} · {time}` — the parts printed. */
  when: string | null;
  /**
   * The numbers that match it to its record (AM7): its own number under its
   * printed label — "Invoice #", "Bill No.", else "No." — then every other
   * identifier printed, by its label.
   */
  ids: DocumentRowView[];
  lines: DocumentLineView[];
  /** Said when the document has more lines than were read. */
  moreLines: boolean;
  /** Subtotal, Tax, Tip, Discount, Total (medium), Paid, Result, then the automation's own details. */
  rows: DocumentRowView[];
};

/**
 * A document's card (spec A7; Build 24, P10): closed, "Invoice 1 of 3", its
 * chip and `{vendor} · {total}`; open, its Document type and Format, then the
 * type and seller; where; when; its numbers; each line — description, amount,
 * and "{quantity} × {unit price}" under it when both were printed; the totals;
 * how it was paid ("Card ending 4417", none when not shown); what happened to
 * it; then the automation's own detail lines.
 */
export function toDocumentCard(
  document: RunDocument,
  count: number,
  approval?: "rejected" | "expired" | null,
  files?: readonly RunFile[],
): DocumentCardView {
  const money = (value: string | null) =>
    documentMoney(value, document.currency);
  const notApproved =
    document.status === "waiting" &&
    (approval === "rejected" || approval === "expired");
  const type = TYPE_WORDS[document.type] ?? "Document";
  const place = [document.vendor.address, document.vendor.city]
    .filter(Boolean)
    .join(", ");
  const location = [
    place || null,
    document.vendor.storeNumber ? `Store ${document.vendor.storeNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const when = [documentDate(document.date), documentTime(document.time)]
    .filter(Boolean)
    .join(" · ");
  const ids: DocumentRowView[] = [
    ...(document.number
      ? [{ label: document.numberLabel ?? "No.", value: document.number }]
      : []),
    ...document.references.map((reference) => ({
      label: reference.label,
      value: reference.value,
    })),
  ];
  const rows: DocumentRowView[] = [];
  const amount = (label: string, value: string | null, strong?: true) => {
    const text = money(value);
    if (text !== null)
      rows.push({ label, value: text, ...(strong ? { strong } : {}) });
  };
  amount("Subtotal", document.subtotal);
  amount("Tax", document.tax);
  amount("Tip", document.tip);
  const discount = money(document.discount);
  if (discount !== null)
    rows.push({
      label: "Discount",
      value: discount.startsWith("−") ? discount : `−${discount}`,
    });
  amount("Total", document.total, true);
  if (document.payment.method !== "not_shown") {
    rows.push({
      label: "Paid",
      value:
        document.payment.method === "card" && document.payment.cardLast4
          ? `Card ending ${document.payment.cardLast4}`
          : PAYMENT_WORDS[document.payment.method],
    });
  }
  rows.push({ label: "Result", value: document.statusText });
  for (const detail of document.details)
    rows.push({ label: detail.label, value: detail.value });
  const format = formatFor(document, files);
  const glance = [document.vendor.name, money(document.total)]
    .filter(Boolean)
    .join(" · ");
  return {
    index: document.index,
    heading: documentOf(document.index, count),
    chip: notApproved ? "Not approved" : STATUS_CHIPS[document.status],
    tone: notApproved ? "muted" : STATUS_TONES[document.status],
    glance: glance || null,
    facts: [
      { label: "Document type", value: type },
      ...(format ? [{ label: "Format", value: format }] : []),
    ],
    title: document.vendor.name ? `${type} · ${document.vendor.name}` : type,
    location: location || null,
    when: when || null,
    ids,
    lines: document.lineItems.map((line) => {
      const unit = money(line.unitPrice);
      return {
        description: line.description ?? "—",
        amount: money(line.amount),
        each:
          line.quantity !== null && unit !== null
            ? `${line.quantity} × ${unit}`
            : null,
      };
    }),
    moreLines: !document.lineItemsComplete,
    rows,
  };
}

/** Every document's card, in the file's order; `files` are the job's uploads (`RunDetail.files`). */
export function toDocumentCards(
  documents: readonly RunDocument[] | undefined,
  approval?: "rejected" | "expired" | null,
  files?: readonly RunFile[],
): DocumentCardView[] {
  const list = [...(documents ?? [])].sort((a, b) => a.index - b.index);
  return list.map((document) =>
    toDocumentCard(document, list.length, approval, files),
  );
}

/**
 * The JSON file's name: `run-{the full run id}.json` (the owner's AM2:
 * "runs should have the full ID"; ~~the first eight~~ of the spec's S4) — the
 * name the platform's own `Content-Disposition` gives it.
 */
export function documentsFileName(runId: string): string {
  return `run-${runId}.json`;
}

/** Download JSON (spec A7; the session's S25). */
export const DOWNLOAD_JSON = "Download JSON";
export const DOWNLOAD_FAILED = "Could not download. Try again.";
