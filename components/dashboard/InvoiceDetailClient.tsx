"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/dashboard/StatusPill";

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

// Parse text-stored integer for line_item_index ordering. parseInt avoids
// the lexicographic '10' < '2' issue.
function parseIndex(s: string | null): number {
  if (s == null) return Number.POSITIVE_INFINITY;
  const n = parseInt(s, 10);
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
      // line_item_index is text-stored; sort numerically with NaN/null pushed
      // to the end. Stable tiebreak by id.
      const sorted = ((data ?? []) as LineItem[]).slice().sort((a, b) => {
        const ai = parseIndex(a.line_item_index);
        const bi = parseIndex(b.line_item_index);
        if (ai !== bi) return ai - bi;
        return String(a.id).localeCompare(String(b.id));
      });
      setItems(sorted);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, filename, loungeCode]);

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

      {/* Line item table — text columns are stacked (primary on top, secondary
          metadata muted below) so long values wrap naturally without forcing
          the table wider. Numeric columns stay narrow on the right. */}
      <div className="border-t border-[var(--ring)] pt-5">
        <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">
          Line items
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">#</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">Item / Notes</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">GL Account / Category</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">Qty</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">Unit Price</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">Amount</th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <LineItemRow key={String(it.id)} item={it} />
              ))}
            </tbody>
          </table>
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
