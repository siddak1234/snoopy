"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectMemberRole } from "@prisma/client";
import { addMemberToProjectAction } from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AvailableMember = {
  userId: string;
  name: string | null;
  email: string;
};

type Props = {
  projectId: string;
  availableMembers: AvailableMember[];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectMemberPicker({ projectId, availableMembers: initial }: Props) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<AvailableMember[]>(initial);
  // role selection per userId, default "member"
  const [roleMap, setRoleMap] = useState<Record<string, ProjectMemberRole>>({});
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  function getRole(userId: string): ProjectMemberRole {
    return roleMap[userId] ?? "member";
  }

  async function handleAdd(userId: string) {
    if (addingUserId) return; // one at a time
    const role = getRole(userId);
    setAddingUserId(userId);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });

    const result = await addMemberToProjectAction(projectId, userId, role);
    setAddingUserId(null);

    if (result.ok) {
      // Optimistically remove from available list; router.refresh() syncs server
      setAvailable((prev) => prev.filter((m) => m.userId !== userId));
      router.refresh();
    } else {
      setErrors((prev) => ({ ...prev, [userId]: result.error }));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary inline-flex px-4 py-1.5 text-sm"
      >
        Add team members
      </button>

      {open ? (
        <Modal
          onClose={() => setOpen(false)}
          ariaLabelledBy="member-picker-title"
          bubble
          zIndex={100}
        >
          <h3
            id="member-picker-title"
            className="text-lg font-semibold text-[var(--text)]"
          >
            Add team members
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Select workspace members to add to this project.
          </p>

          {available.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              All workspace members are already in this project.
            </p>
          ) : (
            <ul className="mt-4 max-h-80 divide-y divide-[var(--ring)] overflow-y-auto">
              {available.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 py-3">
                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text)]">
                      {m.name || m.email}
                    </p>
                    {m.name ? (
                      <p className="truncate text-xs text-[var(--muted)]">
                        {m.email}
                      </p>
                    ) : null}
                    {errors[m.userId] ? (
                      <p className="text-xs text-red-600 dark:text-red-400" role="alert">
                        {errors[m.userId]}
                      </p>
                    ) : null}
                  </div>

                  {/* Role dropdown */}
                  <select
                    value={getRole(m.userId)}
                    onChange={(e) =>
                      setRoleMap((prev) => ({
                        ...prev,
                        [m.userId]: e.target.value as ProjectMemberRole,
                      }))
                    }
                    disabled={!!addingUserId}
                    className="shrink-0 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
                    aria-label="Role"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>

                  {/* Add button */}
                  <button
                    type="button"
                    onClick={() => handleAdd(m.userId)}
                    disabled={!!addingUserId}
                    className="btn-primary shrink-0 px-3 py-1 text-xs disabled:opacity-60"
                  >
                    {addingUserId === m.userId ? "Adding…" : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-secondary inline-flex px-5"
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
