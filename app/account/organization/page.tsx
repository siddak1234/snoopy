import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  listOrganizationDomains,
  listJoinRequests,
  listWorkspaceMembers,
  listWorkspaces,
} from "@/lib/tenancy";
import SectionCard from "@/components/dashboard/SectionCard";
import { OrgNameEditor } from "@/components/dashboard/OrgNameEditor";
import { OrgDomainSection } from "@/components/dashboard/OrgDomainSection";
import { OrgMemberList } from "@/components/dashboard/OrgMemberList";
import { OrgJoinRequestList } from "@/components/dashboard/OrgJoinRequestList";
import type { OrgMember } from "@/components/dashboard/OrgMemberList";

export default async function OrganizationPage() {
  const session = await getAppSession();
  if (!session?.user.id) redirect("/account");

  // The session list can be bounded, so resolve workspace authority from the
  // documented workspace collection rather than treating its first page as complete.
  const workspaces = await listWorkspaces();
  const workspace = workspaces.find(
    (candidate) =>
      candidate.id === session.user.workspaceId &&
      candidate.type === "organization" &&
      candidate.role === "owner",
  );
  if (!workspace) redirect("/account");

  const [rawMembers, domains, joinRequests] = await Promise.all([
    listWorkspaceMembers(workspace.id),
    listOrganizationDomains(workspace.id),
    listJoinRequests(workspace.id),
  ]);
  const members: OrgMember[] = rawMembers.map((member) => ({
    userId: member.userId,
    name: member.displayName ?? null,
    email: member.email,
    role: member.role,
    joinedAt: member.createdAt,
  }));

  return (
    <SectionCard
      title="Organization"
      subheader="Manage your organization settings and members."
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
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
              <OrgDomainSection workspaceId={workspace.id} domains={domains} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-[var(--ring)] py-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Members
        </h2>
        <OrgMemberList
          workspaceId={workspace.id}
          orgName={workspace.name}
          viewerUserId={session.user.id}
          members={members}
        />
      </div>

      <div className="border-t border-[var(--ring)] py-5 pb-0">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Join requests
        </h2>
        <OrgJoinRequestList
          workspaceId={workspace.id}
          requests={joinRequests}
        />
      </div>
    </SectionCard>
  );
}
