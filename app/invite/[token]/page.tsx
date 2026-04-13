import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getInviteByToken } from "@/lib/invites";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await getInviteByToken(token);

  // ── Invalid / unknown token ─────────────────────────────────────────────
  if (!invite) {
    return <InviteShell><InvalidInvite reason="not_found" /></InviteShell>;
  }

  const isRevoked  = Boolean(invite.revokedAt);
  const isAccepted = Boolean(invite.acceptedAt);
  const isExpired  = invite.expiresAt < new Date();

  if (isRevoked || isAccepted || isExpired) {
    const reason = isAccepted ? "accepted" : isRevoked ? "revoked" : "expired";
    return <InviteShell><InvalidInvite reason={reason} /></InviteShell>;
  }

  // ── Auth gate ────────────────────────────────────────────────────────────
  const session = await getAppSession();
  if (!session?.user?.id) {
    // Pass the invite URL as callbackUrl so the user lands back here after login
    const callbackUrl = encodeURIComponent(`/invite/${token}`);
    redirect(`/login?callbackUrl=${callbackUrl}`);
  }

  return (
    <InviteShell>
      <div className="w-full max-w-md">
        <p className="text-sm text-[var(--muted)]">
          You have been invited to join
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--text)]">
          {invite.project.name}
        </h1>
        {invite.project.ownerName ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Created by {invite.project.ownerName}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--muted)]">
          Invite expires{" "}
          {invite.expiresAt.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>

        <AcceptInviteForm token={token} projectId={invite.project.id} />
      </div>
    </InviteShell>
  );
}

// ---------------------------------------------------------------------------
// Shell + error states (co-located, small)
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
    body: "This invite link expired after 24 hours. Ask the project owner to send a new one.",
  },
  accepted: {
    title: "Invite already used",
    body: "This invite link has already been accepted. Each invite can only be used once.",
  },
  revoked: {
    title: "Invite revoked",
    body: "This invite has been revoked by the project owner.",
  },
};

function InvalidInvite({ reason }: { reason: string }) {
  const copy = REASON_COPY[reason] ?? REASON_COPY.not_found;
  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-8 text-center">
      <p className="text-4xl">🔒</p>
      <h1 className="mt-4 text-xl font-semibold text-[var(--text)]">{copy.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{copy.body}</p>
      <a
        href="/account/projects"
        className="mt-6 inline-flex btn-secondary px-5"
      >
        Back to projects
      </a>
    </div>
  );
}
