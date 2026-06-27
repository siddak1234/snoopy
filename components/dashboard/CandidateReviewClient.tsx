"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DecisionPill, EmptyMessage } from "@/components/dashboard/DashboardKit";
import { initials, type Candidate } from "@/lib/resume-candidates";
import { mapResumeRow, type ResumeReviewRow } from "@/lib/resume-candidates-data";

const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// Client-side fetcher for the "Needs review" page. Reads every resume_review row
// for the project (RLS-gated), maps them, keeps the flagged ones, and narrows to
// the Role/Department the dashboard was filtered to (when provided) so the list
// matches the count on the "Needs review" card. Each card links to the candidate
// detail page — the same href the dashboard table row uses.
export function CandidateReviewClient({
  projectId,
  role,
  department,
}: {
  projectId: string;
  role: string;
  department: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; candidates: Candidate[] }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("resume_review")
        .select("*, posting:job_postings(role, role_title)")
        .eq("project_id", projectId);
      if (cancelled) return;
      if (error) {
        setState({ status: "error" });
        return;
      }
      const candidates = ((data ?? []) as unknown as ResumeReviewRow[])
        .map(mapResumeRow)
        .filter((c) => c.flagged)
        .filter((c) => (role ? c.role === role : true))
        .filter((c) => (department ? c.company === department : true))
        .sort((a, b) => b.fitScore - a.fitScore);
      setState({ status: "ready", candidates });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, projectId, role, department]);

  if (state.status === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading flagged candidates…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
        Could not load flagged candidates.
      </p>
    );
  }
  if (state.candidates.length === 0) {
    return <EmptyMessage text="No candidates need review for this selection." />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        {integerFmt.format(state.candidates.length)}{" "}
        {state.candidates.length === 1 ? "candidate" : "candidates"} flagged for
        review.
      </p>
      <ul className="flex flex-col gap-2.5">
        {state.candidates.map((c) => (
          <li key={c.id}>
            <Link
              href={`/account/projects/${projectId}/candidates/detail?candidate=${encodeURIComponent(
                c.id,
              )}`}
              className="block rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-4 py-3 transition hover:bg-[var(--surface-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] text-[11px] font-semibold text-[var(--chip-text)]"
                  >
                    {initials(c.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {c.name}
                    </p>
                    {c.role ? (
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {c.role}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <DecisionPill decision={c.decision} />
                  <span className="text-sm font-semibold tabular-nums text-[var(--text)]">
                    {c.pending ? "—" : integerFmt.format(c.fitScore)}
                  </span>
                </div>
              </div>
              {c.flagReasons && c.flagReasons.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-7 text-[12px] text-[var(--text)]">
                  {c.flagReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 pl-7 text-[12px] text-[var(--muted)]">
                  Flagged for review — open to see details.
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
