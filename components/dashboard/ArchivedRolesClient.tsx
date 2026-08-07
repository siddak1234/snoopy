"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { platformApiJson } from "@/lib/platform-api";

// Lists archived job postings for a project (RLS-gated) like the candidate
// list. Clicking a role opens a modal to reopen it; reopening calls the archive
// API with archived=false, which also un-archives that posting's candidates.

type ArchivedPosting = {
  id: string;
  role: string | null;
  role_title: string | null;
  department: string | null;
  jd_filename: string | null;
  archived_at: string | null;
  version: number | null;
};

export function ArchivedRolesClient({ projectId }: { projectId: string }) {
  const [list, setList] = useState<ArchivedPosting[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArchivedPosting | null>(null);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await platformApiJson<{ items: ArchivedPosting[] }>(
          `/v1/projects/${encodeURIComponent(projectId)}/job-postings?archived=true`,
        );
        if (!active) return;
        setList(response.items);
      } catch {
        if (!active) return;
        setError("Could not load archived roles.");
        setList([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  async function reopen(postingId: string) {
    setReopening(true);
    setError(null);
    try {
      await platformApiJson(
        `/v1/projects/${encodeURIComponent(projectId)}/job-postings/${encodeURIComponent(postingId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived: false }),
        },
      );
      setList((prev) => (prev ?? []).filter((p) => p.id !== postingId));
      setSelected(null);
    } catch {
      setError("Network error while reopening.");
    } finally {
      setReopening(false);
    }
  }

  const title = (p: ArchivedPosting) =>
    p.role_title || p.role || "Untitled role";

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p className="text-sm text-[var(--error-text)]">{error}</p>
      ) : null}

      {list === null ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No archived roles.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface-strong)]"
              >
                <span>
                  <span className="block text-sm font-semibold text-[var(--text)]">
                    {title(p)}
                  </span>
                  <span className="block text-xs text-[var(--muted)]">
                    {p.department ?? "—"}
                    {p.archived_at
                      ? ` · archived ${p.archived_at.slice(0, 10)}`
                      : ""}
                  </span>
                </span>
                <span className="text-xs text-[var(--muted)]">Reopen ›</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <Modal
          onClose={() => setSelected(null)}
          ariaLabelledBy="reopen-role-title"
          bubble
          zIndex={100}
          contentClassName="max-w-md"
        >
          <h2
            id="reopen-role-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            {title(selected)}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {selected.department ?? "—"}
            {selected.archived_at
              ? ` · archived ${selected.archived_at.slice(0, 10)}`
              : ""}
          </p>

          <dl className="mt-4 space-y-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">JD file</dt>
              <dd className="text-[var(--text)]">
                {selected.jd_filename ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--muted)]">Version</dt>
              <dd className="text-[var(--text)]">
                {selected.version != null ? String(selected.version) : "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-[var(--muted)]">
            Reopening restores this role to the active dashboard and un-archives
            its candidates.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reopen(selected.id)}
              disabled={reopening}
              className="btn-primary inline-flex !min-h-0 !px-4 !py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reopening ? "Reopening…" : "Reopen role"}
            </button>
            <Link
              href={`/account/projects/${projectId}/job-description?posting=${selected.id}`}
              className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
            >
              View job description
            </Link>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
