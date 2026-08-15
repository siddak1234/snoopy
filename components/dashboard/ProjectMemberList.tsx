"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormError } from "@/components/ui/FormError";
import type { ProjectRole } from "@/lib/tenancy";
import {
  changeMemberRoleAction,
  removeMemberFromProjectAction,
  leaveProjectAction,
} from "@/app/account/projects/actions";
import { formatDateMediumUTC } from "@/lib/date";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MemberRow = {
  userId: string;
  name: string | null;
  email: string;
  role: ProjectRole;
  /** ISO string — serialized from Date in the server component */
  createdAt: string;
};

type Props = {
  projectId: string;
  viewerUserId: string;
  viewerRole: ProjectRole;
  members: MemberRow[];
  /** Pass "/account/projects" so the viewer is redirected after leaving. */
  leaveRedirect?: string;
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function ProjectMemberList({
  projectId,
  viewerUserId,
  viewerRole,
  members: initialMembers,
  leaveRedirect,
}: Props) {
  const [members, setMembers] = useState(initialMembers);
  const router = useRouter();

  function handleRemoved(userId: string) {
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
    router.refresh();
  }

  function handleRoleChanged(userId: string, newRole: ProjectRole) {
    setMembers((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, role: newRole } : m)),
    );
    router.refresh();
  }

  if (members.length === 0) {
    return <p className="mt-3 text-sm text-[var(--muted)]">No members yet.</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-[var(--ring)]">
      {members.map((m) => (
        <MemberRowItem
          key={m.userId}
          member={m}
          projectId={projectId}
          viewerUserId={viewerUserId}
          viewerRole={viewerRole}
          leaveRedirect={leaveRedirect}
          onRemoved={handleRemoved}
          onRoleChanged={handleRoleChanged}
        />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Individual row
// ---------------------------------------------------------------------------

function MemberRowItem({
  member: m,
  projectId,
  viewerUserId,
  viewerRole,
  leaveRedirect,
  onRemoved,
  onRoleChanged,
}: {
  member: MemberRow;
  projectId: string;
  viewerUserId: string;
  viewerRole: ProjectRole;
  leaveRedirect?: string;
  onRemoved: (userId: string) => void;
  onRoleChanged: (userId: string, newRole: ProjectRole) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const isOwnerRow = m.role === "owner";
  const isOwnRow = m.userId === viewerUserId;

  // This is only a display hint. The public mutation remains authoritative.
  const canManage =
    !isOwnerRow &&
    !isOwnRow &&
    (viewerRole === "owner" || viewerRole === "admin");

  // Role dropdown options available to the viewer for this row
  const showRoleDropdown =
    !isOwnerRow &&
    !isOwnRow &&
    (viewerRole === "owner" || (viewerRole === "admin" && m.role === "member"));

  // Display label for the role badge
  const roleLabel =
    m.role === "owner" ? "Owner" : m.role === "admin" ? "Admin" : "Member";

  async function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newRole = e.target.value as ProjectRole;
    if (newRole === m.role) return; // no-op
    setBusy(true);
    setError(null);
    const result = await changeMemberRoleAction(projectId, m.userId, newRole);
    setBusy(false);
    if (result.ok) {
      onRoleChanged(m.userId, newRole);
    } else {
      setError(result.error);
    }
  }

  async function handleRemove() {
    if (!confirm(`Remove ${m.name || m.email} from this project?`)) return;
    setBusy(true);
    setError(null);
    const result = await removeMemberFromProjectAction(projectId, m.userId);
    setBusy(false);
    if (result.ok) {
      onRemoved(m.userId);
    } else {
      setError(result.error);
    }
  }

  async function handleLeave() {
    if (!confirm("Leave this project? You will lose access immediately."))
      return;
    setBusy(true);
    setError(null);
    const result = await leaveProjectAction(projectId);
    setBusy(false);
    if (result.ok) {
      if (leaveRedirect) router.push(leaveRedirect);
      else router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      {/* Name + email + joined date */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--text)]">
          {m.name || m.email}
          {isOwnRow ? (
            <span className="ml-1.5 text-xs text-[var(--muted)]">(you)</span>
          ) : null}
        </p>
        {m.name ? (
          <p className="truncate text-xs text-[var(--muted)]">{m.email}</p>
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          Joined {formatDateMediumUTC(m.createdAt)}
        </p>
        {error ? <FormError message={error} className="text-xs" /> : null}
      </div>

      {/* Role: badge for owner, dropdown for manageable rows, text for others */}
      {isOwnerRow ? (
        <span className="shrink-0 rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
          Owner
        </span>
      ) : showRoleDropdown ? (
        <select
          value={m.role}
          onChange={handleRoleChange}
          disabled={busy}
          className="shrink-0 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2 py-1 text-xs text-[var(--text)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
          aria-label={`Role for ${m.name || m.email}`}
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      ) : (
        <span className="shrink-0 rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)] capitalize">
          {roleLabel}
        </span>
      )}

      {/* Action buttons */}
      {isOwnerRow ? null : isOwnRow ? (
        <button
          type="button"
          onClick={handleLeave}
          disabled={busy}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none disabled:opacity-60"
        >
          {busy ? "Leaving…" : "Leave"}
        </button>
      ) : canManage ? (
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="shrink-0 text-xs text-[var(--error-text)] underline hover:text-[var(--error-text-hover)] disabled:opacity-60"
        >
          {busy ? "Removing…" : "Remove"}
        </button>
      ) : null}
    </li>
  );
}
