import type { Candidate, CandidateDetail, Decision } from "@/lib/resume-candidates";

// Maps `resume_review` rows (populated by the n8n screening workflow) onto the
// Candidate / CandidateDetail shapes the dashboard + detail view already render.
// Column casing matches Postgres exactly. Only the columns the UI reads are typed.

export type ResumeReviewRow = {
  id: string;
  project_id: string | null;
  department: string | null;
  job_title: string | null;
  jd_role_title: string | null;
  First_Name: string | null;
  Last_Name: string | null;
  Email_Address: string | null;
  Phone_Number: number | string | null;
  City: string | null;
  State: string | null;
  Country: string | null;
  fit_score: number | null;
  decision: string | null;
  requires_human_review: number | null;
  one_line_summary: string | null;
  score_required_skills: number | null;
  score_experience_depth: number | null;
  score_domain_relevance: number | null;
  relevant_years: number | null;
  total_years_professional: number | null;
  required_skills: unknown;
  red_flags: unknown;
  key_concerns: unknown;
  human_review_reason: string | null;
  filename: string | null;
  submittedAt: string | null;
  createdAt: string | null;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// resume_review.decision is lowercase ("advance"/"hold"/"reject"); the UI uses
// capitalized values. The fallback is only read when the row is `pending`.
function capitalizeDecision(d: string | null): Decision {
  switch ((d ?? "").toLowerCase().trim()) {
    case "advance":
      return "Advance";
    case "reject":
      return "Reject";
    default:
      return "Hold";
  }
}

// jsonb arrays may hold plain strings or objects ({skill}, {reason}, …); coerce
// to a clean string[] so chips / lists render uniformly.
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const v = o.skill ?? o.name ?? o.reason ?? o.label ?? o.title;
        return typeof v === "string" ? v : null;
      }
      return null;
    })
    .filter((s): s is string => Boolean(s && s.trim()));
}

// Accept a date or full timestamp; keep YYYY-MM-DD for the table's date parsing.
function isoDay(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function mapResumeRow(row: ResumeReviewRow): Candidate {
  const name =
    [row.First_Name, row.Last_Name].filter(Boolean).join(" ").trim() ||
    "(no name)";
  // A row with no decision yet hasn't been screened → render as Pending.
  const pending = row.decision == null;
  const created = row.createdAt ? new Date(row.createdAt) : null;
  const newThisWeek = created
    ? Date.now() - created.getTime() < WEEK_MS
    : false;

  return {
    id: row.id,
    name,
    email: row.Email_Address ?? "",
    // Role = the opening's title we stamp on upload; fall back to the JD-parsed title.
    role: row.job_title ?? row.jd_role_title ?? "",
    company: row.department ?? "",
    appliedAt: isoDay(row.submittedAt ?? row.createdAt),
    fitScore: row.fit_score ?? 0,
    decision: capitalizeDecision(row.decision),
    newThisWeek,
    flagged: (row.requires_human_review ?? 0) > 0,
    pending,
  };
}

export function mapResumeDetail(row: ResumeReviewRow): CandidateDetail {
  const location = [row.City, row.State, row.Country].filter(Boolean).join(", ");
  const years = row.relevant_years ?? row.total_years_professional;
  const rawScores: { label: string; score: number | null }[] = [
    { label: "Skills match", score: row.score_required_skills },
    { label: "Experience", score: row.score_experience_depth },
    { label: "Domain", score: row.score_domain_relevance },
  ];
  const subScores = rawScores.filter(
    (s): s is { label: string; score: number } => s.score != null,
  );
  const flagReasons = [
    ...toStringList(row.red_flags),
    ...toStringList(row.key_concerns),
    ...(row.human_review_reason ? [row.human_review_reason] : []),
  ];

  return {
    phone: row.Phone_Number != null ? String(row.Phone_Number) : undefined,
    location: location || undefined,
    yearsExperience: years != null ? Math.round(years) : undefined,
    skills: toStringList(row.required_skills),
    summary: row.one_line_summary ?? undefined,
    subScores: subScores.length ? subScores : undefined,
    flagReasons: flagReasons.length ? flagReasons : undefined,
    resumeFileName: row.filename ?? undefined,
  };
}
