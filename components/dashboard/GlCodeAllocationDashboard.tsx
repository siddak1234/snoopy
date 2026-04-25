"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// TODO(v2): Replace `client IS NULL` with a real project↔client linkage.
// The Project model currently has no client identifier, and the single
// onboarded client's rows were inserted with client = NULL. Before
// onboarding a second client, add a `client` column on Project, populate
// it on creation, and change the three `.is("client", null)` filters
// below to `.eq("client", project.client)`.

type GLCodeAllocationRow = {
  id: string;
  created_at: string;
  client: string | null;
  location: string | null;
  total: number | null;
  invoice_count: number | null;
  period_start: string;
  period_end: string;
};

type DateRange = Pick<GLCodeAllocationRow, "period_start" | "period_end">;
type SummaryRow = Pick<GLCodeAllocationRow, "total" | "invoice_count">;

const TABLE = "GL Code Allocation";

// Match the native <select> styling used on the project type field in
// CreateProjectDialog.tsx so the dashboard inputs read as native repo UI.
const SELECT_CLASSES =
  "w-full appearance-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 cursor-pointer";

const TILE_CLASSES =
  "rounded-xl border border-[var(--ring)] bg-[var(--card)] p-5";

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

function rangeKey(r: DateRange): string {
  return `${r.period_start}|${r.period_end}`;
}

export function GlCodeAllocationDashboard() {
  const supabase = useMemo(() => createClient(), []);

  const [ranges, setRanges] = useState<DateRange[] | null>(null);
  const [selectedRangeKey, setSelectedRangeKey] = useState<string>("");
  const [rangesLoading, setRangesLoading] = useState(true);

  const [locations, setLocations] = useState<string[] | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [locationsLoading, setLocationsLoading] = useState(false);

  const [row, setRow] = useState<SummaryRow | null>(null);
  const [rowLoading, setRowLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Initial: distinct date ranges, newest-first, pre-select top.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRangesLoading(true);
      setError(null);
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("period_start, period_end")
        .is("client", null);
      if (cancelled) return;
      if (qError) {
        setError("Could not load date ranges.");
        setRangesLoading(false);
        return;
      }
      const seen = new Set<string>();
      const unique: DateRange[] = [];
      for (const r of (data ?? []) as DateRange[]) {
        if (!r.period_start || !r.period_end) continue;
        const k = rangeKey(r);
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push({ period_start: r.period_start, period_end: r.period_end });
      }
      unique.sort((a, b) =>
        a.period_end < b.period_end ? 1 : a.period_end > b.period_end ? -1 : 0,
      );
      setRanges(unique);
      if (unique.length > 0) {
        setSelectedRangeKey(rangeKey(unique[0]));
      }
      setRangesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Range change → clear location, refetch locations for that range.
  useEffect(() => {
    if (!selectedRangeKey) return;
    const [period_start, period_end] = selectedRangeKey.split("|");
    let cancelled = false;
    (async () => {
      setLocationsLoading(true);
      setSelectedLocation("");
      setLocations(null);
      setRow(null);
      setError(null);
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("location")
        .is("client", null)
        .eq("period_start", period_start)
        .eq("period_end", period_end);
      if (cancelled) return;
      if (qError) {
        setError("Could not load locations.");
        setLocationsLoading(false);
        return;
      }
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const r of (data ?? []) as { location: string | null }[]) {
        if (!r.location || seen.has(r.location)) continue;
        seen.add(r.location);
        unique.push(r.location);
      }
      unique.sort((a, b) => a.localeCompare(b));
      setLocations(unique);
      setLocationsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRangeKey, supabase]);

  // Location change → fetch the matching summary row.
  useEffect(() => {
    if (!selectedRangeKey || !selectedLocation) return;
    const [period_start, period_end] = selectedRangeKey.split("|");
    let cancelled = false;
    (async () => {
      setRowLoading(true);
      setError(null);
      const { data, error: qError } = await supabase
        .from(TABLE)
        .select("total, invoice_count")
        .is("client", null)
        .eq("period_start", period_start)
        .eq("period_end", period_end)
        .eq("location", selectedLocation)
        .limit(1);
      if (cancelled) return;
      if (qError) {
        setError("Could not load summary.");
        setRowLoading(false);
        return;
      }
      const first = (data ?? [])[0] as SummaryRow | undefined;
      setRow(first ?? { total: null, invoice_count: null });
      setRowLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedRangeKey, selectedLocation, supabase]);

  const noData = !rangesLoading && ranges !== null && ranges.length === 0;
  const tilesLoading = rangesLoading || rowLoading;

  return (
    <section aria-label="Allocation summary">
      <h3 className="text-sm font-semibold text-[var(--text)]">
        Allocation summary
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <DropdownField
          label="Date range"
          name="gl-date-range"
          value={selectedRangeKey}
          onChange={setSelectedRangeKey}
          disabled={rangesLoading || noData}
          placeholder={
            rangesLoading
              ? "Loading…"
              : noData
                ? "No data available"
                : "Select a date range"
          }
          options={(ranges ?? []).map((r) => ({
            value: rangeKey(r),
            label: formatDateRange(r.period_start, r.period_end),
          }))}
        />
        <DropdownField
          label="Location"
          name="gl-location"
          value={selectedLocation}
          onChange={setSelectedLocation}
          disabled={
            locationsLoading ||
            !selectedRangeKey ||
            (locations !== null && locations.length === 0)
          }
          placeholder={
            locationsLoading
              ? "Loading…"
              : !selectedRangeKey
                ? "Select a date range first"
                : locations !== null && locations.length === 0
                  ? "No locations for this range"
                  : "Select a location"
          }
          options={(locations ?? []).map((loc) => ({ value: loc, label: loc }))}
        />
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <SummaryTile
          label="Total"
          loading={tilesLoading}
          value={
            noData
              ? "No data yet"
              : !selectedLocation
                ? "—"
                : row?.total == null
                  ? "—"
                  : currencyFmt.format(Number(row.total))
          }
          hint={
            noData
              ? "No GL Code Allocation rows for this project yet."
              : !selectedLocation
                ? "Select a location to see the total."
                : null
          }
          muted={noData || !selectedLocation}
        />
        <SummaryTile
          label="Invoice count"
          loading={tilesLoading}
          value={
            noData
              ? "No data yet"
              : !selectedLocation
                ? "—"
                : row?.invoice_count == null
                  ? "—"
                  : integerFmt.format(Number(row.invoice_count))
          }
          hint={
            noData
              ? "No GL Code Allocation rows for this project yet."
              : !selectedLocation
                ? "Select a location to see the invoice count."
                : null
          }
          muted={noData || !selectedLocation}
        />
      </div>
    </section>
  );
}

function DropdownField({
  label,
  name,
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {label}
      </label>
      <div className="relative mt-1.5">
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={SELECT_CLASSES}
        >
          <option value="" disabled className="text-[var(--muted)]">
            {placeholder}
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  loading,
  muted,
  hint,
}: {
  label: string;
  value: string;
  loading?: boolean;
  muted?: boolean;
  hint?: string | null;
}) {
  return (
    <div className={TILE_CLASSES}>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-32 animate-pulse rounded-md bg-[var(--surface-strong)]" />
      ) : (
        <p
          className={
            muted
              ? "mt-2 text-2xl font-semibold text-[var(--muted)]"
              : "mt-2 text-2xl font-semibold text-[var(--text)]"
          }
        >
          {value}
        </p>
      )}
      {hint && !loading ? (
        <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
