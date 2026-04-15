import Link from "next/link";
import { getAppSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/db";
import { extractDomain, isPublicDomain } from "@/lib/domain-utils";
import SectionCard from "@/components/dashboard/SectionCard";
import DeleteAccountButton from "@/components/account/DeleteAccountButton";
import LinkedAccountsSection from "@/components/account/LinkedAccountsSection";
import { SetupOrgForm } from "@/app/onboarding/setup-org/SetupOrgForm";

export default async function AccountSettingsPage() {
  const session = await getAppSession();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? "";

  const domain = extractDomain(email);
  const isCustomDomain = !!domain && !isPublicDomain(domain);

  // Check if the user already owns an org workspace
  const orgMembership = userId
    ? await prisma.membership.findFirst({
        where: { userId, workspace: { type: "organization" } },
        select: { workspaceId: true },
      })
    : null;

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
          <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
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
          <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
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

      <div className="border-t border-[var(--ring)] pt-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
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
