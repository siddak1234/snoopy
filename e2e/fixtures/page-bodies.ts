/**
 * The page bodies the fixture Edge answers a `shape=blocks` read with (backend
 * ADR-0048): the run's and the item's blocks, built from the fixture's own
 * made-up answers by the platform's rules (snoopy-backend apps/runs/src/pages:
 * run-page.ts, item-page.ts, result-blocks.ts, document-blocks.ts, words.ts).
 * Pure — no fixture state — so `test/fixture-page-bodies.test.mjs` can hold it
 * to the platform's own bodies (`block-fixtures.ts`): it builds each from the
 * same made-up data and must give exactly the published blocks, so a change to
 * the composer or its words that this copy misses fails there.
 */
import type { components as AutomationSchemas } from "../../lib/generated/platform-contracts/automations";

type Automations = AutomationSchemas["schemas"];
type Block = Automations["Block"];
type Run = Automations["Run"];
type RunFile = Automations["RunFile"];
type RunDocument = Automations["RunDocument"];

const WORDS = {
  documents: "Documents",
  details: "Details",
  file: "File",
  waiting: "Waiting for approval.",
  decided: {
    approved: "Approved",
    rejected: "Denied",
    closed: "No longer awaiting approval",
  },
  types: {
    bill: "Bill",
    invoice: "Invoice",
    receipt: "Receipt",
    credit_note: "Credit note",
    statement: "Statement",
    bank_statement: "Bank statement",
    quote: "Quote",
    purchase_order: "Purchase order",
    other: "Document",
  } as Record<string, string>,
  chips: {
    recorded: "Recorded",
    saved: "Saved",
    not_recorded: "Not recorded",
    unconfirmed: "Not confirmed",
    compared: "Compared",
    waiting: "Waiting",
  } as Record<string, string>,
  notApproved: "Not approved",
  paid: {
    card: "Card",
    cash: "Cash",
    check: "Check",
    bank_transfer: "Bank transfer",
    other: "Other",
  } as Record<string, string>,
  moreLines: "More lines on the document.",
  unnamed: {
    held: "Held",
    succeeded: "Success",
    failed: "Failed",
    cancelled: "Cancelled",
  } as Record<string, string>,
  total: "Total",
  reading: "Reading…",
  score: "Score",
};
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
const CHIP_TONES: Record<string, Automations["BlockTone"]> = {
  recorded: "success",
  saved: "success",
  compared: "success",
  not_recorded: "warning",
  unconfirmed: "warning",
  waiting: "warning",
};
const LINE_TONES: Record<string, Automations["BlockTone"]> = {
  succeeded: "success",
  failed: "error",
  held: "warning",
};

/** A word inside a sentence — "View resume" — its first letter small when the next is too. */
export const smallFirst = (word: string) =>
  /^\p{Lu}\p{Ll}/u.test(word)
    ? word.charAt(0).toLocaleLowerCase("en-US") + word.slice(1)
    : word;

const label = (text: string): Block => ({ type: "text", text, style: "label" });
const joined = (parts: readonly (string | null | undefined)[], by: string) =>
  parts.filter(Boolean).join(by);

function money(value: string | null, currency: string | null) {
  if (value === null) return null;
  const match = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/u.exec(value);
  if (!match) return null;
  const [, sign, whole = "", fraction = ""] = match;
  const negative = sign === "-" ? "−" : "";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  if (currency === null || currency === "USD")
    return `${negative}$${grouped}.${fraction.padEnd(2, "0")}`;
  return `${negative}${grouped}${fraction ? `.${fraction}` : ""} ${currency}`;
}

function day(value: string | null) {
  const match = value ? /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value) : null;
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${Number(match[3])}, ${match[1]}` : null;
}

function time(value: string | null) {
  const match = value ? /^([01][0-9]|2[0-3]):([0-5][0-9])$/u.exec(value) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours < 12 ? "AM" : "PM"}`;
}

