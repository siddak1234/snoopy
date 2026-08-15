import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import { listWorkspaces } from "@/lib/tenancy";
import { extractDomain, isPublicDomain } from "@/lib/domain-utils";
import SectionCard from "@/components/dashboard/SectionCard";
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

  const showOrgCreate = isCustomDomain && !orgMembership;
  const showOrgLink = isCustomDomain && !!orgMembership;

  return (
    <SectionCard title="Settings">
      <div className="py-5 first:pt-0">
        <p className="text-sm text-[var(--muted)]">
          Account and workspace settings. Connect integrations here.
        </p>
      </div>
      <LinkedAccountsSection />

      {showOrgCreate ? (
        <div className="border-t border-[var(--ring)] py-5">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Create organization workspace
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Your email uses{" "}
            <span className="font-mono font-medium text-[var(--text)]">
              {domain}
            </span>
            . Set up an organization workspace to collaborate with your team.
          </p>
          <div className="mt-4">
            <SetupOrgForm domain={domain} />
          </div>
        </div>
      ) : showOrgLink ? (
        <div className="border-t border-[var(--ring)] py-5">
          <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
            Organization
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            You belong to an organization workspace.
          </p>
          <div className="mt-3">
            <Link
              href="/account/organization"
              className="text-sm font-medium text-[var(--link)] transition hover:underline"
            >
              Manage organization →
            </Link>
          </div>
        </div>
      ) : null}

      <WorkspaceExportSection />

      <div className="border-t border-[var(--ring)] pt-5">
        <h2 className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase">
          Danger zone
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Permanently delete your account and all associated data.
        </p>
        <div className="mt-3">
          <DeleteAccountButton />
        </div>
      </div>
    </SectionCard>
  );
}
