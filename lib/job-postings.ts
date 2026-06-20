/**
 * Resume Reviewer — job posting data model + helpers.
 *
 * ⚠️ MOCK DATA, same story as resume-candidates.ts. A posting defines a
 * (role, department) opening that candidates are uploaded into. The seed below
 * mirrors the two seeded candidate combos in resume-candidates.ts so the
 * dashboard's filter options and aggregates are unchanged until a NEW posting
 * is added.
 *
 * Backend seam: makePosting() returns the row shape a future
 * POST → `job_postings` insert would produce (scoped by project_id). The PDF
 * itself isn't persisted yet — only its file name is kept for display.
 */

export type Posting = {
  id: string;
  /** Job title — drives the ROLE filter. */
  role: string;
  /** Drives the DEPARTMENT filter. Same axis as Candidate.company. */
  department: string;
  /** Mock: uploaded JD file name only; the PDF is not persisted yet. */
  jobDescriptionFileName: string | null;
  /** ISO date "YYYY-MM-DD". */
  createdAt: string;
};

/**
 * Build a newly-created posting (mock/local-state). This is the seam for the
 * future backend: when the real create lands, the POST → `job_postings` insert
 * returns a row of this exact shape.
 */
export function makePosting(input: {
  id: string;
  role: string;
  department: string;
  jobDescriptionFileName: string | null;
  /** ISO date "YYYY-MM-DD" — the creation day. */
  createdAt: string;
}): Posting {
  return {
    id: input.id,
    role: input.role,
    department: input.department,
    jobDescriptionFileName: input.jobDescriptionFileName,
    createdAt: input.createdAt,
  };
}
