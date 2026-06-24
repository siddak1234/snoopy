import type {
  Candidate,
  CandidateDetail,
  CandidateLink,
  Decision,
  GateDetail,
  RedFlagDetail,
  SkillMatch,
} from "@/lib/resume-candidates";

// Maps `resume_review` rows (populated by the n8n screening workflow) onto the
// Candidate / CandidateDetail shapes the dashboard + detail view render. The
// rich nested detail is read from `audit_json` (the clean original model output)
// with column fallbacks; column casing matches Postgres exactly.

export type ResumeReviewRow = {
  id: string;
  project_id: string | null;
  department: string | null;
  archived: boolean | null;
  // Joined from job_postings via job_posting_id (role lives on the posting now
  // that job_title was dropped from resume_review).
  posting: { role: string | null; role_title: string | null } | null;
  First_Name: string | null;
  Last_Name: string | null;
  Email_Address: string | null;
  Phone_Number: number | string | null;
  City: string | null;
  State: string | null;
  Country: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  huggingface_url: string | null;
  portfolio_or_website_url: string | null;
  other_links: unknown;
  fit_score: number | null;
  decision: string | null;
  recommendation_confidence: string | null;
  requires_human_review: boolean | null;
  one_line_summary: string | null;
  required_coverage_pct: number | null;
  overall_gate_status: string | null;
  score_required_skills: number | null;
  score_experience_depth: number | null;
  score_domain_relevance: number | null;
  relevant_years: number | null;
  total_years_professional: number | null;
  required_skills: unknown;
  red_flags: unknown;
  key_concerns: unknown;
  human_review_reason: string | null;
  audit_json: unknown;
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

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v : undefined;
}
function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// The model sometimes returns a bare host (e.g. "autom8x.ai") with no scheme;
// without one the browser treats href as a relative path (→ 404). Force https.
function ensureUrl(u: string): string {
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}
// A short, readable label for an arbitrary link (its hostname, sans www).
function hostLabel(u: string): string {
  try {
    return new URL(ensureUrl(u)).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

// jsonb arrays may hold plain strings or objects ({skill}, {reason}, …); coerce
// to a clean string[] so chips / lists render uniformly. Also accepts a single
// string (some columns got flattened by the n8n normalize) → [string].
function toStringList(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value] : [];
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

function toSkillMatches(value: unknown): SkillMatch[] {
  if (!Array.isArray(value)) return [];
  const out: SkillMatch[] = [];
  for (const item of value) {
    const o = asRecord(item);
    const skill = o && asStr(o.skill);
    if (!o || !skill) continue;
    out.push({
      skill,
      match: asStr(o.match) ?? "unknown",
      evidence: asStr(o.evidence),
      confidence: asStr(o.confidence),
    });
  }
  return out;
}

function toGates(value: unknown): GateDetail[] {
  if (!Array.isArray(value)) return [];
  const out: GateDetail[] = [];
  for (const item of value) {
    const o = asRecord(item);
    const gate = o && asStr(o.gate);
    if (!o || !gate) continue;
    out.push({
      gate,
      status: asStr(o.status) ?? "unknown",
      requirement: asStr(o.requirement),
      candidateValue: asStr(o.candidate_value),
      evidence: asStr(o.evidence),
      reasoning: asStr(o.reasoning),
      confidence: asStr(o.confidence),
    });
  }
  return out;
}

function toRedFlags(value: unknown): RedFlagDetail[] {
  if (!Array.isArray(value)) return [];
  const out: RedFlagDetail[] = [];
  for (const item of value) {
    const o = asRecord(item);
    if (!o) continue;
    const type = asStr(o.type);
    const description = asStr(o.description);
    if (!type && !description) continue;
    out.push({
      type: type ?? "other",
      severity: asStr(o.severity) ?? "low",
      description,
      evidence: asStr(o.evidence),
    });
  }
  return out;
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
    // Role comes from the linked job posting (role, or its parsed role_title).
    role: row.posting?.role ?? row.posting?.role_title ?? "",
    company: row.department ?? "",
    appliedAt: isoDay(row.submittedAt ?? row.createdAt),
    fitScore: row.fit_score ?? 0,
    decision: capitalizeDecision(row.decision),
    newThisWeek,
    flagged: Boolean(row.requires_human_review),
    pending,
  };
}

export function mapResumeDetail(row: ResumeReviewRow): CandidateDetail {
  const audit = asRecord(row.audit_json);
  const sk = asRecord(audit?.skills_assessment);
  const exp = asRecord(audit?.experience_analysis);
  const gates = asRecord(audit?.hard_gates);
  const rec = asRecord(audit?.recommendation);
  const cand = asRecord(audit?.candidate);
  const comp = asRecord(audit?.compensation_analysis);

  const location = [row.City, row.State, row.Country].filter(Boolean).join(", ");

  const subScores = (
    [
      { label: "Skills match", score: row.score_required_skills },
      { label: "Experience", score: row.score_experience_depth },
      { label: "Domain", score: row.score_domain_relevance },
    ] as { label: string; score: number | null }[]
  ).filter((s): s is { label: string; score: number } => s.score != null);

  const links: CandidateLink[] = [
    row.linkedin_url ? { label: "LinkedIn", url: ensureUrl(row.linkedin_url) } : null,
    row.github_url ? { label: "GitHub", url: ensureUrl(row.github_url) } : null,
    row.portfolio_or_website_url
      ? { label: "Website", url: ensureUrl(row.portfolio_or_website_url) }
      : null,
    row.huggingface_url
      ? { label: "Hugging Face", url: ensureUrl(row.huggingface_url) }
      : null,
    ...toStringList(row.other_links).map((u) => ({
      label: hostLabel(u),
      url: ensureUrl(u),
    })),
  ].filter((l): l is CandidateLink => l != null);

  const requiredSkills = toSkillMatches(sk?.required_skills ?? row.required_skills);
  const keyConcerns = toStringList(rec?.key_concerns ?? row.key_concerns);

  const relevantYears = asNum(exp?.relevant_years) ?? row.relevant_years ?? undefined;
  const totalYears =
    asNum(exp?.total_years_professional) ?? row.total_years_professional ?? undefined;
  const yearsForHeader = relevantYears ?? totalYears;

  // Compact "flagged for review" reasons shown at the top.
  const flagReasons = [
    ...keyConcerns,
    ...(asStr(rec?.human_review_reason) ?? row.human_review_reason
      ? [(asStr(rec?.human_review_reason) ?? row.human_review_reason) as string]
      : []),
  ];

  return {
    // Contact
    phone: row.Phone_Number != null ? String(row.Phone_Number) : undefined,
    location: location || undefined,
    links: links.length ? links : undefined,
    // Profile
    yearsExperience: yearsForHeader != null ? Math.round(yearsForHeader) : undefined,
    skills: requiredSkills.map((s) => s.skill),
    // Assessment summary
    summary: asStr(rec?.one_line_summary) ?? row.one_line_summary ?? undefined,
    subScores: subScores.length ? subScores : undefined,
    flagReasons: flagReasons.length ? flagReasons : undefined,
    // Recommendation
    decisionConfidence: asStr(rec?.confidence) ?? row.recommendation_confidence ?? undefined,
    recommendedNextStep: asStr(rec?.recommended_next_step),
    requiresHumanReview: Boolean(row.requires_human_review),
    humanReviewReason: asStr(rec?.human_review_reason) ?? row.human_review_reason ?? undefined,
    keyStrengths: toStringList(rec?.key_strengths),
    keyConcerns,
    interviewFocusAreas: toStringList(rec?.interview_focus_areas),
    // Skills detail
    requiredSkills,
    preferredSkills: toSkillMatches(sk?.preferred_skills),
    transferableSkills: toStringList(sk?.transferable_skills),
    missingCriticalSkills: toStringList(sk?.missing_critical_skills),
    requiredCoveragePct:
      asNum(sk?.required_coverage_pct) ?? row.required_coverage_pct ?? undefined,
    preferredCoveragePct: asNum(sk?.preferred_coverage_pct),
    // Experience detail
    totalYears,
    relevantYears,
    relevantYearsReasoning: asStr(exp?.relevant_years_reasoning),
    seniorityAssessment: asStr(exp?.seniority_assessment),
    seniorityReasoning: asStr(exp?.seniority_reasoning),
    careerTrajectory: asStr(exp?.career_trajectory),
    tenurePattern: asStr(exp?.tenure_pattern),
    domainRelevance: asStr(exp?.domain_relevance),
    domainRelevanceNotes: asStr(exp?.domain_relevance_notes),
    employmentGaps: toStringList(exp?.employment_gaps),
    // Hard gates
    overallGateStatus: asStr(gates?.overall_gate_status) ?? row.overall_gate_status ?? undefined,
    gates: toGates(gates?.gates),
    // Red flags
    redFlags: toRedFlags(audit?.red_flags ?? row.red_flags),
    // Title alignment / compensation
    titleAlignment: asStr(cand?.title_alignment),
    titleAlignmentNotes: asStr(cand?.title_alignment_notes),
    compensationNotes: asStr(comp?.notes),
    // Document
    resumeFileName: row.filename ?? undefined,
  };
}
