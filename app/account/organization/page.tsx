import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import {
  administers,
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
import { OrgJoinLink } from "@/components/dashboard/OrgJoinLink";
import { OrgDomainOnly } from "@/components/dashboard/OrgDomainOnly";
import { joinLinkLine } from "@/lib/join-link";
import { Group } from "@/components/dashboard/Group";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { GROUP_BAND, SPACING } from "@/lib/spacing";
import type { OrgMember } from "@/components/dashboard/OrgMemberList";

/** A detail's row: its name over its value on a phone, beside it on a wider screen. */
const DETAIL_ROW = `flex flex-col ${SPACING.inner.gap} sm:flex-row sm:items-start`;

export default async function OrganizationPage() {
  const session = await getAppSession();
  if (!session?.user.id) redirect("/account");

  // The session list can be bounded, so resolve workspace authority from the
  // documented workspace collection rather than treating its first page as complete.
  const workspaces = await listWorkspaces();
  // Its owners and admins: every operation on this page admits both (backend
  // `requireWorkspaceRole(…, ['owner', 'admin'])`), and it admitted only the
  // owner (register F55).
  const workspace = workspaces.find(
    (candidate) =>
      candidate.id === session.user.workspaceId &&
      candidate.type === "organization" &&
      administers(candidate.role),
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
      <Group title="Organization details">
        <dl className={`flex flex-col ${SPACING.group.gap} text-sm`}>
          <div className={DETAIL_ROW}>
            <dt className="w-20 shrink-0 text-[var(--muted)]">Name</dt>
            <dd>
              <OrgNameEditor
                workspaceId={workspace.id}
                initialName={workspace.name}
              />
            </dd>
          </div>
          <div className={DETAIL_ROW}>
            <dt className="w-20 shrink-0 text-[var(--muted)]">Domain</dt>
            <dd>
              <OrgDomainSection workspaceId={workspace.id} domains={domains} />
            </dd>
          </div>
          <div className={DETAIL_ROW}>
            <dt className="w-20 shrink-0 text-[var(--muted)]">Join link</dt>
            <dd className="min-w-0 flex-1">
              <OrgJoinLink
                workspaceId={workspace.id}
                line={joinLinkLine(domains)}
              />
            </dd>
          </div>
          <div className={DETAIL_ROW}>
            <dt className="w-20 shrink-0 text-[var(--muted)]">Who can join</dt>
            <dd className="min-w-0 flex-1">
              {/* The owner's build 13 decision 8B: absent from the summary means off. */}
              <OrgDomainOnly
                workspaceId={workspace.id}
                initialOn={workspace.domainOnly === true}
              />
            </dd>
          </div>
        </dl>
      </Group>

      {/* Each list keeps its own title gap: the band and its title only. */}
      <section className={GROUP_BAND}>
        <SectionTitle>Members</SectionTitle>
        <OrgMemberList
          workspaceId={workspace.id}
          orgName={workspace.name}
          viewerUserId={session.user.id}
          members={members}
        />
      </section>

      <section className={GROUP_BAND}>
        <SectionTitle>Join requests</SectionTitle>
        <OrgJoinRequestList
          workspaceId={workspace.id}
          requests={joinRequests}
        />
      </section>
    </SectionCard>
  );
}
