import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";
import SectionCard from "@/components/dashboard/SectionCard";
import { OrgNameEditor } from "@/components/dashboard/OrgNameEditor";
import { OrgDomainSection } from "@/components/dashboard/OrgDomainSection";
import { OrgMemberList } from "@/components/dashboard/OrgMemberList";
import { WorkspaceInviteButton } from "@/components/dashboard/WorkspaceInviteButton";
import type { OrgMember } from "@/components/dashboard/OrgMemberList";

export default async function OrganizationPage() {
  const session = await getAppSession();
  if (!session?.user?.id) redirect("/account");

  const userId = session.user.id;
  const workspaceId = session.user.workspaceId;

  if (!workspaceId) redirect("/account");

  // Verify actor is OWNER of an organization workspace
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          type: true,
          domain: true,
          domainVerified: true,
          domainVerifiedAt: true,
        },
      },
    },
  });

  if (
    !membership ||
    membership.role !== "OWNER" ||
    membership.workspace.type !== "organization"
  ) {
    redirect("/account");
  }

  const workspace = membership.workspace;

  // Fetch all workspace members + pending invites in parallel
  const [rawMembers, rawPendingInvites] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.workspaceInvite.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, token: true, expiresAt: true, createdAt: true },
    }),
  ]);

  // Serialize for client components
  const members: OrgMember[] = rawMembers.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  }));

  const pendingInvites = rawPendingInvites.map((i) => ({
    id: i.id,
    token: i.token,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));

  // Build domain section props
  type DomainProps =
    | { state: "none" }
    | { state: "verified"; domain: string; verifiedAt: string }
    | { state: "unverified"; domain: string };

  let domainProps: DomainProps;
  if (!workspace.domain) {
    domainProps = { state: "none" };
  } else if (workspace.domainVerified && workspace.domainVerifiedAt) {
    domainProps = {
      state: "verified",
      domain: workspace.domain,
      verifiedAt: workspace.domainVerifiedAt.toISOString(),
    };
  } else {
    domainProps = { state: "unverified", domain: workspace.domain };
  }

  return (
    <SectionCard
      title="Organization"
      subheader="Manage your organization settings, members, and invites."
    >
      {/* ── Organization details ─────────────────────────────────────────── */}
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Organization details
        </h2>
        <dl className="mt-3 space-y-3 text-sm">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <dt className="w-20 shrink-0 text-[var(--muted)]">Name</dt>
            <dd>
              <OrgNameEditor
                workspaceId={workspace.id}
                initialName={workspace.name}
              />
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4">
            <dt className="w-20 shrink-0 pt-0.5 text-[var(--muted)]">Domain</dt>
            <dd>
              <OrgDomainSection {...domainProps} />
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Members ──────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--ring)] py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Members
        </h2>
        <OrgMemberList
          workspaceId={workspace.id}
          orgName={workspace.name}
          viewerUserId={userId}
          members={members}
        />
      </div>

      {/* ── Invites ──────────────────────────────────────────────────────── */}
      <div className="border-t border-[var(--ring)] py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Invites
        </h2>
        <div className="mt-3">
          <WorkspaceInviteButton
            workspaceId={workspace.id}
            initialPendingInvites={pendingInvites}
          />
        </div>
      </div>
    </SectionCard>
  );
}
