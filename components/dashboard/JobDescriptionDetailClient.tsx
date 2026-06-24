"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Job-description detail viewer (full page, not a modal). Shows the JD PDF via
// the signed-URL redirect route, then the full parsed job_postings schema below.
// The parsed columns are filled asynchronously by the JD n8n workflow, so the
// row is fetched fresh on mount and re-polled while parse_status='pending'.

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
  archived: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

const SELECT_COLS =
  "id, role, department, jd_filename, recruiter_email, parse_status, parsed_at, version, quality, quality_notes, role_title, seniority_level, min_years_experience, location_type, location_or_timezone_constraint, compensation_listed, compensation_range, hard_requirements, preferred_requirements, key_responsibilities, archived, created_at, updated_at";

export function JobDescriptionDetailClient({
  postingId,
  projectId,
}: {
  postingId: string;
  projectId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [row, setRow] = useState<JobPostingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  async function archivePosting() {
    if (
      !window.confirm(
        "Archive this position? It will be removed from the active dashboard along with its candidates. You can reopen it from Archived roles.",
      )
    ) {
      return;
    }
    setArchiving(true);
    try {
      const res = await fetch("/api/job-descriptions/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postingId, archived: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not archive this position.");
        return;
      }
      router.push(`/account/projects/${projectId}`);
      router.refresh();
    } catch {
      setError("Network error while archiving.");
    } finally {
      setArchiving(false);
    }
  }

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load(initial: boolean) {
      if (initial) setLoading(true);
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
      if (detail.parse_status === "pending") {
        timer = setTimeout(() => load(false), 4000);
      }
    }

    load(true);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [postingId, supabase]);

  const fileUrl = `/api/job-descriptions/file?postingId=${encodeURIComponent(postingId)}`;

  return (
    <div className="flex flex-col gap-6">
      {/* JD PDF */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {row?.role
              ? `${row.role}${row.department ? ` · ${row.department}` : ""}`
              : "Job description"}
          </h3>
          <div className="flex items-center gap-2">
            {row?.archived ? (
              <span className="inline-flex items-center rounded-full border border-[var(--ring)] bg-[var(--surface-strong)] px-2.5 py-1 text-xs text-[var(--muted)]">
                Archived
              </span>
            ) : (
              <button
                type="button"
                onClick={archivePosting}
                disabled={archiving || loading}
                className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
              >
                {archiving ? "Archiving…" : "Archive position"}
              </button>
            )}
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-flex !min-h-0 !px-3 !py-1.5 text-xs"
            >
              Open in new tab
            </a>
          </div>
        </div>
        <iframe
          src={fileUrl}
          title="Job description PDF"
          className="w-full min-h-[600px] h-[80vh] rounded-lg border border-[var(--ring)]/50"
        />
      </div>

      {/* Parsed schema */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text)]">Parsed details</h3>
        {loading ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
        ) : error ? (
          <p className="mt-2 text-sm text-[var(--error-text)]">{error}</p>
        ) : row ? (
          <ParsedTable row={row} />
        ) : null}
      </div>
    </div>
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
