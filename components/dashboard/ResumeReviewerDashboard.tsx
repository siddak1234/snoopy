"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
  DECISION_ORDER,
  DECISION_BAR_COLOR,
  DECISION_TEXT_CLASS,
  initials,
  makePendingCandidate,
  type Candidate,
} from "@/lib/resume-candidates";
import { mapResumeRow, type ResumeReviewRow } from "@/lib/resume-candidates-data";
import {
  makePosting,
  mapJobPostingRow,
  type Posting,
  type JobPostingRow,
} from "@/lib/job-postings";

// Resume Reviewer dashboard. Mirrors the GL Code Allocation dashboard: reads its
// rows client-side from `resume_review` (RLS-gated by project membership) and
// reuses the same presentational primitives (DashboardKit). A freshly uploaded
// candidate is shown optimistically as "Pending" and reconciled with its real
// (screened) row — same id — once n8n inserts it.

const TABLE = "resume_review";

const integerFmt = new Intl.NumberFormat("en-US");
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function ResumeReviewerDashboard({
  projectId,
}: {
  projectId: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  // `candidates` = real rows from the DB (null = loading). `optimistic` = rows
  // added this session after an upload, before their screened row exists.
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [optimistic, setOptimistic] = useState<Candidate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Postings: loaded from job_postings on mount, plus any created this session
  // (optimistically prepended so the filter jumps to a new posting immediately).
  const [postings, setPostings] = useState<Posting[]>([]);

  const [pickedRole, setPickedRole] = useState<string>("");
  const [pickedCompany, setPickedCompany] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial load (and on project change). Mirrors the GL dashboard's pattern.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("project_id", projectId);
      if (cancelled) return;
      if (error) {
        setLoadError("Could not load candidates.");
        setCandidates([]);
        return;
      }
      setLoadError(null);
      setCandidates(((data ?? []) as unknown as ResumeReviewRow[]).map(mapResumeRow));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, projectId]);

  // Load persisted postings for this project (drive the filter options even
  // before any candidate exists). RLS-gated like the candidates read.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("job_postings")
        .select("*")
        .eq("project_id", projectId);
      if (cancelled || error) return;
      setPostings(((data ?? []) as unknown as JobPostingRow[]).map(mapJobPostingRow));
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, projectId]);

  // Silent refetch used by the post-upload poll; returns the fresh rows.
  const reload = useCallback(async (): Promise<Candidate[]> => {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId);
    if (error) return [];
    const mapped = ((data ?? []) as unknown as ResumeReviewRow[]).map(mapResumeRow);
    setCandidates(mapped);
    return mapped;
  }, [supabase, projectId]);

  // Clear any pending poll on unmount.
  useEffect(
    () => () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    },
    [],
  );

  const loading = candidates === null && !loadError;

  // Displayed list = real rows, plus optimistic rows whose real (same-id) row
  // hasn't landed yet. Once the screened row arrives, the optimistic one drops.
  const allCandidates = useMemo(() => {
    const real = candidates ?? [];
    const realIds = new Set(real.map((c) => c.id));
    return [...optimistic.filter((o) => !realIds.has(o.id)), ...real];
  }, [candidates, optimistic]);

  // Filter options come from the candidates plus any session-local postings, so
  // a just-created posting is selectable before its first candidate exists.
  const roles = useMemo(
    () =>
      uniqueSorted([
        ...postings.map((p) => p.role),
        ...allCandidates.map((c) => c.role),
      ]),
    [postings, allCandidates],
  );
  const companies = useMemo(
    () =>
      uniqueSorted([
        ...postings.map((p) => p.department),
        ...allCandidates.map((c) => c.company),
      ]),
    [postings, allCandidates],
  );

  const effectiveRole = roles.includes(pickedRole) ? pickedRole : roles[0] ?? "";
  const effectiveCompany = companies.includes(pickedCompany)
    ? pickedCompany
    : companies[0] ?? "";

  // Candidates in scope for the current role + department selection.
  const scoped = useMemo(
    () =>
      allCandidates.filter(
        (c) => c.role === effectiveRole && c.company === effectiveCompany,
      ),
    [allCandidates, effectiveRole, effectiveCompany],
  );

  const total = scoped.length;
  const newThisWeek = scoped.filter((c) => c.newThisWeek).length;
  // Decision-based aggregates exclude `pending` (not yet scored) candidates.
  const decidedCount = scoped.filter((c) => !c.pending).length;
  const advanceCount = scoped.filter(
    (c) => !c.pending && c.decision === "Advance",
  ).length;
  const needsReview = scoped.filter((c) => c.flagged).length;
  const advancePct = total > 0 ? Math.round((advanceCount / total) * 100) : 0;

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

  // Optimistically show the uploaded candidate as Pending, then poll for its
  // real (screened) row. id = the candidate_id the upload route returned.
  function handleAddCandidate({
    name,
    candidateId,
  }: {
    name: string;
    candidateId: string;
  }) {
    setOptimistic((prev) => [
      makePendingCandidate({
        id: candidateId,
        name,
        role: effectiveRole,
        company: effectiveCompany,
        appliedAt: new Date().toISOString().slice(0, 10),
      }),
      ...prev,
    ]);
    let tries = 0;
    if (pollRef.current) clearTimeout(pollRef.current);
    const tick = async () => {
      tries += 1;
      const rows = await reload();
      if (rows.some((r) => r.id === candidateId)) return; // reconciled
      if (tries < 8) pollRef.current = setTimeout(tick, 5000);
    };
    pollRef.current = setTimeout(tick, 4000);
  }

  // Create a session-local posting and jump the filters to it so the user lands
  // on the new (empty) opening, ready to upload candidates into.
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

  // Table rows: most recent first, then client-side search.
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
            {loading
              ? "Loading…"
              : `${integerFmt.format(total)} application${total === 1 ? "" : "s"} available`}
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
              {loading ? (
                <StateRow text="Loading candidates…" />
              ) : loadError ? (
                <StateRow text={loadError} />
              ) : rows.length === 0 ? (
                <StateRow
                  text={
                    query.trim()
                      ? "No candidates match your search."
                      : "No candidates yet — upload the first."
                  }
                />
              ) : (
                rows.map((c) => (
                  <CandidateRow key={c.id} candidate={c} projectId={projectId} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionPanel>

      {/* Upload modal — Role + Department inherited from the current filter
          selection (read-only in the modal); only name + resume PDF are asked. */}
      <UploadCandidateDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        projectId={projectId}
        role={effectiveRole}
        company={effectiveCompany}
        onAdd={handleAddCandidate}
      />

      {/* New-posting modal — opens a (role, department) scope to upload into. */}
      <CreatePostingDialog
        open={postingOpen}
        onClose={() => setPostingOpen(false)}
        projectId={projectId}
        departments={companies}
        onCreate={handleCreatePosting}
      />
    </section>
  );
}

function StateRow({ text }: { text: string }) {
  return (
    <tr>
      <td
        colSpan={4}
        className="px-3 py-10 text-center text-xs text-[var(--muted)]"
      >
        {text}
      </td>
    </tr>
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
        <DecisionPill
          decision={candidate.pending ? "Pending" : candidate.decision}
        />
      </td>
    </tr>
  );
}
