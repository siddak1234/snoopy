/**
 * Resume Reviewer — candidate data model + helpers.
 *
 * ⚠️ MOCK DATA. The `MOCK_CANDIDATES` seed below exists so the dashboard renders
 * the intended layout while the upload/export buttons are stubs. There is NO
 * backend wiring here yet — nothing reads or writes Supabase.
 *
 * When this goes real, replace MOCK_CANDIDATES with a `resume_candidates` table
 * + RLS + RPCs scoped by project_id, exactly like the GL dashboard does for
 * gl_code_allocations (see GlCodeAllocationDashboard.tsx). Keep the types and
 * helpers; only the data source changes.
 */

export type Decision = "Advance" | "Hold" | "Reject";

export type Candidate = {
  id: string;
  name: string;
  email: string;
  /** Drives the ROLE filter. */
  role: string;
  /** Drives the COMPANY / DEPARTMENT filter. */
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
   * Freshly uploaded, not yet scored. While true the candidate shows a neutral
   * "Pending" pill and "—" fit score, counts toward Total + New this week, and
   * is EXCLUDED from the decision breakdown / top list / advance count (so the
   * `decision`/`fitScore` placeholders below are never read). Absent/false for
   * the seeded mock candidates — keeps their aggregates unchanged.
   */
  pending?: boolean;
};

// ---------------------------------------------------------------------------
// Per-candidate DETAIL — the richer profile shown on the candidate detail page
// (the list rows above stay lean). Modeled as a separate record keyed by
// candidate id, the same way the invoice list rows fetch their line-item detail
// by filename: in the real backend this is a `resume_candidate_details` join (or
// extra columns) on `resume_candidates`, loaded only when a candidate is opened.
// Every field is optional so a candidate with no detail degrades to "—".
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
  /** Why the candidate was flagged (shown when Candidate.flagged is true). */
  flagReasons?: string[];
  // Document
  /** Uploaded resume file name — caption for the (placeholder) resume viewer. */
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
 * Build a freshly-uploaded candidate (mock/local-state). It carries no real fit
 * score or decision yet — `pending` marks it so the dashboard excludes it from
 * the decision breakdown / top list until a screening step scores it. The
 * `decision`/`fitScore` here are placeholders that are never read while pending.
 *
 * This is the seam for the future backend: when the real upload lands, the
 * POST → `resume_candidates` insert returns a row of this exact shape.
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
    decision: "Hold", // placeholder — never read while `pending` is true
    newThisWeek: true,
    flagged: false,
    pending: true,
  };
}

// ---------------------------------------------------------------------------
// MOCK seed — 24 candidates for one role/company. Aggregates are intentional:
//   decisions: 5 Advance / 7 Hold / 12 Reject   (matches the mock dashboard)
//   flagged:   9   ·   new this week: 8
//   top 3 by fit score: Rivera 82 (Advance), Osei 74 (Advance), Chen 61 (Hold)
// ---------------------------------------------------------------------------

const ROLE = "Senior Data Engineer";
const COMPANY = "Acme Corp";
const COMPANY_2 = "Globex Inc";

