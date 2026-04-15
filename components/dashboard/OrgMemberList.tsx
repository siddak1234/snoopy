"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { removeWorkspaceMemberAction } from "@/app/account/organization/actions";
import Modal from "@/components/ui/Modal";
import { formatDateMediumUTC } from "@/lib/date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OrgMember = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: "OWNER" | "MEMBER";
  /** ISO string */
  joinedAt: string;
};

type Props = {
  workspaceId: string;
  orgName: string;
  viewerUserId: string;
  members: OrgMember[];
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function OrgMemberList({ workspaceId, orgName, viewerUserId, members: initial }: Props) {
  const [members, setMembers] = useState(initial);
  const [confirmTarget, setConfirmTarget] = useState<OrgMember | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const router = useRouter();

  function openConfirm(member: OrgMember) {
    setRemoveError(null);
    setConfirmTarget(member);
  }

  function closeConfirm() {
    if (removing) return;
    setConfirmTarget(null);
    setRemoveError(null);
  }

  async function handleConfirmRemove() {
    if (!confirmTarget || removing) return;
    setRemoving(true);
    setRemoveError(null);

    const result = await removeWorkspaceMemberAction(workspaceId, confirmTarget.userId);
    setRemoving(false);

    if (result.ok) {
      setMembers((prev) => prev.filter((m) => m.userId !== confirmTarget.userId));
      setConfirmTarget(null);
      router.refresh();
    } else {
      setRemoveError(result.error);
    }
  }

  const displayName = (m: OrgMember) => m.name || m.email;

  return (
    <>
      <ul className="mt-3 divide-y divide-[var(--ring)]">
        {members.map((m) => {
          const isOwner = m.role === "OWNER";
          const isSelf = m.userId === viewerUserId;
          const canRemove = !isOwner && !isSelf;

          return (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              {/* Identity */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text)]">
                  {displayName(m)}
                  {isSelf ? (
                    <span className="ml-1.5 text-xs text-[var(--muted)]">(you)</span>
                  ) : null}
                </p>
                {m.name ? (
                  <p className="truncate text-xs text-[var(--muted)]">{m.email}</p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  Joined {formatDateMediumUTC(m.joinedAt)}
                </p>
              </div>

              {/* Role badge */}
              <span className="shrink-0 rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--chip-text)]">
                {isOwner ? "Owner" : "Member"}
              </span>

              {/* Remove button */}
              {canRemove ? (
                <button
                  type="button"
                  onClick={() => openConfirm(m)}
                  className="shrink-0 text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  Remove
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* Confirmation modal */}
      {confirmTarget ? (
        <Modal
          onClose={closeConfirm}
          ariaLabelledBy="org-remove-title"
          ariaDescribedBy="org-remove-desc"
          bubble
          zIndex={100}
        >
          <h2
            id="org-remove-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Remove {displayName(confirmTarget)}?
          </h2>
          <p id="org-remove-desc" className="mt-2 text-sm text-[var(--muted)]">
            <strong className="text-[var(--text)]">{displayName(confirmTarget)}</strong> will
            be removed from <strong className="text-[var(--text)]">{orgName}</strong> and
            from all projects in this organization. This cannot be undone.
          </p>

          {removeError ? (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
              {removeError}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirmRemove}
              disabled={removing}
              className="btn-primary inline-flex px-5 disabled:opacity-60"
            >
              {removing ? "Removing…" : "Remove member"}
            </button>
            <button
              type="button"
              onClick={closeConfirm}
              disabled={removing}
              className="btn-secondary inline-flex px-5"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
