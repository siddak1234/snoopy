import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  administers,
  listWorkspaces,
  resolveActiveWorkspaceId,
  roleInWorkspace,
} from "@/lib/tenancy";
import { extractDomain, isPublicDomain } from "@/lib/domain-utils";
import SectionCard from "@/components/dashboard/SectionCard";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";
import LinkedAccountsSection from "@/components/account/LinkedAccountsSection";
import { SetupOrgForm } from "@/app/onboarding/setup-org/SetupOrgForm";
import { WorkspaceExportSection } from "./WorkspaceExportSection";

export default async function AccountSettingsPage() {
  const session = await getAppSession();
  const email = session?.user?.email ?? "";

  const domain = extractDomain(email);
  const isCustomDomain = !!domain && !isPublicDomain(domain);

  // The session list can be bounded; the public workspace collection decides
  // whether organization membership exists.
  const orgMembership = session
    ? (await listWorkspaces()).find(
        (workspace) => workspace.type === "organization",
      )
    : undefined;

  // Only with a session, as the workspace list above: without one there is no
  // workspace to read, and nothing to export.
  const workspaceId = session
    ? await resolveActiveWorkspaceId(session)
    : undefined;
  const canExport = session
    ? administers(await roleInWorkspace(workspaceId))
    : false;

  const showOrgCreate = isCustomDomain && !orgMembership;
  const showOrgLink = isCustomDomain && !!orgMembership;

  return (
    <SectionCard title="Settings">
      <Group>
        <p className="text-sm text-[var(--muted)]">
          Account and workspace settings. Connected accounts for flows are on
          the Connections page.
        </p>
      </Group>
      <LinkedAccountsSection />

      {showOrgCreate ? (
        <Group title="Create organization workspace">
          <p className="text-sm text-[var(--muted)]">
            Your email uses{" "}
            <span className="font-mono font-medium text-[var(--text)]">
              {domain}
            </span>
            . Set up an organization workspace to collaborate with your company.
          </p>
          <div className={SPACING.group.top}>
            <SetupOrgForm domain={domain} />
          </div>
        </Group>
      ) : showOrgLink ? (
        <Group title="Organization">
          <p className="text-sm text-[var(--muted)]">
            You belong to an organization workspace.
          </p>
          <div className={SPACING.inner.top}>
            <Link
              prefetch={false}
              href="/account/organization"
              className="text-sm font-medium text-[var(--link)] transition hover:underline"
            >
              Manage organization →
            </Link>
          </div>
        </Group>
      ) : null}

      <WorkspaceExportSection
        canExport={canExport}
        workspaceId={workspaceId ?? ""}
      />

      <Group title="Danger zone">
        <p className="text-sm text-[var(--muted)]">
          Permanently delete your account, your personal workspace, and every
          organization you alone own.
        </p>
        <div className={SPACING.inner.top}>
          <DeleteAccountButton />
        </div>
      </Group>
    </SectionCard>
  );
}