type Row = { label: string; value: string; strong?: boolean };
const pairs = (rows: readonly Row[], divided = false): Block => ({
  type: "table",
  columns: [{ muted: true }, { align: "end" }],
  rows: rows.map((row) => ({
    cells: [row.label, row.value],
    ...(row.strong ? { strong: true } : {}),
  })),
  ...(divided ? { divided: true } : {}),
});

/** One document as its closed section: the platform's document adapter. */
function documentBlock(
  document: RunDocument,
  count: number,
  word: string,
  files: readonly RunFile[],
  notApproved: boolean,
): Block {
  const cash = (value: string | null) => money(value, document.currency);
  const type = WORDS.types[document.type] ?? WORDS.types.other ?? "Document";
  const own = document.source
    ? files.find((file) => file.id === document.source?.file)
    : undefined;
  const format = (own ?? (files.length === 1 ? files[0] : undefined))?.format;
  const location = joined(
    [
      joined([document.vendor.address, document.vendor.city], ", ") || null,
      document.vendor.storeNumber
        ? `Store ${document.vendor.storeNumber}`
        : null,
    ],
    " · ",
  );
  const when = joined([day(document.date), time(document.time)], " · ");
  const ids: Row[] = [
    ...(document.number
      ? [{ label: document.numberLabel ?? "No.", value: document.number }]
      : []),
    ...document.references.map((reference) => ({
      label: reference.label,
      value: reference.value,
    })),
  ];
  const totals: Row[] = [];
  const amount = (name: string, value: string | null, strong?: true) => {
    const text = cash(value);
    if (text !== null)
      totals.push({ label: name, value: text, ...(strong ? { strong } : {}) });
  };
  amount("Subtotal", document.subtotal);
  amount("Tax", document.tax);
  amount("Tip", document.tip);
  const discount = cash(document.discount);
  if (discount !== null)
    totals.push({
      label: "Discount",
      value: discount.startsWith("−") ? discount : `−${discount}`,
    });
  amount("Total", document.total, true);
  if (document.payment.method !== "not_shown")
    totals.push({
      label: "Paid",
      value:
        document.payment.method === "card" && document.payment.cardLast4
          ? `Card ending ${document.payment.cardLast4}`
          : (WORDS.paid[document.payment.method] ?? "Other"),
    });
  totals.push({ label: "Result", value: document.statusText });
  for (const detail of document.details)
    totals.push({ label: detail.label, value: detail.value });
  const glance = joined([document.vendor.name, cash(document.total)], " · ");
  const waitingRefused = document.status === "waiting" && notApproved;
  const inside: Block[] = [
    pairs([
      { label: "Document type", value: type },
      ...(format ? [{ label: "Format", value: format }] : []),
    ]),
    {
      type: "text",
      text: document.vendor.name ? `${type} · ${document.vendor.name}` : type,
      style: "strong",
    },
    ...(location
      ? [{ type: "text", text: location, style: "muted" } satisfies Block]
      : []),
    ...(when
      ? [{ type: "text", text: when, style: "muted" } satisfies Block]
      : []),
    ...(ids.length > 0 ? [pairs(ids)] : []),
    ...(document.lineItems.length > 0
      ? [
          {
            type: "table",
            columns: [{}, { align: "end" }],
            rows: document.lineItems.map((line) => {
              const unit = cash(line.unitPrice);
              return {
                cells: [line.description ?? "—", cash(line.amount) ?? ""],
                ...(line.quantity !== null && unit !== null
                  ? { note: `${line.quantity} × ${unit}` }
                  : {}),
              };
            }),
            divided: true,
          } satisfies Block,
        ]
      : []),
    ...(!document.lineItemsComplete
      ? [
          {
            type: "text",
            text: WORDS.moreLines,
            style: "muted",
          } satisfies Block,
        ]
      : []),
    pairs(totals, true),
  ];
  return {
    type: "section",
    title: `${word} ${document.index} of ${count}`,
    ...(glance ? { subtitle: glance } : {}),
    badge: waitingRefused
      ? { text: WORDS.notApproved, tone: "neutral" }
      : {
          text: WORDS.chips[document.status] ?? document.status,
          tone: CHIP_TONES[document.status] ?? "neutral",
        },
    blocks: inside,
  };
}

