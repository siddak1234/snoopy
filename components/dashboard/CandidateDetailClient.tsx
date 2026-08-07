"use client";

import { useEffect, useState } from "react";
import { platformApiJson } from "@/lib/platform-api";
import { CandidateDetail } from "@/components/dashboard/CandidateDetail";
import type {
  Candidate,
  CandidateDetail as CandidateDetailData,
} from "@/lib/resume-candidates";
import {
  mapResumeRow,
  mapResumeDetail,
  type ResumeReviewRow,
} from "@/lib/resume-candidates-data";

// Client-side fetcher for the candidate detail page — mirrors InvoiceDetailClient.
// Reads the one resume_review row by id (RLS-gated, and scoped to the project so
// a stray id from another project can't be opened) and maps it to the shared
// CandidateDetail view.
export function CandidateDetailClient({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "missing" }
    | { status: "ready"; candidate: Candidate; detail: CandidateDetailData }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data: ResumeReviewRow | null;
      try {
        const response = await platformApiJson<{
          item: ResumeReviewRow | null;
        }>(
          `/v1/projects/${encodeURIComponent(projectId)}/recruiting/candidates/${encodeURIComponent(candidateId)}`,
        );
        data = response.item;
      } catch {
        if (cancelled) return;
        setState({ status: "error" });
        return;
      }
      if (cancelled) return;
      if (!data) {
        setState({ status: "missing" });
        return;
      }
      const row = data;
      setState({
        status: "ready",
        candidate: mapResumeRow(row),
        detail: mapResumeDetail(row),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, candidateId]);

  if (state.status === "loading") {
    return <p className="text-sm text-[var(--muted)]">Loading candidate…</p>;
  }
  if (state.status === "error") {
    return (
      <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
        Could not load this candidate.
      </p>
    );
  }
  if (state.status === "missing") {
    return (
      <div className="rounded-lg border border-[var(--ring)]/50 px-4 py-10 text-center text-sm text-[var(--muted)]">
        This candidate isn’t available — it may still be screening, or doesn’t
        belong to this project.
      </div>
    );
  }
  return (
    <CandidateDetail
      projectId={projectId}
      candidate={state.candidate}
      detail={state.detail}
    />
  );
}
