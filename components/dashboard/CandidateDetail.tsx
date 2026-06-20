"use client";

import {
  SectionPanel,
  BreakdownList,
  DecisionPill,
  EmptyMessage,
} from "@/components/dashboard/DashboardKit";
import { ResumeViewerPlaceholder } from "@/components/dashboard/ResumeViewerPlaceholder";
import {
  initials,
  type Candidate,
  type CandidateDetail as CandidateDetailData,
} from "@/lib/resume-candidates";

// Per-candidate detail body, rendered on the candidate detail page (inside
// SectionCard, exactly like InvoiceDetailClient). Mirrors the invoice layout:
// a document viewer on top, candidate-specific detail panels under it. Built
// entirely from shared DashboardKit primitives — presentational, no hooks.

const integerFmt = new Intl.NumberFormat("en-US");
const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function CandidateDetail({
  candidate,
  detail,
}: {
  candidate: Candidate;
  detail: CandidateDetailData | null;
}) {
  const appliedLabel = candidate.appliedAt
    ? dateFmt.format(new Date(`${candidate.appliedAt}T00:00:00Z`))
    : "—";
  const isPending = candidate.pending === true;

  return (
    <div className="flex flex-col gap-5">
      {/* Header summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--chip-bg)] text-sm font-semibold text-[var(--chip-text)]"
          >
            {initials(candidate.name)}
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[var(--text)]">
              {candidate.name}
            </h3>
            <p className="truncate text-xs text-[var(--muted)]">
              {candidate.email || "—"}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {candidate.role} · {candidate.company} · Applied {appliedLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Fit score
            </p>
            <p className="text-2xl font-semibold tabular-nums text-[var(--text)]">
              {isPending ? "—" : integerFmt.format(candidate.fitScore)}
            </p>
          </div>
          <DecisionPill decision={isPending ? "Pending" : candidate.decision} />
        </div>
      </div>

      {/* Document viewer (placeholder until a store is connected) */}
      <SectionPanel title="Resume">
        <ResumeViewerPlaceholder fileName={detail?.resumeFileName} />
      </SectionPanel>

      {/* Candidate-specific detail under the viewer */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        <SectionPanel title="Assessment">
          {isPending ? (
            <EmptyMessage text="Awaiting screening — no assessment yet." />
          ) : (
            <div className="flex flex-col gap-4">
              {detail?.subScores && detail.subScores.length > 0 ? (
                <BreakdownList
                  items={detail.subScores.map((s) => ({
                    key: s.label,
                    label: s.label,
                    amount: s.score,
                  }))}
                  total={100}
                  formatValue={(n) => `${integerFmt.format(n)}`}
                  pctDigits={0}
                />
              ) : null}
              {detail?.summary ? (
                <p className="text-sm leading-relaxed text-[var(--text)]">
                  {detail.summary}
                </p>
              ) : (
                <EmptyMessage text="No screening summary available." />
              )}
              {candidate.flagged && detail?.flagReasons?.length ? (
                <div className="rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--warning-text)]">
                    Flagged for review
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[var(--text)]">
                    {detail.flagReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </SectionPanel>

        <SectionPanel title="Profile">
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Current title" value={detail?.title} />
            <Row label="Employer" value={detail?.currentEmployer} />
            <Row
              label="Experience"
              value={
                detail?.yearsExperience != null
                  ? `${detail.yearsExperience} yrs`
                  : undefined
              }
            />
            <Row
              label="Education"
              value={
                detail?.education?.length
                  ? detail.education
                      .map((e) => `${e.degree}, ${e.school}`)
                      .join(" · ")
                  : undefined
              }
            />
            <div>
              <dt className="text-[var(--muted)]">Skills</dt>
              <dd className="mt-1.5">
                {detail?.skills?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {detail.skills.map((s) => (
                      <span
                        key={s}
                        className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--chip-text)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[var(--muted)]">—</span>
                )}
              </dd>
            </div>
          </dl>
        </SectionPanel>

        <SectionPanel title="Contact">
          <dl className="flex flex-col gap-2.5 text-sm">
            <Row label="Email" value={candidate.email || undefined} />
            <Row label="Phone" value={detail?.phone} />
            <Row label="Location" value={detail?.location} />
            <div>
              <dt className="text-[var(--muted)]">Links</dt>
              <dd className="mt-1.5">
                {detail?.links?.length ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {detail.links.map((l) => (
                      <a
                        key={l.url}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-[var(--link)] hover:underline"
                      >
                        {l.label}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-[var(--muted)]">—</span>
                )}
              </dd>
            </div>
          </dl>
        </SectionPanel>
      </div>
    </div>
  );
}

// Key-value row — same pattern as the upload dialogs' success cards.
function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[var(--muted)]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-[var(--text)]">
        {value && value.trim() ? value : "—"}
      </dd>
    </div>
  );
}
