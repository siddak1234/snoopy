"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// TODO(v2): Replace `client IS NULL` with a real project↔client linkage.
// The Project model currently has no client identifier, and the single
// onboarded client's rows were inserted with client = NULL. Before
// onboarding a second client, add a `client` column on Project, populate
// it on creation, and change the `.is("client", null)` filter below to
// `.eq("client", project.client)`.

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

  // User's explicit picks; effective values below derive a valid choice.
  const [pickedPeriodKey, setPickedPeriodKey] = useState<string>("");
  const [pickedLocation, setPickedLocation] = useState<string>("");

  // Single query on mount. All interactions are pure in-memory recompute.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("id, location, total, invoice_count, period_start, period_end")
        .is("client", null);
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

  // Distinct periods, newest first.
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

  // Distinct locations for the effective period, alphabetical.
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

  if (error) {
    return (
      <section aria-label="Allocation summary">
        <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
          {error}
        </p>
      </section>
    );
  }

  if (rows === null) {
    return <DashboardSkeleton />;
  }

  if (periods.length === 0) {
    return (
      <section aria-label="Allocation summary">
        <p className="text-sm text-[var(--muted)]">
          No GL Code Allocation rows for this project yet.
        </p>
      </section>
    );
  }

  const total = selectedRow?.total ?? null;
  const invoiceCount = selectedRow?.invoice_count ?? null;

  return (
    <section aria-label="Allocation summary" className="space-y-4">
      <FilterRow
        label="Period"
        options={periods.map((p) => ({
          value: p.key,
          label: formatDateRange(p.period_start, p.period_end),
        }))}
        value={effectivePeriodKey}
        onChange={setPickedPeriodKey}
      />
      <FilterRow
        label="Location"
        options={locations.map((loc) => ({ value: loc, label: loc }))}
        value={effectiveLocation}
        onChange={setPickedLocation}
        emptyMessage="No locations for this period."
      />
      <div className="border-t border-[var(--ring)] pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Total allocated
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
          {total == null ? "—" : currencyFmt.format(Number(total))}
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          {invoiceCount == null
            ? "No invoice count for this row."
            : `${integerFmt.format(Number(invoiceCount))} invoices`}
        </p>
      </div>
    </section>
  );
}

function FilterRow({
  label,
  options,
  value,
  onChange,
  emptyMessage,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  emptyMessage?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-1 border-b border-[var(--ring)]">
      <span className="shrink-0 pb-2.5 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {options.length === 0 ? (
        <span className="pb-2.5 text-sm text-[var(--muted)]">
          {emptyMessage ?? "No options."}
        </span>
      ) : (
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                aria-pressed={active}
                className={
                  active
                    ? "-mb-px shrink-0 border-b-2 border-[var(--accent-strong)] px-3 pb-2 text-sm font-semibold text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                    : "-mb-px shrink-0 border-b-2 border-transparent px-3 pb-2 text-sm text-[var(--muted)] transition hover:text-[var(--text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section aria-label="Allocation summary" className="space-y-4">
      <div className="flex items-end gap-3 border-b border-[var(--ring)] pb-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Period
        </span>
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-strong)]" />
      </div>
      <div className="flex items-end gap-3 border-b border-[var(--ring)] pb-2.5">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Location
        </span>
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-strong)]" />
      </div>
      <div className="border-t border-[var(--ring)] pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Total allocated
        </p>
        <div className="mt-1 h-10 w-64 animate-pulse rounded-md bg-[var(--surface-strong)]" />
        <div className="mt-3 h-4 w-32 animate-pulse rounded bg-[var(--surface-strong)]" />
      </div>
    </section>
  );
}
