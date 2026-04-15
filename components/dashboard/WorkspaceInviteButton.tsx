"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import {
  createWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
} from "@/app/account/workspace-invite-actions";

// Dates are serialized as ISO strings from the server component
type PendingInvite = {
  id: string;
  token: string;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  workspaceId: string;
  initialPendingInvites: PendingInvite[];
};

export function WorkspaceInviteButton({ workspaceId, initialPendingInvites }: Props) {
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<{
    token: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(initialPendingInvites);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createWorkspaceInviteAction(workspaceId);
    setCreating(false);
    if (!result.ok) {
      setCreateError(result.error);
      return;
    }
    const newInvite = {
      id: result.id,
      token: result.token,
      expiresAt: result.expiresAt instanceof Date
        ? result.expiresAt.toISOString()
        : String(result.expiresAt),
      createdAt: new Date().toISOString(),
    };
    setCurrentInvite({
      token: result.token,
      code: result.code,
      expiresAt: newInvite.expiresAt,
    });
    setPendingInvites((prev) => [newInvite, ...prev]);
    setModalOpen(true);
  }

  async function handleRevoke(inviteId: string) {
    setRevoking(inviteId);
    const result = await revokeWorkspaceInviteAction(inviteId);
    setRevoking(null);
    if (result.ok) {
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
    }
  }

  function copyText(text: string, kind: "url" | "code") {
    navigator.clipboard.writeText(text).then(() => {
      if (kind === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    });
  }

  const inviteUrl =
    currentInvite && typeof window !== "undefined"
      ? `${window.location.origin}/org-invite/${currentInvite.token}`
      : "";

  return (
    <div>
      {/* Create invite button */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating}
          className="btn-primary inline-flex px-5 disabled:opacity-60"
        >
          {creating ? "Generating…" : "Invite team member"}
        </button>
        {createError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
        ) : null}
      </div>

      {/* Pending invites list */}
      {pendingInvites.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {pendingInvites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <span className="font-mono text-xs text-[var(--muted)]">
                  {invite.token.slice(0, 8)}…
                </span>
                <span className="ml-2 text-xs text-[var(--muted)]">
                  expires{" "}
                  {new Date(invite.expiresAt).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(invite.id)}
                disabled={revoking === invite.id}
                className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-60"
              >
                {revoking === invite.id ? "Revoking…" : "Revoke"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Invite modal */}
      {modalOpen && currentInvite ? (
        <Modal
          onClose={() => setModalOpen(false)}
          ariaLabelledBy="ws-invite-modal-title"
          bubble
          zIndex={100}
        >
          <h2
            id="ws-invite-modal-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Invite link generated
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Share both the link and code with your team member. The code is shown
            once — save it now.
          </p>

          <div className="mt-6 space-y-4">
            {/* Invite URL */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Invite link
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => copyText(inviteUrl, "url")}
                  className="shrink-0 rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                >
                  {copiedUrl ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Invite code */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
                Invite code
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  readOnly
                  value={currentInvite.code}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-3 py-2 font-mono text-lg font-semibold tracking-[0.3em] text-[var(--text)] focus:outline-none"
                  onFocus={(e) => e.target.select()}
                />
                <button
                  type="button"
                  onClick={() => copyText(currentInvite.code, "code")}
                  className="shrink-0 rounded-full border border-[var(--ring)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                >
                  {copiedCode ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Valid for 7 days. Shown once — the code is not stored in plain text.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn-secondary inline-flex px-5"
            >
              Done
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