export const MOCK_CANDIDATES: Candidate[] = [
  { id: "c01", name: "A. Rivera",  email: "arivera@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-15", fitScore: 82, decision: "Advance", newThisWeek: true,  flagged: false },
  { id: "c02", name: "M. Osei",    email: "mosei@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-14", fitScore: 74, decision: "Advance", newThisWeek: true,  flagged: false },
  { id: "c03", name: "J. Chen",    email: "jchen@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-16", fitScore: 61, decision: "Hold",    newThisWeek: true,  flagged: true  },
  { id: "c04", name: "R. Singh",   email: "rsingh@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-13", fitScore: 60, decision: "Hold",    newThisWeek: false, flagged: true  },
  { id: "c05", name: "T. Nguyen",  email: "tnguyen@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-16", fitScore: 59, decision: "Advance", newThisWeek: true,  flagged: false },
  { id: "c06", name: "K. Adeyemi", email: "kadeyemi@example.com",  role: ROLE, company: COMPANY, appliedAt: "2026-06-12", fitScore: 57, decision: "Advance", newThisWeek: false, flagged: true  },
  { id: "c07", name: "L. Ferraro", email: "lferraro@example.com",  role: ROLE, company: COMPANY, appliedAt: "2026-06-15", fitScore: 56, decision: "Hold",    newThisWeek: true,  flagged: false },
  { id: "c08", name: "D. Park",    email: "dpark@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-11", fitScore: 54, decision: "Advance", newThisWeek: false, flagged: true  },
  { id: "c09", name: "B. Owens",   email: "bowens@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-15", fitScore: 53, decision: "Hold",    newThisWeek: false, flagged: false },
  { id: "c10", name: "F. Costa",   email: "fcosta@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-10", fitScore: 50, decision: "Hold",    newThisWeek: false, flagged: false },
  { id: "c11", name: "N. Haas",    email: "nhaas@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-14", fitScore: 47, decision: "Hold",    newThisWeek: true,  flagged: true  },
  { id: "c12", name: "G. Ito",     email: "gito@example.com",      role: ROLE, company: COMPANY, appliedAt: "2026-06-09", fitScore: 44, decision: "Hold",    newThisWeek: false, flagged: false },
  { id: "c13", name: "P. Kumar",   email: "pkumar@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-17", fitScore: 41, decision: "Reject",  newThisWeek: true,  flagged: false },
  { id: "c14", name: "O. Diallo",  email: "odiallo@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-08", fitScore: 40, decision: "Reject",  newThisWeek: false, flagged: true  },
  { id: "c15", name: "C. Romero",  email: "cromero@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-13", fitScore: 38, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c16", name: "W. Zhao",    email: "wzhao@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-07", fitScore: 35, decision: "Reject",  newThisWeek: false, flagged: true  },
  { id: "c17", name: "E. Novak",   email: "enovak@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-12", fitScore: 33, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c18", name: "H. Mensah",  email: "hmensah@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-06", fitScore: 30, decision: "Reject",  newThisWeek: false, flagged: true  },
  { id: "c19", name: "V. Popov",   email: "vpopov@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-11", fitScore: 27, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c20", name: "Y. Tanaka",  email: "ytanaka@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-05", fitScore: 24, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c21", name: "Z. Khan",    email: "zkhan@example.com",     role: ROLE, company: COMPANY, appliedAt: "2026-06-10", fitScore: 21, decision: "Reject",  newThisWeek: false, flagged: true  },
  { id: "c22", name: "N. Brandt",  email: "nbrandt@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-17", fitScore: 19, decision: "Reject",  newThisWeek: true,  flagged: false },
  { id: "c23", name: "I. Müller",  email: "imuller@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-04", fitScore: 17, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c24", name: "Q. Abara",   email: "qabara@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-09", fitScore: 15, decision: "Reject",  newThisWeek: false, flagged: false },

  // Second company (Globex Inc) — proves the COMPANY / DEPARTMENT filter
  // re-scopes the whole dashboard. Same role so it appears under the default role.
  // Aggregates: 6 total · 2 Advance / 2 Hold / 2 Reject · 2 flagged · 2 new · top 80/68/58
  { id: "g01", name: "D. Cole",    email: "dcole@example.com",    role: ROLE, company: COMPANY_2, appliedAt: "2026-06-16", fitScore: 80, decision: "Advance", newThisWeek: true,  flagged: false },
  { id: "g02", name: "R. Vance",   email: "rvance@example.com",   role: ROLE, company: COMPANY_2, appliedAt: "2026-06-15", fitScore: 68, decision: "Advance", newThisWeek: false, flagged: false },
  { id: "g03", name: "M. Iqbal",   email: "miqbal@example.com",   role: ROLE, company: COMPANY_2, appliedAt: "2026-06-14", fitScore: 58, decision: "Hold",    newThisWeek: true,  flagged: true  },
  { id: "g04", name: "T. Brooks",  email: "tbrooks@example.com",  role: ROLE, company: COMPANY_2, appliedAt: "2026-06-12", fitScore: 49, decision: "Hold",    newThisWeek: false, flagged: false },
  { id: "g05", name: "L. Fischer", email: "lfischer@example.com", role: ROLE, company: COMPANY_2, appliedAt: "2026-06-11", fitScore: 36, decision: "Reject",  newThisWeek: false, flagged: true  },
  { id: "g06", name: "A. Sato",    email: "asato@example.com",    role: ROLE, company: COMPANY_2, appliedAt: "2026-06-09", fitScore: 22, decision: "Reject",  newThisWeek: false, flagged: false },
];

// ---------------------------------------------------------------------------
// MOCK detail seed — only a few candidates carry a full profile so the detail
// page shows both the rich and the graceful-empty ("—") states. Keyed by id.
// ---------------------------------------------------------------------------

export const CANDIDATE_DETAILS: Record<string, CandidateDetail> = {
  // Strong Advance — full profile, no flags.
  c01: {
    phone: "+1 (415) 555-0142",
    location: "San Francisco, CA",
    links: [
      { label: "LinkedIn", url: "https://linkedin.com/in/arivera" },
      { label: "GitHub", url: "https://github.com/arivera" },
    ],
    title: "Staff Data Engineer",
    currentEmployer: "Northwind Data",
    yearsExperience: 9,
    education: [
      { degree: "M.S. Computer Science", school: "UC Berkeley" },
      { degree: "B.S. Software Engineering", school: "UC San Diego" },
    ],
    skills: ["Python", "Spark", "Airflow", "dbt", "Snowflake", "Kafka", "AWS"],
    summary:
      "Nine years building petabyte-scale pipelines; led a lakehouse migration that cut batch cost ~40%. Strong dbt/Airflow ownership and clear written communication. Recommended to advance to the hiring-manager screen.",
    subScores: [
      { label: "Skills match", score: 88 },
      { label: "Experience", score: 84 },
      { label: "Education", score: 70 },
    ],
    resumeFileName: "a-rivera-resume.pdf",
  },
  // Hold — flagged, so flagReasons render.
  c03: {
    phone: "+1 (206) 555-0199",
    location: "Seattle, WA",
    links: [{ label: "LinkedIn", url: "https://linkedin.com/in/jchen" }],
    title: "Data Engineer",
    currentEmployer: "Cascade Analytics",
    yearsExperience: 4,
    education: [{ degree: "B.S. Statistics", school: "University of Washington" }],
    skills: ["Python", "SQL", "dbt", "BigQuery"],
    summary:
      "Solid mid-level engineer with good SQL/dbt fundamentals. Held for review: a one-year employment gap and a stack only partially overlapping the role's Spark/Kafka requirements.",
    subScores: [
      { label: "Skills match", score: 62 },
      { label: "Experience", score: 55 },
      { label: "Education", score: 66 },
    ],
    flagReasons: [
      "Employment gap (Apr 2024 – Mar 2025) not explained",
      "Missing required experience: streaming (Kafka)",
    ],
    resumeFileName: "j-chen-resume.pdf",
  },
  // Globex Advance — full profile.
  g01: {
    phone: "+44 20 7946 0123",
    location: "London, UK",
    links: [{ label: "Portfolio", url: "https://dcole.dev" }],
    title: "Senior Data Engineer",
    currentEmployer: "Globex Inc",
    yearsExperience: 7,
    education: [{ degree: "B.Eng. Computer Systems", school: "Imperial College London" }],
    skills: ["Scala", "Spark", "Kafka", "Databricks", "Terraform", "GCP"],
    summary:
      "Internal transfer candidate with deep Spark/Kafka expertise and infra-as-code fluency. Top of the Globex pool by fit score; recommended to advance.",
    subScores: [
      { label: "Skills match", score: 86 },
      { label: "Experience", score: 80 },
      { label: "Education", score: 72 },
    ],
    resumeFileName: "d-cole-resume.pdf",
  },
};

/** Find a seeded candidate's summary row by id (null if unknown/not persisted). */
export function findCandidateById(id: string): Candidate | null {
  return MOCK_CANDIDATES.find((c) => c.id === id) ?? null;
}

/** Load a candidate's detail profile by id (null when none was seeded). */
export function getCandidateDetail(id: string): CandidateDetail | null {
  return CANDIDATE_DETAILS[id] ?? null;
}