/** Sections as the platform's adapter makes them: a list each; any address but https its words. */
export function sectionBlocks(
  sections: readonly Automations["RunSection"][],
  firstOpen: boolean,
): Block[] {
  return sections.map((section, index) => ({
    type: "section",
    title: section.title,
    ...(firstOpen && index === 0 ? { open: true } : {}),
    blocks: [
      {
        type: "list",
        items: section.entries.map((entry) => {
          const https = (() => {
            try {
              return Boolean(
                entry.url && new URL(entry.url).protocol === "https:",
              );
            } catch {
              return false;
            }
          })();
          const shown = !https && entry.url ? entry.url : undefined;
          const text = joined([entry.text, shown], "\n");
          return {
            title: entry.title,
            ...(entry.subtitle ? { subtitle: entry.subtitle } : {}),
            ...(text ? { text } : {}),
            ...(https ? { url: entry.url } : {}),
          };
        }),
      },
    ],
  }));
}

/** What a run's page is built from: its answer, its newest approval, its flow's words. */
export type RunPageInput = {
  run: Run;
  files?: readonly RunFile[];
  details?: readonly Automations["RunDetailLine"][];
  documents?: readonly RunDocument[];
  sections?: readonly Automations["RunSection"][];
  /** The job's newest approval, if it asked for one. */
  approval?: Pick<Automations["Approval"], "id" | "status" | "eligibleRoles">;
  /** The flow's word for one of an item's runs ("Candidate"). */
  runWord?: string;
  /** The flow's word for one document ("Invoice"). */
  documentWord?: string;
  /** The flow's file fields for a run: each file's "View {title}". */
  fileFields?: readonly { title: string }[];
};

/** A run's blocks, in `pages.run`'s default order: files, outcome, result. */
export function runBlocks(input: RunPageInput): Block[] {
  const { run, approval } = input;
  const files = input.files ?? [];
  const blocks: Block[] = [];
  // files: one "View {file}" row per file of an item's run.
  if (run.itemId) {
    const fields = input.fileFields ?? [];
    const titles = files.map(
      (_, at) => (fields[at] ?? fields[0])?.title ?? WORDS.file,
    );
    files.forEach((file, at) => {
      const title = titles[at] ?? WORDS.file;
      const same = titles.filter((other) => other === title).length;
      const nth = titles
        .slice(0, at + 1)
        .filter((other) => other === title).length;
      const view = `View ${smallFirst(title)}`;
      blocks.push({
        type: "file",
        title: same > 1 ? `${view} ${nth} of ${same}` : view,
        open: { target: "run-file", runId: run.id, fileId: file.id },
        file,
      });
    });
  }
  // outcome: the result line, toned by status, and the approval to decide.
  const line =
    run.status === "succeeded"
      ? (run.resultSummary ?? null)
      : run.status === "failed"
        ? (run.failureReason ?? null)
        : run.status !== "held"
          ? null
          : !approval || approval.status === "pending"
            ? WORDS.waiting
            : approval.status === "approved"
              ? WORDS.decided.approved
              : approval.status === "rejected"
                ? WORDS.decided.rejected
                : WORDS.decided.closed;
  const sections = input.sections ?? [];
  const said = run.status === "succeeded" && sections.length > 0;
  const tone = LINE_TONES[run.status];
  if (line && !said)
    blocks.push({ type: "text", text: line, ...(tone ? { tone } : {}) });
  if (approval?.status === "pending")
    blocks.push({
      type: "questions",
      form: {
        kind: "approval",
        approvalId: approval.id,
        eligibleRoles: approval.eligibleRoles,
      },
    });
  // result: the run's sections, documents or details (the adapter).
  if (sections.length > 0)
    blocks.push(
      label(input.runWord ? `${input.runWord} details` : WORDS.details),
      ...sectionBlocks(sections, true),
    );
  const documents = [...(input.documents ?? [])].sort(
    (a, b) => a.index - b.index,
  );
  const decided =
    run.status === "held" &&
    approval !== undefined &&
    approval.status !== "pending";
  if (documents.length > 0) {
    blocks.push(label(WORDS.documents));
    for (const document of documents)
      blocks.push(
        documentBlock(
          document,
          documents.length,
          input.documentWord ?? "Document",
          files,
          decided && approval?.status !== "approved",
        ),
      );
  } else if (input.details && input.details.length > 0) {
    blocks.push(label(WORDS.details), {
      type: "table",
      columns: [{ muted: true }, {}],
      rows: input.details.map((row) => ({ cells: [row.label, row.value] })),
    });
  }
  return blocks;
}

