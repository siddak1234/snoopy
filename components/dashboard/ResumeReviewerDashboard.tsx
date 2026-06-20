"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { UploadCandidateDialog } from "@/components/dashboard/UploadCandidateDialog";
import { CreatePostingDialog } from "@/components/dashboard/CreatePostingDialog";
import {
  MOCK_CANDIDATES,
  DECISION_ORDER,
  DECISION_BAR_COLOR,
  DECISION_TEXT_CLASS,
  initials,
  makePendingCandidate,
  type Candidate,
} from "@/lib/resume-candidates";
import { MOCK_POSTINGS, makePosting, type Posting } from "@/lib/job-postings";

// Resume Reviewer dashboard. Mirrors the GL Code Allocation dashboard's layout
// and reuses the same presentational primitives (DashboardKit) — only the data
// and wiring differ. Data is MOCK for now (see lib/resume-candidates.ts): the
// candidate list lives in local state seeded from MOCK_CANDIDATES so the
// "Upload candidate" modal can add rows. The Export button is still a stub.

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
  // Used to build candidate-detail hrefs; also keeps parity with
  // GlCodeAllocationDashboard so the real data source drops in unchanged.
  projectId: string;
}) {
  // Candidate + posting lists in local state, seeded from mocks. The upload /
  // posting modals prepend to these; the real (project-scoped) source drops in
  // here later.
  const [candidates, setCandidates] = useState<Candidate[]>(MOCK_CANDIDATES);
  const [postings, setPostings] = useState<Posting[]>(MOCK_POSTINGS);
  const [pickedRole, setPickedRole] = useState<string>("");
  const [pickedCompany, setPickedCompany] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);

  // Filter options come from postings AND candidates, so a brand-new posting
  // with zero candidates is still selectable. Seeded postings match the seeded
  // candidate combos, so these lists are unchanged until a new posting is added.
  const roles = useMemo(
    () =>
      uniqueSorted([
        ...postings.map((p) => p.role),
        ...candidates.map((c) => c.role),
      ]),
    [postings, candidates],
  );
  // The "department" axis (Candidate.company === Posting.department).
  const companies = useMemo(
    () =>
      uniqueSorted([
        ...postings.map((p) => p.department),
        ...candidates.map((c) => c.company),
      ]),
    [postings, candidates],
  );

  const effectiveRole = roles.includes(pickedRole) ? pickedRole : roles[0] ?? "";
  const effectiveCompany = companies.includes(pickedCompany)
    ? pickedCompany
    : companies[0] ?? "";

  // Candidates in scope for the current role + company selection.
  const scoped = useMemo(
    () =>
      candidates.filter(
        (c) => c.role === effectiveRole && c.company === effectiveCompany,
      ),
    [candidates, effectiveRole, effectiveCompany],
  );

  const total = scoped.length;
  const newThisWeek = scoped.filter((c) => c.newThisWeek).length;
  // Decision-based aggregates exclude `pending` (not yet scored) candidates so
  // existing mock output is byte-identical until a pending row is added.
  const decidedCount = scoped.filter((c) => !c.pending).length;
  const advanceCount = scoped.filter(
    (c) => !c.pending && c.decision === "Advance",
  ).length;
  const needsReview = scoped.filter((c) => c.flagged).length;
  const advancePct = total > 0 ? Math.round((advanceCount / total) * 100) : 0;

  // Decision breakdown — one bar per outcome, colored per decision. Percentages
  // are over decided candidates only (pending excluded from numerator + total).
  const breakdownItems = useMemo(
    () =>
      DECISION_ORDER.map((d) => ({
        key: d,
        label: d,
        amount: scoped.filter((c) => !c.pending && c.decision === d).length,
        color: DECISION_BAR_COLOR[d],
      })),
    [scoped],
  );

  // Top candidates by fit score (descending), top 3 — pending excluded.
  const topItems = useMemo(
    () =>
      scoped
        .filter((c) => !c.pending)
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

  // Add an uploaded candidate to the current role + company scope (mock).
  function handleAddCandidate({ name }: { name: string }) {
    setCandidates((prev) => [
      makePendingCandidate({
        id: crypto.randomUUID(),
        name,
        role: effectiveRole,
        company: effectiveCompany,
        appliedAt: new Date().toISOString().slice(0, 10),
      }),
      ...prev,
    ]);
  }

  // Create a posting (mock) and jump the filters to it so the user lands on the
  // new (empty) opening, ready to upload candidates.
  function handleCreatePosting(input: {
    role: string;
    department: string;
    jobDescriptionFileName: string;
  }) {
    setPostings((prev) => [
      makePosting({
        id: crypto.randomUUID(),
        role: input.role,
        department: input.department,
        jobDescriptionFileName: input.jobDescriptionFileName,
        createdAt: new Date().toISOString().slice(0, 10),
      }),
      ...prev,
    ]);
    setPickedRole(input.role);
    setPickedCompany(input.department);
  }

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
      {/* Header: title + actions */}
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPostingOpen(true)}
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New job posting
          </button>
          <button
            type="button"
            title="Coming soon"
            onClick={() => {}}
            className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 items-center gap-1.5 text-sm"
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
          label="Department"
          value={effectiveCompany}
          onChange={setPickedCompany}
          options={companies.map((c) => ({ value: c, label: c }))}
          placeholder="Select a department"
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
              total={decidedCount}
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
              onClick={() => setUploadOpen(true)}
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
                    {query.trim()
                      ? "No candidates match your search."
                      : "No candidates yet — upload the first."}
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <CandidateRow key={c.id} candidate={c} projectId={projectId} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {/* Upload modal — Role + Company/Department are inherited from the current
          filter selection (read-only in the modal), so only name + resume PDF
          are asked. */}
      <UploadCandidateDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={projectId}
        role={effectiveRole}
        company={effectiveCompany}
        onAdd={handleAddCandidate}
      />

      {/* New-posting modal — opens a (role, department) scope candidates can be
          uploaded into. Departments come from the current option list. */}
      <CreatePostingDialog
        open={postingOpen}
        onClose={() => setPostingOpen(false)}
        departments={companies}
        onCreate={handleCreatePosting}
      />
    </section>
  );
}

function CandidateRow({
  candidate,
  projectId,
}: {
  candidate: Candidate;
  projectId: string;
}) {
  const router = useRouter();
  const dateLabel = candidate.appliedAt
    ? dateFmt.format(new Date(`${candidate.appliedAt}T00:00:00Z`))
    : "—";
  // Candidate id rides in a query string, mirroring the invoice detail route.
  const href = `/account/projects/${projectId}/candidates/detail?candidate=${encodeURIComponent(
    candidate.id,
  )}`;

  return (
    <tr
      onClick={() => router.push(href)}
      className="cursor-pointer border-b border-[var(--ring)]/50 transition hover:bg-[var(--surface-hover)] last:border-b-0"
    >
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[11px] font-semibold text-[var(--chip-text)]"
          >
            {initials(candidate.name)}
          </span>
          <div className="min-w-0">
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-sm font-medium text-[var(--text)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] rounded"
            >
              {candidate.name}
            </Link>
            <p className="truncate text-[10px] text-[var(--muted)]">
              {candidate.email || "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-xs text-[var(--muted)]">{dateLabel}</td>
      <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-[var(--text)]">
        {candidate.pending ? "—" : integerFmt.format(candidate.fitScore)}
      </td>
      <td className="px-3 py-2.5 text-center">
        <DecisionPill decision={candidate.pending ? "Pending" : candidate.decision} />
      </td>
    </tr>
  );
}
