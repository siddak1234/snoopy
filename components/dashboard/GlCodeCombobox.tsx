"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// One selectable GL code for the dropdown. `group` is the parent category's
// display label (used as a non-selectable section header). Built by the parent
// from gl_account_map (selectable rows only).
export type GlOption = {
  code: string;
  label: string; // leaf label, e.g. "COGS - Liquor"
  fullName: string; // full colon-delimited path (written to GL_Category)
  group: string; // parent category label, e.g. "COGS - Food and Beverage"
};

// Searchable parent/child GL picker. Whole control is keyboard/clickable;
// closes on outside-click or Escape. Selecting calls onChange(code, fullName)
// so the caller can set GL_Account and display the derived GL_Category.
export function GlCodeCombobox({
  options,
  value,
  onChange,
  disabled,
}: {
  options: GlOption[];
  value: string | null;
  onChange: (code: string, fullName: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => options.find((o) => o.code === value) ?? null,
    [options, value],
  );

  // Filter by code / leaf label / full path, then re-group preserving order.
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.code.toLowerCase().includes(q) ||
            o.label.toLowerCase().includes(q) ||
            o.fullName.toLowerCase().includes(q),
        )
      : options;
    const byGroup = new Map<string, GlOption[]>();
    for (const o of list) {
      const arr = byGroup.get(o.group);
      if (arr) arr.push(o);
      else byGroup.set(o.group, [o]);
    }
    return [...byGroup.entries()];
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-1 rounded border border-[var(--ring)] bg-[var(--bg)] px-2 py-1 text-left text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-50"
      >
        <span className="truncate">
          {current ? (
            <>
              <span className="tabular-nums">{current.code}</span>
              <span className="text-[var(--muted)]"> — {current.label}</span>
            </>
          ) : (
            <span className="text-[var(--muted)]">{value ?? "Select GL code"}</span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-[var(--muted)]">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-[var(--ring)] bg-[var(--card)] shadow-lg">
          <div className="sticky top-0 bg-[var(--card)] p-1.5">
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search code or name"
              className="w-full rounded border border-[var(--ring)] bg-[var(--bg)] px-2 py-1 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
            />
          </div>
          {grouped.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[var(--muted)]">No matches.</p>
          ) : (
            grouped.map(([group, opts]) => (
              <div key={group}>
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  {group}
                </div>
                {opts.map((o) => (
                  <button
                    key={o.code}
                    type="button"
                    onClick={() => {
                      onChange(o.code, o.fullName);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-[var(--surface-hover)] ${
                      o.code === value ? "font-semibold text-[var(--text)]" : "text-[var(--text)]"
                    }`}
                  >
                    <span className="tabular-nums">{o.code}</span>
                    <span className="text-[var(--muted)]"> — {o.label}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
