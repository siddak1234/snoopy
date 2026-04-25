"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// TODO(v2): Per-project client scoping.
// The query below reads every row in `GL Code Allocation` that the
// authenticated user can see via RLS. With a single onboarded client
// (currently "Claros") that's exactly the right rows. Before onboarding
// a second client, add a `client` column on the Project model, populate
// it on project creation, and add `.eq("client", project.client)` to
// the query so each project only sees its own client's rows.
//
// TODO(v2): The "Spend by GL category", "Top vendors", and per-invoice
// "Invoices" panels have no data source yet. They render empty states
// to communicate the eventual scope. Wire each up once line-item /
// vendor / category data lands in the schema.

type GLCodeAllocationRow = {
  id: string;
  location: string | null;
  total: number | null;
  invoice_count: number | null;
  period_start: string;
  period_end: string;
};

const TABLE = "GL Code Allocation";

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const integerFmt = new Intl.NumberFormat("en-US");

function formatDateRange(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const monthDay = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${monthDay(start)} – ${monthDay(end)}, ${end.getUTCFullYear()}`;
  }
  const monthDayYear = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(d);
  return `${monthDayYear(start)} – ${monthDayYear(end)}`;
}

function periodKey(period_start: string, period_end: string): string {
  return `${period_start}|${period_end}`;
}

export function GlCodeAllocationDashboard() {
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<GLCodeAllocationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickedPeriodKey, setPickedPeriodKey] = useState<string>("");
  const [pickedLocation, setPickedLocation] = useState<string>("");
  // TODO(v2): wire to actual invoice search once per-invoice rows exist.
  const [invoiceQuery, setInvoiceQuery] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("id, location, total, invoice_count, period_start, period_end");
      if (cancelled) return;
      if (qError) {
        setError("Could not load allocation data.");
        setRows([]);
        return;
      }
      setRows((data ?? []) as GLCodeAllocationRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const periods = useMemo(() => {
    if (!rows) return [];
    const seen = new Set<string>();
    const out: { key: string; period_start: string; period_end: string }[] = [];
    for (const r of rows) {
      if (!r.period_start || !r.period_end) continue;
      const k = periodKey(r.period_start, r.period_end);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({
        key: k,
        period_start: r.period_start,
        period_end: r.period_end,
      });
    }
    out.sort((a, b) =>
      a.period_end < b.period_end ? 1 : a.period_end > b.period_end ? -1 : 0,
    );
    return out;
  }, [rows]);

  const effectivePeriodKey = pickedPeriodKey || periods[0]?.key || "";

  const locations = useMemo(() => {
    if (!rows || !effectivePeriodKey) return [];
    const [ps, pe] = effectivePeriodKey.split("|");
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      if (r.period_start !== ps || r.period_end !== pe) continue;
      if (!r.location || seen.has(r.location)) continue;
      seen.add(r.location);
      out.push(r.location);
    }
    out.sort((a, b) => a.localeCompare(b));
    return out;
  }, [rows, effectivePeriodKey]);

  const effectiveLocation = locations.includes(pickedLocation)
    ? pickedLocation
    : (locations[0] ?? "");

  const selectedRow = useMemo(() => {
    if (!rows || !effectivePeriodKey || !effectiveLocation) return null;
    const [ps, pe] = effectivePeriodKey.split("|");
    return (
      rows.find(
        (r) =>
          r.period_start === ps &&
          r.period_end === pe &&
          r.location === effectiveLocation,
      ) ?? null
    );
  }, [rows, effectivePeriodKey, effectiveLocation]);

  // Period-over-period delta on the same location (when a prior period exists).
  const priorRow = useMemo(() => {
    if (!rows || !effectivePeriodKey || !effectiveLocation) return null;
    const idx = periods.findIndex((p) => p.key === effectivePeriodKey);
    if (idx < 0 || idx + 1 >= periods.length) return null;
    const prior = periods[idx + 1];
    return (
      rows.find(
        (r) =>
          r.period_start === prior.period_start &&
          r.period_end === prior.period_end &&
          r.location === effectiveLocation,
      ) ?? null
    );
  }, [rows, periods, effectivePeriodKey, effectiveLocation]);

  const isLoading = rows === null && !error;
  const hasNoData = !isLoading && (rows?.length ?? 0) === 0;

  const total = selectedRow?.total ?? null;
  const invoices = selectedRow?.invoice_count ?? null;
  const priorTotal = priorRow?.total ?? null;
  const totalDeltaPct =
    total != null && priorTotal != null && Number(priorTotal) > 0
      ? ((Number(total) - Number(priorTotal)) / Number(priorTotal)) * 100
      : null;

  return (
    <section
      aria-label="Invoice dashboard"
      className="flex flex-col gap-5"
    >
      {error ? (
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      {/* Dashboard header: title + download */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">
            Invoice Dashboard
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {isLoading
              ? "Loading…"
              : hasNoData
                ? "No invoices processed yet."
                : `${integerFmt.format(rows!.length)} period record${rows!.length === 1 ? "" : "s"} available`}
          </p>
        </div>
        <button
          type="button"
          disabled={hasNoData || isLoading}
          title={
            hasNoData
              ? "No invoices to download yet"
              : "Download invoice package"
          }
          className="btn-primary inline-flex !min-h-0 !px-4 !py-1.5 items-center gap-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download invoice package
        </button>
      </div>

      {/* Filter pills */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <FilterPill
          label="Close period"
          value={effectivePeriodKey}
          onChange={setPickedPeriodKey}
          options={periods.map((p) => ({
            value: p.key,
            label: formatDateRange(p.period_start, p.period_end),
          }))}
          placeholder={
            isLoading
              ? "Loading…"
              : hasNoData
                ? "No data available"
                : "Select a period"
          }
          disabled={isLoading || hasNoData}
        />
        <FilterPill
          label="Location"
          value={effectiveLocation}
          onChange={setPickedLocation}
          options={locations.map((loc) => ({ value: loc, label: loc }))}
          placeholder={
            isLoading
              ? "Loading…"
              : hasNoData
                ? "No data available"
                : !effectivePeriodKey
                  ? "Select a period first"
                  : locations.length === 0
                    ? "No locations for this period"
                    : "Select a location"
          }
          disabled={
            isLoading ||
            hasNoData ||
            !effectivePeriodKey ||
            locations.length === 0
          }
        />
      </div>

      {/* KPI tiles */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <KpiTile
          label="Total invoiced"
          value={total == null ? null : currencyFmt.format(Number(total))}
          delta={
            totalDeltaPct == null
              ? null
              : {
                  text: `${totalDeltaPct >= 0 ? "↑" : "↓"} ${Math.abs(totalDeltaPct).toFixed(1)}% vs prior`,
                  positive: totalDeltaPct >= 0,
                }
          }
          subtext={
            total == null
              ? hasNoData
                ? "Awaiting data"
                : "Select a period and location"
              : null
          }
        />
        <KpiTile
          label="Invoices"
          value={invoices == null ? null : integerFmt.format(Number(invoices))}
          subtext={
            invoices == null
              ? hasNoData
                ? "No invoices yet"
                : "Select a period and location"
              : "Vendor breakdown coming soon"
          }
        />
        <KpiTile
          label="Flagged for review"
          value={null}
          subtext="Confidence scoring coming soon"
        />
      </div>

      {/* Side-by-side: GL category breakdown + Top vendors */}
      <div className="grid gap-2.5 lg:grid-cols-[1.3fr_1fr]">
        <SectionPanel title="Spend by GL category">
          <EmptyMessage text="Per-category spend will appear here once line-item ingestion is wired up." />
        </SectionPanel>
        <SectionPanel title="Top vendors" rightLabel="By spend">
          <EmptyMessage text="Vendor breakdown will appear here once invoice metadata is captured." />
        </SectionPanel>
      </div>

      {/* Invoices table */}
      <SectionPanel
        title="Invoices"
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {/* TODO(v2): wire onClick to the upload pipeline (file picker → invoice store). */}
            <button
              type="button"
              className="btn-primary inline-flex !min-h-0 !px-4 !py-1.5 items-center gap-1.5 text-sm"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Upload invoices
            </button>
            <label htmlFor="invoice-search" className="sr-only">
              Search invoices
            </label>
            <input
              id="invoice-search"
              type="search"
              value={invoiceQuery}
              onChange={(e) => setInvoiceQuery(e.target.value)}
              placeholder="Search vendor or invoice #"
              className="w-44 rounded-lg border border-[var(--ring)] bg-[var(--bg)] px-3 py-1.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] sm:w-52"
            />
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">
                  Vendor / Invoice
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">
                  Date
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">
                  Amount
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-center font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-10 text-center text-xs text-[var(--muted)]"
                >
                  Per-invoice records will appear here once invoice ingestion is
                  wired up.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </section>
  );
}

function FilterPill({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const displayed = options.find((o) => o.value === value)?.label;

  return (
    <div
      className={`relative flex items-center justify-between gap-3 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {label}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-[var(--text)]">
          {displayed ?? (
            <span className="text-[var(--muted)]">{placeholder}</span>
          )}
        </div>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="shrink-0 text-[var(--muted)]"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent text-transparent opacity-0 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded-xl"
        aria-label={label}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function KpiTile({
  label,
  value,
  delta,
  subtext,
}: {
  label: string;
  value: string | null;
  delta?: { text: string; positive: boolean } | null;
  subtext?: string | null;
}) {
  return (
    <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p
        className={
          value == null
            ? "mt-1.5 text-2xl font-semibold text-[var(--muted)]"
            : "mt-1.5 text-2xl font-semibold text-[var(--text)]"
        }
      >
        {value ?? "—"}
      </p>
      {delta ? (
        <p
          className={
            delta.positive
              ? "mt-1 text-[11px] text-[var(--success-text)]"
              : "mt-1 text-[11px] text-[var(--error-text)]"
          }
        >
          {delta.text}
        </p>
      ) : subtext ? (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{subtext}</p>
      ) : null}
    </div>
  );
}

function SectionPanel({
  title,
  rightLabel,
  rightContent,
  children,
}: {
  title: string;
  rightLabel?: string;
  /** Use for richer right-side content (button row, search, etc). Wins over `rightLabel`. */
  rightContent?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[var(--text)]">{title}</h4>
        {rightContent
          ? rightContent
          : rightLabel
            ? <span className="text-[11px] text-[var(--muted)]">{rightLabel}</span>
            : null}
      </div>
      {children}
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="flex min-h-[140px] items-center justify-center px-4 text-center text-xs text-[var(--muted)]">
      {text}
    </div>
  );
}
