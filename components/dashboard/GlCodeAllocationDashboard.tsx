"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/dashboard/StatusPill";

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
  // GL category columns — all numeric, may be null/0 when no spend in that category.
  liquor: number | null;
  beer: number | null;
  wine: number | null;
  non_alcoholic_drinks: number | null;
  food_costs: number | null;
  bar_supplies: number | null;
  office_supplies: number | null;
  serviceware: number | null;
  paper_bar_supplies: number | null;
  cleaning_janitorial_supplies: number | null;
  non_contracted_repairs_and_maintenance: number | null;
  maintenance_agreement: number | null;
  taxes: number | null;
  travel_others: number | null;
  parking: number | null;
  employee_morale: number | null;
  licenses_and_permits: number | null;
  badging_and_training: number | null;
  network_costs: number | null;
  uniforms: number | null;
  dues_and_subscriptions: number | null;
  delivery_and_escort_fees: number | null;
  staffing_expense: number | null;
  merchant_deposit_credits: number | null;
  reimbursements: number | null;
  other: number | null;
};

const TABLE = "GL Code Allocation";

// Edit this list when adding/removing GL category columns from the table.
// `key` matches the Supabase column name; `label` is the human display name.
// Order here is documentation only — display is sorted by amount descending.
const GL_CATEGORIES: { key: keyof GLCodeAllocationRow; label: string }[] = [
  { key: "liquor", label: "Liquor" },
  { key: "beer", label: "Beer" },
  { key: "wine", label: "Wine" },
  { key: "non_alcoholic_drinks", label: "Non-alcoholic drinks" },
  { key: "food_costs", label: "Food costs" },
  { key: "bar_supplies", label: "Bar supplies" },
  { key: "office_supplies", label: "Office supplies" },
  { key: "serviceware", label: "Serviceware" },
  { key: "paper_bar_supplies", label: "Paper bar supplies" },
  { key: "cleaning_janitorial_supplies", label: "Cleaning & janitorial" },
  { key: "non_contracted_repairs_and_maintenance", label: "Non-contracted R&M" },
  { key: "maintenance_agreement", label: "Maintenance agreement" },
  { key: "taxes", label: "Taxes" },
  { key: "travel_others", label: "Travel & other" },
  { key: "parking", label: "Parking" },
  { key: "employee_morale", label: "Employee morale" },
  { key: "licenses_and_permits", label: "Licenses & permits" },
  { key: "badging_and_training", label: "Badging & training" },
  { key: "network_costs", label: "Network costs" },
  { key: "uniforms", label: "Uniforms" },
  { key: "dues_and_subscriptions", label: "Dues & subscriptions" },
  { key: "delivery_and_escort_fees", label: "Delivery & escort fees" },
  { key: "staffing_expense", label: "Staffing expense" },
  { key: "merchant_deposit_credits", label: "Merchant deposit credits" },
  { key: "reimbursements", label: "Reimbursements" },
  { key: "other", label: "Other" },
];

// When more than CATEGORY_TOP_N + 1 categories have spend, show the top N
// distinctly and roll the rest into a single "Other (N categories)" row.
const CATEGORY_TOP_N = 5;

// Top vendors RPC — see supabase/migrations/20260427000000_top_vendors_rpc.sql.
// Aggregates the claros-gl-code line items to per-invoice rows, then to per-merchant.
const TOP_VENDORS_LIMIT = 5;

type TopVendor = {
  merchant: string | null;
  invoice_count: number;
  total_spend: number;
};

// One row per invoice from the invoices_for_period RPC — see
// supabase/migrations/20260427000001_invoices_for_period_rpc.sql.
type Invoice = {
  filename: string;
  merchant: string | null;
  invoice_number: string | null;
  invoice_date: string | null; // ISO date "YYYY-MM-DD"
  amount: number;
  status: string | null;
  created_at: string; // ISO timestamp
};

// Color palette cycled across the top categories. Last entry (--muted) is
// reserved for the "Other" rollup so it visually recedes.
const CATEGORY_COLORS = [
  "var(--accent-strong)",
  "var(--success-text)",
  "var(--warning-text)",
  "var(--accent)",
  "var(--link)",
] as const;

const currencyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const integerFmt = new Intl.NumberFormat("en-US");

// Single-day display formatter: "Apr 28, 2026". Always UTC so date-only
// strings ("YYYY-MM-DD") don't shift across the local-zone boundary.
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

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

type CategoryItem = { key: string; label: string; amount: number };
type CategoryBreakdown = {
  items: CategoryItem[];
  nonZeroCount: number;
  total: number;
};

