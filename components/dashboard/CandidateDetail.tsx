"use client";

import type { ReactNode } from "react";
import {
  SectionPanel,
  BreakdownList,
  DecisionPill,
  EmptyMessage,
} from "@/components/dashboard/DashboardKit";
import { ResumeViewerPlaceholder } from "@/components/dashboard/ResumeViewerPlaceholder";
import { ResumeFileViewer } from "@/components/dashboard/ResumeFileViewer";
import {
  initials,
  type Candidate,
  type CandidateDetail as CandidateDetailData,
  type SkillMatch,
} from "@/lib/resume-candidates";

// Per-candidate detail body. The resume renders on top; the screening output is
// shown below — a fixed summary (Assessment + Contact), then collapsible groups
// (Skills, Experience, Gates, Red flags, Recommendation). Groups use native
// <details>, so opening one pushes siblings DOWN in normal flow — never overlaps.

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
              {candidate.role || "—"} · {candidate.company || "—"} · Applied{" "}
              {appliedLabel}
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

      {/* Resume PDF — signed-URL viewer when a file exists, else the placeholder. */}
      <SectionPanel title="Resume">
        {detail?.resumeFileName ? (
          <ResumeFileViewer
            candidateId={candidate.id}
            fileName={detail.resumeFileName}
          />
        ) : (
          <ResumeViewerPlaceholder fileName={detail?.resumeFileName} />
        )}
      </SectionPanel>

      {/* Fixed summary: Assessment + Contact */}
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

      {/* Collapsible detail groups (hidden while pending) */}
      {!isPending && detail ? (
        <div className="flex flex-col gap-2.5">
          {/* SKILLS */}
          {detail.requiredSkills?.length ||
          detail.preferredSkills?.length ||
          detail.transferableSkills?.length ||
          detail.missingCriticalSkills?.length ? (
            <Disclosure
              title="Skills"
              badge={
                detail.requiredCoveragePct != null ? (
                  <Badge tone="muted">
                    {Math.round(detail.requiredCoveragePct)}% required coverage
                  </Badge>
                ) : null
              }
              defaultOpen
            >
              <div className="flex flex-col gap-4">
                <SkillGroup label="Required skills" skills={detail.requiredSkills} />
                <SkillGroup
                  label="Preferred skills"
                  skills={detail.preferredSkills}
                  coverage={detail.preferredCoveragePct}
                />
                <ChipList
                  label="Transferable skills"
                  items={detail.transferableSkills}
                />
                <ChipList
                  label="Missing critical skills"
                  items={detail.missingCriticalSkills}
                  tone="bad"
                />
              </div>
            </Disclosure>
          ) : null}

          {/* EXPERIENCE */}
          {detail.relevantYears != null ||
          detail.seniorityAssessment ||
          detail.careerTrajectory ||
          detail.tenurePattern ||
          detail.domainRelevance ? (
            <Disclosure title="Experience">
              <dl className="flex flex-col gap-3 text-sm">
                <Field
                  label="Years (relevant / total)"
                  value={
                    detail.relevantYears != null || detail.totalYears != null
                      ? `${fmtYears(detail.relevantYears)} relevant · ${fmtYears(detail.totalYears)} total`
                      : undefined
                  }
                />
                <Field
                  label="Seniority vs. role"
                  value={detail.seniorityAssessment}
                  capitalize
                  note={detail.seniorityReasoning}
                />
                <Field
                  label="Domain relevance"
                  value={detail.domainRelevance}
                  capitalize
                  note={detail.domainRelevanceNotes}
                />
                <Field label="Career trajectory" value={detail.careerTrajectory} />
                <Field label="Tenure pattern" value={detail.tenurePattern} />
                <Field
                  label="Relevant-years basis"
                  value={detail.relevantYearsReasoning}
                />
                <ListField label="Employment gaps" items={detail.employmentGaps} />
              </dl>
            </Disclosure>
          ) : null}

          {/* HARD GATES */}
          {detail.gates?.length ? (
            <Disclosure
              title="Hard gates"
              badge={
                detail.overallGateStatus ? (
                  <Badge tone={gateTone(detail.overallGateStatus)}>
                    {detail.overallGateStatus}
                  </Badge>
                ) : null
              }
            >
              <div className="flex flex-col gap-3">
                {detail.gates.map((g) => (
                  <div
                    key={g.gate}
                    className="rounded-lg border border-[var(--ring)]/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--text)]">
                        {labelize(g.gate)}
                      </span>
                      <Badge tone={gateTone(g.status)}>{g.status}</Badge>
                    </div>
                    {g.requirement ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Requirement: {g.requirement}
                      </p>
                    ) : null}
                    {g.candidateValue ? (
                      <p className="text-xs text-[var(--muted)]">
                        Candidate: {g.candidateValue}
                      </p>
                    ) : null}
                    {g.reasoning ? (
                      <p className="mt-1 text-xs text-[var(--text)]">{g.reasoning}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Disclosure>
          ) : null}

          {/* RED FLAGS */}
          {detail.redFlags?.length ? (
            <Disclosure
              title="Red flags"
              badge={<Badge tone="muted">{detail.redFlags.length}</Badge>}
            >
              <div className="flex flex-col gap-3">
                {detail.redFlags.map((f, i) => (
                  <div
                    key={`${f.type}-${i}`}
                    className="rounded-lg border border-[var(--ring)]/60 px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--text)]">
                        {labelize(f.type)}
                      </span>
                      <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                    </div>
                    {f.description ? (
                      <p className="mt-1 text-xs text-[var(--text)]">
                        {f.description}
                      </p>
                    ) : null}
                    {f.evidence ? (
                      <p className="mt-1 text-xs text-[var(--muted)]">{f.evidence}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Disclosure>
          ) : null}

          {/* RECOMMENDATION */}
          {detail.keyStrengths?.length ||
          detail.keyConcerns?.length ||
          detail.interviewFocusAreas?.length ||
          detail.recommendedNextStep ? (
            <Disclosure
              title="Recommendation"
              badge={
                detail.decisionConfidence ? (
                  <Badge tone="muted">{detail.decisionConfidence} confidence</Badge>
                ) : null
              }
            >
              <div className="flex flex-col gap-4">
                {detail.recommendedNextStep ? (
                  <Field
                    label="Recommended next step"
                    value={detail.recommendedNextStep}
                  />
                ) : null}
                <ListField label="Key strengths" items={detail.keyStrengths} />
                <ListField label="Key concerns" items={detail.keyConcerns} />
                <ListField
                  label="Interview focus areas"
                  items={detail.interviewFocusAreas}
                />
              </div>
            </Disclosure>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

function fmtYears(n?: number): string {
  return n != null ? `${Math.round(n * 10) / 10} yrs` : "—";
}
function labelize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function gateTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === "pass") return "good";
  if (s === "fail") return "bad";
  return "muted";
}
function severityTone(sev: string): Tone {
  const s = sev.toLowerCase();
  if (s === "high") return "bad";
  if (s === "medium") return "warn";
  return "muted";
}
function matchTone(match: string): Tone {
  const m = match.toLowerCase();
  if (m === "strong") return "good";
  if (m === "partial") return "warn";
  if (m === "none") return "bad";
  return "muted";
}

type Tone = "good" | "warn" | "bad" | "muted";

function Disclosure({
  title,
  badge,
  defaultOpen,
  children,
}: {
  title: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-[var(--ring)] bg-[var(--card)] [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          {title}
          {badge}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="border-t border-[var(--ring)]/60 px-4 py-3">{children}</div>
    </details>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cls =
    tone === "good"
      ? "text-[var(--success-text)] border-[var(--success-text)]/30"
      : tone === "bad"
        ? "text-[var(--error-text)] border-[var(--error-text)]/30"
        : tone === "warn"
          ? "text-[var(--warning-text)] border-[var(--warning-text)]/30"
          : "text-[var(--muted)] border-[var(--ring)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${cls}`}
    >
      {children}
    </span>
  );
}

function SkillGroup({
  label,
  skills,
  coverage,
}: {
  label: string;
  skills?: SkillMatch[];
  coverage?: number;
}) {
  if (!skills?.length) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
        {coverage != null ? ` · ${Math.round(coverage)}%` : ""}
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {skills.map((s, i) => (
          <li
            key={`${s.skill}-${i}`}
            className="rounded-lg border border-[var(--ring)]/60 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--text)]">{s.skill}</span>
              <Badge tone={matchTone(s.match)}>{s.match}</Badge>
            </div>
            {s.evidence ? (
              <p className="mt-1 text-xs text-[var(--muted)]">{s.evidence}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChipList({
  label,
  items,
  tone = "muted",
}: {
  label: string;
  items?: string[];
  tone?: Tone;
}) {
  if (!items?.length) return null;
  const cls =
    tone === "bad"
      ? "text-[var(--error-text)] border-[var(--error-text)]/30"
      : "text-[var(--chip-text)] border-transparent bg-[var(--chip-bg)]";
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={`${it}-${i}`}
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
          >
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  note,
  capitalize,
}: {
  label: string;
  value?: string;
  note?: string;
  capitalize?: boolean;
}) {
  if (!value && !note) return null;
  return (
    <div>
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd
        className={`mt-0.5 text-[var(--text)] ${capitalize ? "capitalize" : ""}`}
      >
        {value ?? "—"}
      </dd>
      {note ? (
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function ListField({ label, items }: { label: string; items?: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <ul className="mt-1.5 list-disc space-y-1 pl-4 text-sm text-[var(--text)]">
        {items.map((it, i) => (
          <li key={`${it}-${i}`}>{it}</li>
        ))}
      </ul>
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
