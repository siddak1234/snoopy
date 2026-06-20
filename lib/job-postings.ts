/**
 * Resume Reviewer — job posting types + helpers.
 *
 * A posting is one (role, department) opening per project, with an uploaded
 * job-description PDF. Persisted in the `job_postings` table (via
 * /api/job-descriptions/upload). The dashboard reads rows and maps them to the
 * `Posting` UI shape; `makePosting()` builds an optimistic row on create.
 */

export type Posting = {
  id: string;
  /** Job title — drives the ROLE filter. */
  role: string;
  /** Drives the DEPARTMENT filter. Same axis as Candidate.company. */
  department: string;
  /** Original JD file name (display). */
  jobDescriptionFileName: string | null;
  /** ISO date "YYYY-MM-DD". */
  createdAt: string;
};

/** A `job_postings` row (only the columns the UI reads). */
export type JobPostingRow = {
  id: string;
  project_id: string | null;
  role: string | null;
  department: string | null;
  jd_object_name: string | null;
  jd_filename: string | null;
  recruiter_email: string | null;
  created_at: string | null;
};

export function mapJobPostingRow(row: JobPostingRow): Posting {
  return {
    id: row.id,
    role: row.role ?? "",
    department: row.department ?? "",
    jobDescriptionFileName: row.jd_filename,
    createdAt: (row.created_at ?? "").slice(0, 10),
  };
}

/** Build an optimistic posting for the dashboard list right after creation. */
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
