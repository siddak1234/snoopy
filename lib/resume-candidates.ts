/**
 * Resume Reviewer — candidate types + presentational helpers.
 *
 * Data now comes from the `resume_review` table, mapped in
 * lib/resume-candidates-data.ts. This module holds only the UI-facing types
 * (Candidate, CandidateDetail, Decision), the decision color/order constants,
 * and small pure helpers shared by the dashboard + detail view.
 */

export type Decision = "Advance" | "Hold" | "Reject";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  /** Drives the ROLE filter. */
  role: string;
  /** Drives the DEPARTMENT filter. */
  company: string;
  /** ISO date "YYYY-MM-DD". */
  appliedAt: string;
  /** 0–100 fit score. */
  fitScore: number;
  decision: Decision;
  /** Counts toward "new this week". */
  newThisWeek: boolean;
  /** Counts toward "Needs review" — flagged by screening gates. */
  flagged: boolean;
  /**
   * Concise reasons behind the flag (key concerns + human-review reason), shown
   * on the Needs Review list. Empty/undefined when not flagged.
   */
  flagReasons?: string[];
  /**
   * Uploaded but not yet screened (no decision yet). While true the candidate
   * shows a neutral "Pending" pill and "—" fit score, counts toward Total + New
   * this week, and is EXCLUDED from the decision breakdown / top list / advance
   * count (so the `decision`/`fitScore` placeholders are never read).
   */
  pending?: boolean;
};

// ---------------------------------------------------------------------------
// Per-candidate DETAIL — the richer profile shown on the candidate detail page.
// ---------------------------------------------------------------------------

export type CandidateLink = { label: string; url: string };
/** A 0–100 screening sub-score (e.g. Skills match) — feeds BreakdownList. */
export type CandidateSubScore = { label: string; score: number };

/** A single required/preferred skill judged against the JD. */
export type SkillMatch = {
  skill: string;
  /** strong | partial | none | unknown */
  match: string;
  evidence?: string;
  confidence?: string;
};
/** A hard-gate evaluation (location_timezone | years_of_experience). */
export type GateDetail = {
  gate: string;
  /** pass | fail | unknown | needs_review | not_specified */
  status: string;
  requirement?: string;
  candidateValue?: string;
  evidence?: string;
  reasoning?: string;
  confidence?: string;
};
/** A screening red flag. */
export type RedFlagDetail = {
  type: string;
  severity: string;
  description?: string;
  evidence?: string;
};

export type CandidateDetail = {
  // Contact
  phone?: string;
  location?: string;
  address?: string;
  links?: CandidateLink[];
  // Candidate-attested / EEO (present in resume_review; null until a form fills
  // them — the current JD+resume automation does not populate these).
  workAuthorization?: string;
  sponsorship?: string;
  willingToRelocate?: string;
  earliestStart?: string;
  salaryExpectation?: string;
  gender?: string;
  hispanic?: string;
  ethnicity?: string;
  veteran?: string;
  disability?: string;
  // Profile
  yearsExperience?: number;
  skills?: string[];
  // Assessment (summary)
  summary?: string;
  subScores?: CandidateSubScore[];
  flagReasons?: string[];
  // Recommendation
  decisionConfidence?: string;
  recommendedNextStep?: string;
  requiresHumanReview?: boolean;
  humanReviewReason?: string;
  keyStrengths?: string[];
  keyConcerns?: string[];
  interviewFocusAreas?: string[];
  // Skills detail
  requiredSkills?: SkillMatch[];
  preferredSkills?: SkillMatch[];
  transferableSkills?: string[];
  missingCriticalSkills?: string[];
  requiredCoveragePct?: number;
  preferredCoveragePct?: number;
  // Experience detail
  totalYears?: number;
  relevantYears?: number;
  relevantYearsReasoning?: string;
  seniorityAssessment?: string;
  seniorityReasoning?: string;
  careerTrajectory?: string;
  tenurePattern?: string;
  domainRelevance?: string;
  domainRelevanceNotes?: string;
  employmentGaps?: string[];
  // Hard gates
  overallGateStatus?: string;
  gates?: GateDetail[];
  // Red flags
  redFlags?: RedFlagDetail[];
  // Title alignment / compensation
  titleAlignment?: string;
  titleAlignmentNotes?: string;
  compensationNotes?: string;
  // Document
  resumeFileName?: string;
};

// Display order for the decision breakdown + the canonical color per outcome.
export const DECISION_ORDER: Decision[] = ["Advance", "Hold", "Reject"];

// Bar / accent color per decision (CSS tokens — auto light/dark).
export const DECISION_BAR_COLOR: Record<Decision, string> = {
  Advance: "var(--success-text)",
  Hold: "var(--warning-text)",
  Reject: "var(--error-text)",
};

// Tailwind text-color class per decision, for the fit-score in the ranked list.
export const DECISION_TEXT_CLASS: Record<Decision, string> = {
  Advance: "text-[var(--success-text)]",
  Hold: "text-[var(--warning-text)]",
  Reject: "text-[var(--error-text)]",
};

/** Two-letter initials from a display name ("S. Bhatia" → "SB"). */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z]/g, "").charAt(0))
    .filter(Boolean);
  const first = letters[0] ?? "";
  const last = letters.length > 1 ? letters[letters.length - 1] : "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Build an optimistic, not-yet-screened candidate for the dashboard list after
 * an upload — `id` is the candidate_id the upload route returned, so the real
 * `resume_review` row (inserted by n8n with the same id) reconciles with it on
 * the next fetch. `decision`/`fitScore` are placeholders, never read while
 * `pending` is true.
 */
export function makePendingCandidate(input: {
  id: string;
  name: string;
  role: string;
  company: string;
  /** ISO date "YYYY-MM-DD" — the upload day. */
  appliedAt: string;
}): Candidate {
  return {
    id: input.id,
    name: input.name,
    email: "",
    role: input.role,
    company: input.company,
    appliedAt: input.appliedAt,
    fitScore: 0,
    decision: "Hold",
    newThisWeek: true,
    flagged: false,
    pending: true,
  };
}
