"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createInviteAction,
  revokeInviteAction,
} from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";

// ---------------------------------------------------------------------------
// Types (inlined — keep this component self-contained)
// ---------------------------------------------------------------------------

type PendingInvite = {
  id: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
};

type Member = {
  id: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string | null; email: string };
};

type Props = {
  projectId: string;
  initialPendingInvites: PendingInvite[];
  initialMembers: Member[];
};

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function InviteSection({
  projectId,
  initialPendingInvites,
  initialMembers,
}: Props) {
  const [pendingInvites, setPendingInvites] = useState(initialPendingInvites);
  const [members] = useState(initialMembers);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleInviteCreated(invite: { id: string; token: string; expiresAt: Date; createdAt: Date }) {
    setPendingInvites((prev) => [invite, ...prev]);
  }

  function handleRevoked(inviteId: string) {
    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
  }

  return (
    <div className="space-y-8">
      {/* ── Members ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Team members
          </h3>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex px-4 py-1.5 text-sm"
          >
            Add team members
          </button>
        </div>

        {members.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">
            No members yet. Generate an invite link to bring someone on board.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--ring)]">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--text)]">
                    {m.user.name || m.user.email}
                  </p>
                  {m.user.name ? (
                    <p className="truncate text-xs text-[var(--muted)]">
                      {m.user.email}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium capitalize text-[var(--chip-text)]">
                  {m.role === "project_user" ? "member" : m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Pending invites ───────────────────────────────────────────────── */}
      {pendingInvites.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            Pending invites
          </h3>
          <ul className="mt-3 divide-y divide-[var(--ring)]">
            {pendingInvites.map((inv) => (
              <PendingInviteRow
                key={inv.id}
                invite={inv}
                projectId={projectId}
                onRevoked={handleRevoked}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {/* ── Create invite modal ───────────────────────────────────────────── */}
      {showCreateModal ? (
        <CreateInviteModal
          projectId={projectId}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleInviteCreated}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending invite row
// ---------------------------------------------------------------------------

function PendingInviteRow({
  invite,
  projectId,
  onRevoked,
}: {
  invite: PendingInvite;
  projectId: string;
  onRevoked: (id: string) => void;
}) {
  const [revoking, setRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    if (!confirm("Revoke this invite? The link will stop working immediately.")) return;
    setRevoking(true);
    setError(null);
    const result = await revokeInviteAction(invite.id);
    setRevoking(false);
    if (result.ok) {
      onRevoked(invite.id);
    } else {
      setError(result.error);
    }
  }

  const expiresLabel = invite.expiresAt.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-mono text-xs text-[var(--text)]">
          …{invite.token.slice(-8)}
        </p>
        <p className="text-xs text-[var(--muted)]">Expires {expiresLabel}</p>
        {error ? (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleRevoke}
        disabled={revoking}
        className="shrink-0 text-xs text-red-600 underline hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
      >
        {revoking ? "Revoking…" : "Revoke"}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Create invite modal
// ---------------------------------------------------------------------------

type NewInvite = {
  token: string;
  code: string;
  expiresAt: Date;
};

function CreateInviteModal({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string;
  onClose: () => void;
  onCreated: (inv: { id: string; token: string; expiresAt: Date; createdAt: Date }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [invite, setInvite] = useState<NewInvite | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const router = useRouter();

  const inviteUrl = invite
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${invite.token}`
    : "";

  async function generate() {
    setLoading(true);
    setError(null);
    const result = await createInviteAction(projectId);
    setLoading(false);
    if (result.ok) {
      setInvite(result);
      onCreated({ id: result.id, token: result.token, expiresAt: result.expiresAt, createdAt: new Date() });
    } else {
      setError(result.error);
    }
  }

  async function copy(text: string, which: "url" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      if (which === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // clipboard unavailable — silent fail, user can select manually
    }
  }

  function handleClose() {
    if (invite) {
      router.refresh(); // re-fetch server data to show new invite in pending list
    }
    onClose();
  }

  return (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="invite-modal-title"
      bubble
      zIndex={100}
    >
        <h3 id="invite-modal-title" className="text-lg font-semibold text-[var(--text)]">Add team members</h3>

        {!invite ? (
          <>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Generate a unique invite link and code. Send both to the person you want to invite.
              The invite expires after 24 hours and can only be used once.
            </p>
            {error ? (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="btn-primary mt-5 inline-flex w-full justify-center px-5"
            >
              {loading ? "Generating…" : "Generate invite"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Share both the link <strong>and</strong> the code with your invitee. Both are
              required to join. This code is shown once — copy it now.
            </p>

            {/* Invite URL */}
            <div className="mt-5">
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">Invite link</p>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--bg)] px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--text)]">
                  {inviteUrl}
                </span>
                <button
                  type="button"
                  onClick={() => copy(inviteUrl, "url")}
                  className="btn-secondary shrink-0 px-2.5 py-1 text-xs"
                >
                  {copiedUrl ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            {/* Short code */}
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-[var(--muted)]">Invite code</p>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--bg)] px-3 py-2">
                <span className="min-w-0 flex-1 font-mono text-2xl tracking-[0.35em] text-[var(--text)]">
                  {invite.code}
                </span>
                <button
                  type="button"
                  onClick={() => copy(invite.code, "code")}
                  className="btn-secondary shrink-0 px-2.5 py-1 text-xs"
                >
                  {copiedCode ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <p className="mt-3 text-xs text-[var(--muted)]">
              Expires{" "}
              {invite.expiresAt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              . Single-use — burned when accepted.
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="btn-primary mt-5 inline-flex w-full justify-center px-5"
            >
              Done
            </button>
          </>
        )}
    </Modal>
  );
}
