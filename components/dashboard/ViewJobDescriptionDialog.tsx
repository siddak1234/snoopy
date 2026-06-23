"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

// View-job-description popup. Shows the JD PDF (served via the signed-URL
// redirect route) and, below it, the full parsed schema for the job_postings
// row. The parsed columns are filled asynchronously by the JD n8n workflow, so
// the row is fetched fresh each open and re-polled while parse_status='pending'.

type JobPostingDetail = {
  id: string;
  role: string | null;
  department: string | null;
  jd_filename: string | null;
  recruiter_email: string | null;
  parse_status: string | null;
  parsed_at: string | null;
  version: number | null;
  quality: string | null;
  quality_notes: string | null;
  role_title: string | null;
  seniority_level: string | null;
  min_years_experience: number | null;
  location_type: string | null;
  location_or_timezone_constraint: string | null;
  compensation_listed: boolean | null;
  compensation_range: string | null;
  hard_requirements: string[] | null;
  preferred_requirements: string[] | null;
  key_responsibilities: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLS =
  "id, role, department, jd_filename, recruiter_email, parse_status, parsed_at, version, quality, quality_notes, role_title, seniority_level, min_years_experience, location_type, location_or_timezone_constraint, compensation_listed, compensation_range, hard_requirements, preferred_requirements, key_responsibilities, created_at, updated_at";

export function ViewJobDescriptionDialog({
  open,
  onClose,
  postingId,
}: {
  open: boolean;
  onClose: () => void;
  postingId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<JobPostingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !postingId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(initial: boolean) {
      if (initial) {
        setLoading(true);
        setError(null);
        setRow(null);
      }
      const { data, error } = await supabase
        .from("job_postings")
        .select(SELECT_COLS)
        .eq("id", postingId)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        setError("Could not load this job posting.");
        setLoading(false);
        return;
      }
      const detail = data as JobPostingDetail;
      setRow(detail);
      setLoading(false);
      // Keep polling while the workflow is still parsing.
      if (detail.parse_status === "pending") {
        timer = setTimeout(() => load(false), 4000);
      }
    }

    load(true);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [open, postingId, supabase]);

  if (!open || !postingId) return null;

  const fileUrl = `/api/job-descriptions/file?postingId=${encodeURIComponent(postingId)}`;

  return (
    <Modal
      onClose={onClose}
      ariaLabelledBy="view-jd-title"
      bubble
      zIndex={100}
      contentClassName="max-w-3xl"
    >
      <h2 id="view-jd-title" className="text-xl font-semibold text-[var(--text)]">
        Job description
      </h2>
      {row?.role ? (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {row.role}
          {row.department ? ` · ${row.department}` : ""}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-end">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-xs"
        >
          Open in new tab
        </a>
      </div>
      <iframe
        src={fileUrl}
        title="Job description PDF"
        className="mt-2 w-full min-h-[420px] h-[55vh] rounded-lg border border-[var(--ring)]/50"
      />

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[var(--text)]">Parsed details</h3>
        {loading ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
        ) : error ? (
          <p className="mt-2 text-sm text-[var(--error-text)]">{error}</p>
        ) : row ? (
          <ParsedTable row={row} />
        ) : null}
      </div>
    </Modal>
  );
}

function ParsedTable({ row }: { row: JobPostingDetail }) {
  const status = row.parse_status ?? "pending";
  const date = (s: string | null) => (s ? s.slice(0, 10) : "—");
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-[var(--ring)]">
      <dl className="divide-y divide-[var(--ring)]/60 text-sm">
        <FieldRow label="Parse status" value={<StatusBadge status={status} />} />
        <FieldRow label="JD file" value={row.jd_filename ?? "—"} />
        <FieldRow
          label="Version"
          value={row.version != null ? String(row.version) : "—"}
        />
        <FieldRow label="Parsed at" value={date(row.parsed_at)} />
        <FieldRow label="Recruiter" value={row.recruiter_email ?? "—"} />
        <FieldRow label="Created" value={date(row.created_at)} />
        {status !== "parsed" ? (
          <div className="px-4 py-3 text-sm text-[var(--muted)]">
            {status === "failed"
              ? "Parsing failed. Re-upload the job description to try again."
              : "Job description is being parsed… parsed fields will appear here shortly."}
          </div>
        ) : (
          <>
            <FieldRow label="Quality" value={row.quality ?? "—"} />
            <FieldRow label="Quality notes" value={row.quality_notes ?? "—"} />
            <FieldRow label="Role title" value={row.role_title ?? "—"} />
            <FieldRow label="Seniority" value={row.seniority_level ?? "—"} />
            <FieldRow
              label="Min years experience"
              value={
                row.min_years_experience != null
                  ? String(row.min_years_experience)
                  : "—"
              }
            />
            <FieldRow label="Location type" value={row.location_type ?? "—"} />
            <FieldRow
              label="Location / timezone"
              value={row.location_or_timezone_constraint ?? "—"}
            />
            <FieldRow
              label="Compensation listed"
              value={
                row.compensation_listed == null
                  ? "—"
                  : row.compensation_listed
                    ? "Yes"
                    : "No"
              }
            />
            <FieldRow
              label="Compensation range"
              value={row.compensation_range ?? "—"}
            />
            <ListRow label="Hard requirements" items={row.hard_requirements} />
            <ListRow
              label="Preferred requirements"
              items={row.preferred_requirements}
            />
            <ListRow
              label="Key responsibilities"
              items={row.key_responsibilities}
            />
          </>
        )}
      </dl>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[40%_60%] gap-2 px-4 py-2.5">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="break-words text-[var(--text)]">{value}</dd>
    </div>
  );
}

function ListRow({ label, items }: { label: string; items: string[] | null }) {
  return (
    <div className="grid grid-cols-[40%_60%] gap-2 px-4 py-2.5">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-[var(--text)]">
        {items && items.length ? (
          <ul className="list-disc space-y-1 pl-4">
            {items.map((it, i) => (
              <li key={i}>{typeof it === "string" ? it : JSON.stringify(it)}</li>
            ))}
          </ul>
        ) : (
          "—"
        )}
      </dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "failed"
      ? "text-[var(--error-text)] bg-[var(--error-bg)] border-[var(--error-border)]"
      : "text-[var(--muted)] bg-[var(--surface-strong)] border-[var(--ring)]";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${tone}`}
    >
      {status}
    </span>
  );
}
