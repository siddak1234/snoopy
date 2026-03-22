"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkflowListItem } from "@/app/account/workflows/actions";
import { deleteWorkflowAction } from "@/app/account/workflows/actions";
import Modal from "@/components/ui/Modal";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const statusColors: Record<string, string> = {
  draft:
    "border-[var(--ring)] bg-[var(--step-pill-bg)] text-[var(--step-pill-text)]",
  active: "border-emerald-400/40 bg-emerald-500/10 text-emerald-400",
  archived: "border-[var(--ring)] bg-[var(--surface)] text-[var(--muted)]",
};

export function WorkflowCardsClient({ workflows }: { workflows: WorkflowListItem[] }) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<WorkflowListItem | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const canDelete = useMemo(() => confirmText.trim().toUpperCase() === "DELETE", [confirmText]);

  async function confirmDelete() {
    if (!deleteTarget || !canDelete || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteWorkflowAction(deleteTarget.id);
      if (!result.ok) {
        setDeleteError(result.error);
        setDeleting(false);
        return;
      }
      setDeleteTarget(null);
      setConfirmText("");
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleteError("Failed to delete workflow.");
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="group relative flex flex-col gap-3 rounded-xl border border-[var(--ring)] bg-[var(--card)] p-4 transition hover:border-[var(--accent)] hover:shadow-md"
          >
            <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={() => {}}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/70 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
                aria-label={`Send workflow ${wf.name}`}
                title="Send workflow"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M14.5 1.5 7.3 8.7" />
                  <path d="m14.5 1.5-4 13L7.3 8.7.5 5.5z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setConfirmText("");
                  setDeleteTarget(wf);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/70 text-[var(--muted)] transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-400"
                aria-label={`Delete workflow ${wf.name}`}
                title="Delete"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4M6.667 7.333v4M9.333 7.333v4" />
                  <path d="M3.333 4l.667 9.333a1.333 1.333 0 0 0 1.333 1.334h5.334a1.333 1.333 0 0 0 1.333-1.334L12.667 4" />
                </svg>
              </button>
            </div>

            <Link href={`/automation-builder?id=${wf.id}`} className="block">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--accent)]">
                  {wf.name}
                </h3>
              </div>

              <div className="mt-3 flex items-center gap-3 text-[0.65rem] text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    className="h-3 w-3"
                  >
                    <rect x="3" y="3" width="10" height="10" rx="2" />
                  </svg>
                  {wf.nodeCount} {wf.nodeCount === 1 ? "node" : "nodes"}
                </span>
                <span>Updated {formatRelative(wf.updatedAt)}</span>
              </div>

              <div className="mt-3 flex items-center gap-1 text-[0.6rem] font-medium text-[var(--accent)] opacity-0 transition group-hover:opacity-100">
                Open in builder
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3"
                >
                  <path d="M3.333 8h9.334M8.667 4l4 4-4 4" />
                </svg>
              </div>
            </Link>

            <span
              className={`absolute bottom-3 right-3 shrink-0 rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${statusColors[wf.status] ?? statusColors.draft}`}
            >
              {wf.status}
            </span>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <Modal
          onClose={() => {
            // Keep close behavior explicit via Cancel while preventing close during delete.
            if (deleting) return;
          }}
          ariaLabelledBy="workflow-delete-title"
          bubble
          zIndex={100}
          contentClassName="w-96 max-w-[calc(100vw-2rem)] p-6 sm:p-6"
        >
          <div>
            <p id="workflow-delete-title" className="text-center text-sm font-semibold text-[var(--text)]">
              Delete workflow?
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-[var(--muted)]">
              This will permanently delete <span className="font-semibold text-[var(--text)]">{deleteTarget.name}</span>.
              To confirm, type <span className="font-semibold text-[var(--text)]">DELETE</span>.
            </p>

            <input
              type="text"
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmDelete();
              }}
              placeholder="Type DELETE"
              className="mt-4 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]/50 outline-none transition focus:ring-2 focus:ring-red-400/50"
            />

            {deleteError ? (
              <p className="mt-2 text-center text-xs text-red-400">{deleteError}</p>
            ) : null}

            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => {
                  setDeleteTarget(null);
                  setConfirmText("");
                  setDeleteError("");
                }}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={!canDelete || deleting}
                className="flex-1 cursor-pointer rounded-full border border-red-400/60 bg-red-500/15 px-4 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:pointer-events-none disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
