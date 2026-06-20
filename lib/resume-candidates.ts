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
export type CandidateEducation = { degree: string; school: string };
/** A 0–100 screening sub-score (e.g. Skills match) — feeds BreakdownList. */
export type CandidateSubScore = { label: string; score: number };

export type CandidateDetail = {
  // Contact
  phone?: string;
  location?: string;
  links?: CandidateLink[];
  // Profile
  title?: string;
  currentEmployer?: string;
  yearsExperience?: number;
  education?: CandidateEducation[];
  skills?: string[];
  // Assessment
  summary?: string;
  subScores?: CandidateSubScore[];
  flagReasons?: string[];
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
