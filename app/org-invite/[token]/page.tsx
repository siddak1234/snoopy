import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { provisionUserFromSupabaseAuth } from "@/lib/auth-supabase";
import { getWorkspaceInviteByToken } from "@/lib/workspace-invites";
import { AcceptOrgInviteForm } from "./AcceptOrgInviteForm";

export const metadata = { title: "Organization Invite — Autom8x" };

// Public page — no auth required to view.
export default async function OrgInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await getWorkspaceInviteByToken(token);

  // ── Invalid / unknown token ─────────────────────────────────────────────
  if (!invite) {
    return (
      <InviteShell>
        <InvalidInvite reason="not_found" />
      </InviteShell>
    );
  }

  const isRevoked = Boolean(invite.revokedAt);
  const isAccepted = Boolean(invite.acceptedAt);
  const isExpired = invite.expiresAt < new Date();

  if (isRevoked || isAccepted || isExpired) {
    const reason = isAccepted ? "accepted" : isRevoked ? "revoked" : "expired";
    return (
      <InviteShell>
        <InvalidInvite reason={reason} />
      </InviteShell>
    );
  }

  // ── Auth check — use direct Supabase auth to avoid workspace creation ───
  let isSignedIn = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id) {
      // Provision app user row (idempotent) without creating a workspace
      await provisionUserFromSupabaseAuth(user);
      isSignedIn = true;
    }
  } catch {
    // Treat as unauthenticated — the form will handle the error
  }

  const callbackUrl = encodeURIComponent(`/org-invite/${token}`);

  return (
    <InviteShell>
      <div className="w-full max-w-md">
        <p className="text-sm text-[var(--muted)]">You have been invited to join</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">
          {invite.workspace.name}
        </h1>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Invite expires{" "}
          {invite.expiresAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        {isSignedIn ? (
          <AcceptOrgInviteForm token={token} />
        ) : (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Sign in to join this organization.
            </p>
            <Link
              href={`/login?callbackUrl=${callbackUrl}`}
              className="btn-primary inline-flex w-full justify-center px-5"
            >
              Sign in to join
            </Link>
          </div>
        )}
      </div>
    </InviteShell>
  );
}

// ---------------------------------------------------------------------------
// Shell + error states
// ---------------------------------------------------------------------------

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      {children}
    </div>
  );
}

const REASON_COPY: Record<string, { title: string; body: string }> = {
  not_found: {
    title: "Invite not found",
    body: "This invite link is invalid. Check the link and try again.",
  },
  expired: {
    title: "Invite expired",
    body: "This invite link expired. Ask the organization owner to send a new one.",
  },
  accepted: {
    title: "Invite already used",
    body: "This invite link has already been accepted. Each invite can only be used once.",
  },
  revoked: {
    title: "Invite revoked",
    body: "This invite has been revoked by the organization owner.",
  },
};

function InvalidInvite({ reason }: { reason: string }) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.not_found;
  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-8 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-4 text-xl font-semibold text-[var(--text)]">{copy.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{copy.body}</p>
      <a href="/account" className="mt-6 inline-flex btn-secondary px-5">
        Back to dashboard
      </a>
    </div>
  );
}