function getCategoryBreakdown(row: GLCodeAllocationRow): CategoryBreakdown {
  const allNonZero: CategoryItem[] = GL_CATEGORIES
    .map((cat) => ({
      key: String(cat.key),
      label: cat.label,
      amount: Number(row[cat.key]) || 0,
    }))
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const total = Number(row.total) || 0;

  if (allNonZero.length <= CATEGORY_TOP_N + 1) {
    return { items: allNonZero, nonZeroCount: allNonZero.length, total };
  }

  const top = allNonZero.slice(0, CATEGORY_TOP_N);
  const rest = allNonZero.slice(CATEGORY_TOP_N);
  const restAmount = rest.reduce((s, b) => s + b.amount, 0);
  return {
    items: [
      ...top,
      {
        key: "__other",
        label: `Other (${rest.length} categor${rest.length === 1 ? "y" : "ies"})`,
        amount: restAmount,
      },
    ],
    nonZeroCount: allNonZero.length,
    total,
  };
}

export function GlCodeAllocationDashboard({
  projectId,
}: {
  projectId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [rows, setRows] = useState<GLCodeAllocationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickedPeriodKey, setPickedPeriodKey] = useState<string>("");
  const [pickedLocation, setPickedLocation] = useState<string>("");
  // TODO(v2): wire to actual invoice search once per-invoice rows exist.
  const [invoiceQuery, setInvoiceQuery] = useState<string>("");

  const [vendors, setVendors] = useState<TopVendor[] | null>(null);
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("*");
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

  const categoryBreakdown = useMemo(
    () => (selectedRow ? getCategoryBreakdown(selectedRow) : null),
    [selectedRow],
  );

  // Top vendors via RPC — refetches whenever the period or location changes.
  // Cleanup flag prevents a stale response from clobbering a newer one.
  // Stale data stays visible during reload (no flicker, no loading state).
  useEffect(() => {
    if (!effectivePeriodKey || !effectiveLocation) return;
    const [period_start, period_end] = effectivePeriodKey.split("|");
    let cancelled = false;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "top_vendors_for_period",
        {
          p_lounge_code: effectiveLocation,
          p_period_start: period_start,
          p_period_end: period_end,
          p_limit: TOP_VENDORS_LIMIT,
        },
      );
      if (cancelled) return;
      if (rpcError) {
        setVendorsError("Could not load top vendors.");
        return;
      }
      setVendorsError(null);
      setVendors((data ?? []) as TopVendor[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, effectivePeriodKey, effectiveLocation]);

  // Per-invoice rows for the current selection. Same cancellation pattern as
  // the top vendors effect — stale data stays visible during reload (no flicker).
  useEffect(() => {
    if (!effectivePeriodKey || !effectiveLocation) return;
    const [period_start, period_end] = effectivePeriodKey.split("|");
    let cancelled = false;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc(
        "invoices_for_period",
        {
          p_lounge_code: effectiveLocation,
          p_period_start: period_start,
          p_period_end: period_end,
        },
      );
      if (cancelled) return;
      if (rpcError) {
        setInvoicesError("Could not load invoices.");
        return;
      }
      setInvoicesError(null);
      setInvoices((data ?? []) as Invoice[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, effectivePeriodKey, effectiveLocation]);

  // Client-side filter on the loaded invoices: matches `invoiceQuery` against
  // merchant or invoice_number (case-insensitive substring). Empty/whitespace
  // query passes through to show all rows.
  const filteredInvoices = useMemo(() => {
    if (!invoices) return null;
    const q = invoiceQuery.trim().toLowerCase();
    if (!q) return invoices;
    return invoices.filter(
      (inv) =>
        (inv.merchant ?? "").toLowerCase().includes(q) ||
        (inv.invoice_number ?? "").toLowerCase().includes(q),
    );
  }, [invoices, invoiceQuery]);

  const isLoading = rows === null && !error;
  const hasNoData = !isLoading && (rows?.length ?? 0) === 0;

  const total = selectedRow?.total ?? null;
  const invoiceCount = selectedRow?.invoice_count ?? null;
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
          value={invoiceCount == null ? null : integerFmt.format(Number(invoiceCount))}
          subtext={
            invoiceCount == null
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
        <SectionPanel
          title="Spend by GL category"
          rightLabel={
            categoryBreakdown && categoryBreakdown.nonZeroCount > 0
              ? `${categoryBreakdown.nonZeroCount} categor${categoryBreakdown.nonZeroCount === 1 ? "y" : "ies"}`
              : undefined
          }
        >
          {!categoryBreakdown || categoryBreakdown.items.length === 0 ? (
            <EmptyMessage text="No category spend recorded for this selection." />
          ) : (
            <CategoryBreakdownList
              items={categoryBreakdown.items}
              total={categoryBreakdown.total}
            />
          )}
        </SectionPanel>
        <SectionPanel title="Top vendors" rightLabel="By spend">
          {vendorsError ? (
            <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error-text)]">
              {vendorsError}
            </p>
          ) : vendors === null ? (
            <EmptyMessage text="Loading vendors…" />
          ) : vendors.length === 0 ? (
            <EmptyMessage text="No vendor activity this period." />
          ) : (
            <VendorsList vendors={vendors} />
          )}
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
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[var(--card)]">
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
              {invoicesError ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4">
                    <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-xs text-[var(--error-text)]">
                      {invoicesError}
                    </p>
                  </td>
                </tr>
              ) : invoices === null ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-xs text-[var(--muted)]">
                    Loading invoices…
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-xs text-[var(--muted)]">
                    No invoices for this period.
                  </td>
                </tr>
              ) : filteredInvoices?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-xs text-[var(--muted)]">
                    No invoices match your search.
                  </td>
                </tr>
              ) : (
                filteredInvoices?.map((inv) => (
                  <InvoiceRow
                    key={inv.filename}
                    invoice={inv}
                    projectId={projectId}
                  />
                ))
              )}
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

