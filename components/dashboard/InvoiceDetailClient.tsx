"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { InvoiceFileViewer } from "@/components/dashboard/InvoiceFileViewer";

// One line item from claros-gl-code. All numeric-looking fields are stored as
// text and cast to numeric for display. Capitalization matches the actual
// Postgres column names exactly.
type LineItem = {
  id: string | number;
  filename: string;
  line_item_index: string | null;
  Item: string | null;
  GL_Account: string | null;
  GL_Category: string | null;
  line_notes: string | null;
  QTY: string | null;
  CU_Price: string | null;
  Amount: string | null;
  Confidence: string | null;
  Merchant: string | null;
  Invoice_Number: string | null;
  Invoice_Date: string | null;
  Status: string | null;
};

const TABLE = "claros-gl-code";

// Cent-level precision on the line-item page (unit prices commonly carry
// cents — e.g., $29.19 — and rounding loses meaningful information). The
// dashboard's headline KPIs continue to round to whole dollars; this is a
// per-page choice for the detail view.
const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFmt = new Intl.NumberFormat("en-US");

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// Strict YYYY-MM-DD guard — same convention as the invoices_for_period RPC.
function isValidIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Sortable numeric columns. Text columns (Item / GL) stay in document order.
type SortKey = "index" | "qty" | "unitPrice" | "amount" | "confidence";
type SortDir = "asc" | "desc";