/** What an item's page is built from: its answer and its flow's words. */
export type ItemPageInput = {
  item: Automations["Item"];
  runs: readonly Run[];
  declared: Pick<
    Automations["AutomationItems"],
    "runWords" | "verdictWords" | "file"
  >;
  /** The flow takes a file for each run: the Add part is drawn. */
  runFile: boolean;
};

/** An item's page body: tiles, file, add, runs (`pages.item`); its reading; whether it is going. */
export function itemBody(input: ItemPageInput): {
  blocks: Block[];
  reading?: Block[];
  going: boolean;
} {
  const { item, runs, declared } = input;
  const blocks: Block[] = [];
  if (declared.verdictWords)
    blocks.push({
      type: "metric",
      items: [
        { label: WORDS.total, value: String(item.runCount) },
        {
          label: declared.verdictWords.positive,
          value: String(item.positiveCount),
          tone: "success",
        },
        {
          label: declared.verdictWords.negative,
          value: String(item.negativeCount),
          tone: "error",
        },
      ],
    });
  blocks.push({
    type: "file",
    title: declared.file.title,
    open: { target: "item-file", itemId: item.id },
    ...(item.file ? { file: item.file } : {}),
  });
  // The heading rides on the form, as the platform sends it (backend item-page.ts).
  if (item.status === "ready" && !item.archivedAt && input.runFile)
    blocks.push({
      type: "questions",
      title: `Add ${smallFirst(declared.runWords.singular)}`,
      form: { kind: "run", itemId: item.id },
    });
  // Its runs: searchable, each finished one with a verdict green or red,
  // its word the chip (block set v2, backend item-page.ts `rankedRuns`).
  blocks.push(label(declared.runWords.plural), {
    type: "list",
    searchable: true,
    items: runs.map((run, index) => {
      const going = run.status === "pending" || run.status === "running";
      const words = declared.verdictWords;
      const tone =
        words && !going && run.verdict
          ? run.verdict === "positive"
            ? ("success" as const)
            : ("error" as const)
          : undefined;
      return {
        lead: String(index + 1),
        title: going
          ? WORDS.reading
          : (run.title ?? WORDS.unnamed[run.status] ?? run.status),
        ...(tone && words && run.verdict
          ? { badge: { text: words[run.verdict], tone } }
          : {}),
        ...(!going && typeof run.score === "number"
          ? { value: String(run.score), valueLabel: WORDS.score }
          : {}),
        ...(tone ? { valueTone: tone } : {}),
        ...(run.status === "failed" || run.status === "cancelled"
          ? { muted: true }
          : {}),
        open: { target: "run", runId: run.id },
      };
    }),
    empty: `No ${smallFirst(declared.runWords.plural)} yet.`,
  });
  const reading =
    item.status === "ready" && item.sections && item.sections.length > 0
      ? sectionBlocks(item.sections, false)
      : undefined;
  return {
    blocks,
    ...(reading ? { reading } : {}),
    going:
      item.status === "reading" ||
      runs.some((run) => run.status === "pending" || run.status === "running"),
  };
}