function InvoiceRow({
  invoice,
  projectId,
}: {
  invoice: Invoice;
  projectId: string;
}) {
  const router = useRouter();
  const amount = Number(invoice.amount);
  const isNegative = amount < 0;
  const merchantLabel = invoice.merchant ?? "(Unknown vendor)";
  const dateLabel = invoice.invoice_date
    ? dateFmt.format(new Date(`${invoice.invoice_date}T00:00:00Z`))
    : "—";
  // Filenames are stored with "/" separators and routed through a catch-all
  // segment ([...filename]). Encode per-segment so slashes stay as path
  // separators while special chars within a segment are still escaped.
  const href = `/account/projects/${projectId}/invoices/${invoice.filename
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b border-[var(--ring)]/50 transition hover:bg-[var(--surface-hover)] last:border-b-0"
    >
      <td className="px-3 py-2.5">
        {/* Merchant wraps in a Link so keyboard nav and "open in new tab" work.
            stopPropagation prevents the row's onClick from also firing on
            cmd+click (which would open a new tab AND navigate the current). */}
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="text-sm font-medium text-[var(--text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded"
        >
          {merchantLabel}
        </Link>
        {invoice.invoice_number ? (
          <p className="text-[10px] text-[var(--muted)]">
            {invoice.invoice_number}
          </p>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{dateLabel}</td>
      <td
        className={
          isNegative
            ? "px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--error-text-muted)]"
            : "px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]"
        }
      >
        {currencyFmt.format(amount)}
      </td>
      <td className="px-3 py-2.5 text-center">
        <StatusPill status={invoice.status} />
      </td>
    </tr>
  );
}

function VendorsList({ vendors }: { vendors: TopVendor[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {vendors.map((v, i) => {
        const total = Number(v.total_spend);
        const isNegative = total < 0;
        const count = Number(v.invoice_count);
        const merchantLabel = v.merchant ?? "(Unknown vendor)";
        return (
          <li
            key={`${v.merchant ?? "__unknown"}-${i}`}
            className="flex items-center justify-between gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--text)]">
                {merchantLabel}
              </p>
              <p className="text-[10px] text-[var(--muted)]">
                {count === 1 ? "1 invoice" : `${integerFmt.format(count)} invoices`}
              </p>
            </div>
            <p
              className={
                isNegative
                  ? "shrink-0 text-sm font-semibold tabular-nums text-[var(--error-text-muted)]"
                  : "shrink-0 text-sm font-semibold tabular-nums text-[var(--text)]"
              }
            >
              {currencyFmt.format(total)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryBreakdownList({
  items,
  total,
}: {
  items: CategoryItem[];
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => {
        const pct = total > 0 ? (item.amount / total) * 100 : 0;
        const isOther = item.key === "__other";
        const color = isOther
          ? "var(--muted)"
          : CATEGORY_COLORS[i % CATEGORY_COLORS.length];
        return (
          <div key={item.key}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span
                className={
                  isOther
                    ? "truncate text-[var(--muted)]"
                    : "truncate text-[var(--text)]"
                }
              >
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-[var(--muted)]">
                {currencyFmt.format(item.amount)}{" "}
                <span style={{ color }}>{pct.toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-strong)]">
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, pct)}%`,
                  backgroundColor: color,
                }}
              />
            </div>
          </div>
        );
      })}
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