// Pull a numeric sort value out of a (text-stored) line item field. NaN/null
// values bubble to the end on asc, top on desc. line_item_index uses parseInt
// to avoid the lexicographic '10' < '2' problem.
function getSortValue(item: LineItem, key: SortKey): number {
  const raw =
    key === "index"
      ? item.line_item_index
      : key === "qty"
        ? item.QTY
        : key === "unitPrice"
          ? item.CU_Price
          : key === "amount"
            ? item.Amount
            : item.Confidence;
  if (raw == null) return Number.POSITIVE_INFINITY;
  const n = key === "index" ? parseInt(raw, 10) : Number(raw);
  return isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

export function InvoiceDetailClient({
  filename,
  loungeCode,
}: {
  filename: string;
  loungeCode: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<LineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Default: line item index ascending — matches the order shown on the PDF.
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "index",
    dir: "asc",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // filename is globally unique today, but we additionally filter by
      // lounge_code (when carried through from the dashboard) so the query
      // stays scoped to the same view the user was looking at — defense in
      // depth for the eventual project↔lounge scoping work.
      let query = supabase.from(TABLE).select("*").eq("filename", filename);
      if (loungeCode) query = query.eq("lounge_code", loungeCode);
      const { data, error: qError } = await query;
      if (cancelled) return;
      if (qError) {
        setError("Could not load invoice details.");
        return;
      }
      setItems((data ?? []) as LineItem[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, filename, loungeCode]);

  // Sort runs in render rather than once at fetch — clicking a header should
  // reorder the visible rows without re-querying.
  const sortedItems = useMemo(() => {
    if (!items) return null;
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return items.slice().sort((a, b) => {
      const cmp = getSortValue(a, sort.key) - getSortValue(b, sort.key);
      if (cmp !== 0) return cmp * dirMul;
      // Stable tiebreak by id — keeps rows with equal sort keys in a
      // deterministic order across re-sorts.
      return String(a.id).localeCompare(String(b.id));
    });
  }, [items, sort]);

  // Click on the active column toggles asc⇄desc. Click on a different column
  // resets to asc — predictable single-step transition.
  const handleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  if (error) {
    return (
      <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
        {error}
      </p>
    );
  }

  if (items === null) {
    return (
      <p className="text-sm text-[var(--muted)]">Loading invoice…</p>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Invoice not found for this project.
      </p>
    );
  }

  // Header summary derived from the first row — all rows of one invoice share
  // these fields by definition (collapsed by filename upstream).
  const first = items[0];
  const total = items.reduce((s, it) => s + (Number(it.Amount) || 0), 0);
  const invoiceDateText = isValidIsoDate(first.Invoice_Date)
    ? dateFmt.format(new Date(`${first.Invoice_Date}T00:00:00Z`))
    : "—";

  return (
    <div className="flex flex-col gap-6">
      {/* Header summary */}
      <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryField label="Merchant">
          <span className="text-sm font-medium text-[var(--text)]">
            {first.Merchant ?? "—"}
          </span>
        </SummaryField>
        <SummaryField label="Invoice number">
          <span className="text-sm font-medium text-[var(--text)]">
            {first.Invoice_Number ?? "—"}
          </span>
        </SummaryField>
        <SummaryField label="Invoice date">
          <span className="text-sm font-medium text-[var(--text)]">
            {invoiceDateText}
          </span>
        </SummaryField>
        <SummaryField label="Status">
          <StatusPill status={first.Status} />
        </SummaryField>
        <SummaryField label="Total">
          <span className="text-sm font-medium tabular-nums text-[var(--text)]">
            {currencyFmt.format(total)}
          </span>
        </SummaryField>
        <SummaryField label="Line items">
          <span className="text-sm font-medium tabular-nums text-[var(--text)]">
            {integerFmt.format(items.length)}
          </span>
        </SummaryField>
      </dl>

      {/* Split view: PDF on the left (sticky on lg+ so it stays in view as
          line items scroll), line items table on the right. Stacks vertically
          below lg. PDF gets 3/5 of the row at lg+ — readable at US-letter
          aspect — line items get 2/5, since the table is naturally narrow. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {loungeCode ? (
          <div className="lg:sticky lg:top-4 self-start lg:col-span-3">
            <InvoiceFileViewer filename={filename} loungeCode={loungeCode} />
          </div>
        ) : null}

        {/* Line item table — text columns are stacked (primary on top,
            secondary metadata muted below) so long values wrap naturally
            without forcing the table wider. Numeric columns stay narrow. */}
        <div className="border-t border-[var(--ring)] pt-5 lg:border-t-0 lg:pt-0 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
            Line items
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  <SortableHeader label="#" sortKey="index" align="right" sort={sort} onSort={handleSort} />
                  <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">Item / Notes</th>
                  <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">GL Account / Category</th>
                  <SortableHeader label="Qty" sortKey="qty" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Unit Price" sortKey="unitPrice" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Amount" sortKey="amount" align="right" sort={sort} onSort={handleSort} />
                  <SortableHeader label="Conf." sortKey="confidence" align="right" sort={sort} onSort={handleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedItems?.map((it) => (
                  <LineItemRow key={String(it.id)} item={it} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// Header for a sortable numeric column. Whole th is clickable; chevron shows
// the active direction. Inactive columns render a muted up-down indicator so
// the affordance is visible before any interaction.
function SortableHeader({
  label,
  sortKey,
  align,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align: "left" | "right";
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey) => void;
}) {
  const isActive = sort.key === sortKey;
  const ariaSort = isActive
    ? sort.dir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <th
      aria-sort={ariaSort}
      className={`border-b border-[var(--ring)] px-3 py-2 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`group inline-flex items-center gap-1 text-[10px] uppercase tracking-wide transition hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded ${
          isActive ? "text-[var(--text)]" : "text-[var(--muted)]"
        } ${align === "right" ? "flex-row-reverse" : ""}`}
        aria-label={`Sort by ${label} ${
          isActive && sort.dir === "asc" ? "descending" : "ascending"
        }`}
      >
        <span>{label}</span>
        <SortIcon
          direction={isActive ? sort.dir : null}
        />
      </button>
    </th>
  );
}

// Tiny stacked-chevron indicator. Active arrow is full-opacity; the inactive
// arrow stays at low opacity so users see the column is sortable.
function SortIcon({ direction }: { direction: SortDir | null }) {
  return (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M5 1 L8.5 4.5 L1.5 4.5 Z"
        fill="currentColor"
        opacity={direction === "asc" ? 1 : 0.3}
      />
      <path
        d="M5 11 L1.5 7.5 L8.5 7.5 Z"
        fill="currentColor"
        opacity={direction === "desc" ? 1 : 0.3}
      />
    </svg>
  );
}

function LineItemRow({ item }: { item: LineItem }) {
  const qty = Number(item.QTY);
  const unitPrice = Number(item.CU_Price);
  const amount = Number(item.Amount);
  const confidence = Number(item.Confidence);
  const isNegative = !isNaN(amount) && amount < 0;

  return (
    <tr className="border-b border-[var(--ring)]/50 align-top last:border-b-0">
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-[var(--muted)]">
        {item.line_item_index ?? "—"}
      </td>
      {/* Item + Notes stacked: item bold on top, notes muted below.
          break-words handles long unbroken strings (e.g. SKU codes). */}
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium leading-snug text-[var(--text)] break-words">
          {item.Item ?? "—"}
        </p>
        {item.line_notes ? (
          <p className="mt-1 text-xs leading-snug text-[var(--muted)] break-words">
            {item.line_notes}
          </p>
        ) : null}
      </td>
      {/* GL account on top, category beneath in muted. Same stacking pattern. */}
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium tabular-nums text-[var(--text)] break-words">
          {item.GL_Account ?? "—"}
        </p>
        {item.GL_Category ? (
          <p className="mt-1 text-xs leading-snug text-[var(--muted)] break-words">
            {item.GL_Category}
          </p>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-[var(--text)]">
        {isNaN(qty) ? "—" : integerFmt.format(qty)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-sm tabular-nums text-[var(--text)]">
        {isNaN(unitPrice) ? "—" : currencyFmt.format(unitPrice)}
      </td>
      <td
        className={
          isNegative
            ? "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--error-text-muted)]"
            : "whitespace-nowrap px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]"
        }
      >
        {isNaN(amount) ? "—" : currencyFmt.format(amount)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-[var(--muted)]">
        {isNaN(confidence) ? "—" : `${Math.round(confidence)}%`}
      </td>
    </tr>
  );
}
