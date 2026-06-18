"use client";

import { useMemo, useState } from "react";
import {
  KpiTile,
  ClickableKpiTile,
  FilterPill,
  SectionPanel,
  BreakdownList,
  RankedList,
  DecisionPill,
  EmptyMessage,
} from "@/components/dashboard/DashboardKit";
import {
  MOCK_CANDIDATES,
  DECISION_ORDER,
  DECISION_BAR_COLOR,
  DECISION_TEXT_CLASS,
  initials,
  type Candidate,
} from "@/lib/resume-candidates";

// Resume Reviewer dashboard. Mirrors the GL Code Allocation dashboard's layout
// and reuses the same presentational primitives (DashboardKit) — only the data
// and wiring differ. Data is MOCK for now (see lib/resume-candidates.ts) and
// the Export / Upload buttons are stubs.

const integerFmt = new Intl.NumberFormat("en-US");
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function ResumeReviewerDashboard({
  projectId,
}: {
  // Accepted for parity with GlCodeAllocationDashboard and so the real
  // (project-scoped) data source can drop in later without a signature change.
  projectId: string;
}) {
  void projectId;

  const [pickedRole, setPickedRole] = useState<string>("");
  const [pickedCompany, setPickedCompany] = useState<string>("");
  const [query, setQuery] = useState<string>("");

  const roles = useMemo(
    () => uniqueSorted(MOCK_CANDIDATES.map((c) => c.role)),
    [],
  );
  const companies = useMemo(
    () => uniqueSorted(MOCK_CANDIDATES.map((c) => c.company)),
    [],
  );

  const effectiveRole = roles.includes(pickedRole) ? pickedRole : roles[0] ?? "";
  const effectiveCompany = companies.includes(pickedCompany)
    ? pickedCompany
    : companies[0] ?? "";

  // Candidates in scope for the current role + company selection.
  const scoped = useMemo(
    () =>
      MOCK_CANDIDATES.filter(
        (c) => c.role === effectiveRole && c.company === effectiveCompany,
      ),
    [effectiveRole, effectiveCompany],
  );

  const total = scoped.length;
  const newThisWeek = scoped.filter((c) => c.newThisWeek).length;
  const advanceCount = scoped.filter((c) => c.decision === "Advance").length;
  const needsReview = scoped.filter((c) => c.flagged).length;
  const advancePct = total > 0 ? Math.round((advanceCount / total) * 100) : 0;

  // Decision breakdown — one bar per outcome, colored per decision.
  const breakdownItems = useMemo(
    () =>
      DECISION_ORDER.map((d) => ({
        key: d,
        label: d,
        amount: scoped.filter((c) => c.decision === d).length,
        color: DECISION_BAR_COLOR[d],
      })),
    [scoped],
  );

  // Top candidates by fit score (descending), top 3.
  const topItems = useMemo(
    () =>
      [...scoped]
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 3)
        .map((c) => ({
          key: c.id,
          title: c.name,
          subtitle: c.decision,
          value: integerFmt.format(c.fitScore),
          valueClassName: DECISION_TEXT_CLASS[c.decision],
        })),
    [scoped],
  );

  // Table rows: most recent applications first, then client-side search.
  const rows = useMemo(() => {
    const sorted = [...scoped].sort((a, b) =>
      a.appliedAt < b.appliedAt ? 1 : a.appliedAt > b.appliedAt ? -1 : 0,
    );
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q),
    );
  }, [scoped, query]);

  return (
    <section aria-label="Candidate dashboard" className="flex flex-col gap-5">
      {/* Header: title + export */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text)]">
            Candidate Dashboard
          </h3>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {integerFmt.format(total)} application{total === 1 ? "" : "s"}{" "}
            available
          </p>
        </div>
        <button
          type="button"
          title="Coming soon"
          onClick={() => {}}
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
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export shortlist
        </button>
      </div>

      {/* Filter pills */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <FilterPill
          label="Role"
          value={effectiveRole}
          onChange={setPickedRole}
          options={roles.map((r) => ({ value: r, label: r }))}
          placeholder="Select a role"
        />
        <FilterPill
          label="Company / Department"
          value={effectiveCompany}
          onChange={setPickedCompany}
          options={companies.map((c) => ({ value: c, label: c }))}
          placeholder="Select a company"
        />
      </div>

      {/* KPI tiles */}
      <div className="grid gap-2.5 sm:grid-cols-3">
        <KpiTile
          label="Total candidates"
          value={integerFmt.format(total)}
          subtext={`${integerFmt.format(newThisWeek)} new this week`}
        />
        <KpiTile
          label="Advance"
          value={integerFmt.format(advanceCount)}
          valueClassName="text-[var(--success-text)]"
          subtext={`${advancePct}% of pool`}
        />
        <ClickableKpiTile
          label="Needs review"
          value={needsReview}
          subtext="flagged by gates"
          highlighted={needsReview > 0}
          disabled={needsReview === 0}
          onClick={() => {}}
        />
      </div>

      {/* Side-by-side: decision breakdown + top candidates */}
      <div className="grid gap-2.5 lg:grid-cols-[1.3fr_1fr]">
        <SectionPanel
          title="Decision breakdown"
          rightLabel={`${DECISION_ORDER.length} outcomes`}
        >
          {total === 0 ? (
            <EmptyMessage text="No candidates for this selection." />
          ) : (
            <BreakdownList
              items={breakdownItems}
              total={total}
              formatValue={(n) => integerFmt.format(n)}
              pctDigits={0}
            />
          )}
        </SectionPanel>
        <SectionPanel title="Top candidates" rightLabel="by fit score">
          {topItems.length === 0 ? (
            <EmptyMessage text="No candidates for this selection." />
          ) : (
            <RankedList items={topItems} />
          )}
        </SectionPanel>
      </div>

      {/* Candidates table */}
      <SectionPanel
        title="Candidates"
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              title="Coming soon"
              onClick={() => {}}
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
              Upload candidate
            </button>
            <label htmlFor="candidate-search" className="sr-only">
              Search candidates
            </label>
            <input
              id="candidate-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or role"
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
                  Candidate / Email
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-left font-medium">
                  Applied
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-right font-medium">
                  Fit score
                </th>
                <th className="border-b border-[var(--ring)] px-3 py-2 text-center font-medium">
                  Decision
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-10 text-center text-xs text-[var(--muted)]"
                  >
                    No candidates match your search.
                  </td>
                </tr>
              ) : (
                rows.map((c) => <CandidateRow key={c.id} candidate={c} />)
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>
    </section>
  );
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const dateLabel = candidate.appliedAt
    ? dateFmt.format(new Date(`${candidate.appliedAt}T00:00:00Z`))
    : "—";

  return (
    <tr className="border-b border-[var(--ring)]/50 last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[11px] font-semibold text-[var(--chip-text)]"
          >
            {initials(candidate.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[var(--text)]">
              {candidate.name}
            </p>
            <p className="truncate text-[10px] text-[var(--muted)]">
              {candidate.email}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{dateLabel}</td>
      <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]">
        {integerFmt.format(candidate.fitScore)}
      </td>
      <td className="px-3 py-2.5 text-center">
        <DecisionPill decision={candidate.decision} />
      </td>
    </tr>
  );
}
