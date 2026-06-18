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

// ---------------------------------------------------------------------------
// MOCK seed — 24 candidates for one role/company. Aggregates are intentional:
//   decisions: 5 Advance / 7 Hold / 12 Reject   (matches the mock dashboard)
//   flagged:   9   ·   new this week: 8
//   top 3 by fit score: Rivera 82 (Advance), Osei 74 (Advance), Chen 61 (Hold)
// ---------------------------------------------------------------------------

const ROLE = "Senior Data Engineer";
const COMPANY = "Acme Corp";

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
  { id: "c22", name: "S. Bhatia",  email: "siddak1234@gmail.com",  role: ROLE, company: COMPANY, appliedAt: "2026-06-17", fitScore: 19, decision: "Reject",  newThisWeek: true,  flagged: false },
  { id: "c23", name: "I. Müller",  email: "imuller@example.com",   role: ROLE, company: COMPANY, appliedAt: "2026-06-04", fitScore: 17, decision: "Reject",  newThisWeek: false, flagged: false },
  { id: "c24", name: "Q. Abara",   email: "qabara@example.com",    role: ROLE, company: COMPANY, appliedAt: "2026-06-09", fitScore: 15, decision: "Reject",  newThisWeek: false, flagged: false },
];
