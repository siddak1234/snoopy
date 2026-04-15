import Link from "next/link";
import { prisma } from "@/lib/db";

// Public page — no auth required.
export const metadata = { title: "Domain Verification — Autom8x" };

// ---------------------------------------------------------------------------
// State machine — derive outcome from token record
// ---------------------------------------------------------------------------

type VerifyOutcome =
  | { status: "verified"; domain: string }
  | { status: "already_verified" }
  | { status: "expired" }
  | { status: "invalid" };

async function resolveToken(rawToken: string): Promise<VerifyOutcome> {
  const record = await prisma.domainVerificationToken.findUnique({
    where: { token: rawToken },
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      workspaceId: true,
      workspace: { select: { domain: true, domainVerified: true } },
    },
  });

  if (!record) return { status: "invalid" };
  if (record.usedAt || record.workspace.domainVerified) return { status: "already_verified" };
  if (record.expiresAt < new Date()) return { status: "expired" };

  // Valid — atomically verify the domain and burn the token
  await prisma.$transaction([
    prisma.workspace.update({
      where: { id: record.workspaceId },
      data: { domainVerified: true, domainVerifiedAt: new Date() },
    }),
    prisma.domainVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { status: "verified", domain: record.workspace.domain ?? "" };
}

// ---------------------------------------------------------------------------
// Shared card wrapper
// ---------------------------------------------------------------------------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-16">
      <div className="bubble w-full max-w-md px-8 py-8 text-center">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VerifyDomainPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const outcome = await resolveToken(token);

  if (outcome.status === "verified") {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/15">
          <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Domain verified</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your domain{" "}
          <span className="font-mono font-medium text-[var(--text)]">
            {outcome.domain}
          </span>{" "}
          has been verified. Team members with{" "}
          <span className="font-mono font-medium text-[var(--text)]">
            @{outcome.domain}
          </span>{" "}
          emails can now join your organization automatically when they sign up.
        </p>
        <Link
          href="/account"
          className="btn-primary mt-6 inline-flex px-6"
        >
          Go to dashboard
        </Link>
      </Card>
    );
  }

  if (outcome.status === "already_verified") {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chip-bg)]">
          <svg className="h-6 w-6 text-[var(--chip-text)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Already verified</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This domain has already been verified. No further action is needed.
        </p>
        <Link
          href="/account"
          className="btn-primary mt-6 inline-flex px-6"
        >
          Go to dashboard
        </Link>
      </Card>
    );
  }

  if (outcome.status === "expired") {
    return (
      <Card>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text)]">Link expired</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This verification link has expired. Verification links are valid for 72 hours.
        </p>
        <Link
          href="/account"
          className="btn-primary mt-6 inline-flex px-6"
        >
          Resend verification email
        </Link>
        <p className="mt-3 text-xs text-[var(--muted)]">
          You&apos;ll be asked to sign in if you&apos;re not already.
        </p>
      </Card>
    );
  }

  // status === "invalid"
  return (
    <Card>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/15">
        <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-[var(--text)]">Invalid link</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        This verification link is not valid. It may have been typed incorrectly or the link may not exist.
      </p>
      <Link
        href="/account"
        className="btn-secondary mt-6 inline-flex px-6"
      >
        Back to dashboard
      </Link>
    </Card>
  );
}
