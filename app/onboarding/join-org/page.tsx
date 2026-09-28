import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { loginHref } from "@/lib/platform-api";
import { discoverOrganizations } from "@/lib/tenancy";
import { JoinOrgForm } from "./JoinOrgForm";

export const metadata = { title: "Join your organization" };

export default async function JoinOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w: workspaceId } = await searchParams;
  if (!workspaceId) redirect("/onboarding/setup-org");

  const session = await getAppSession();
  // The return keeps `?w=`: without it, signing in lands on "create an
  // organization" instead of the one this link named.
  if (!session?.user.email) {
    redirect(
      loginHref(`/onboarding/join-org?w=${encodeURIComponent(workspaceId)}`),
    );
  }

  const organizations = await discoverOrganizations();
  const organization = organizations.find(
    (candidate) => candidate.workspaceId === workspaceId,
  );
  if (!organization || organization.membershipState === "member") {
    redirect("/onboarding/setup-org");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="bubble w-full max-w-md px-8 py-8">
        <h1 className="text-2xl font-medium text-[var(--text)]">
          Join your team
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your verified email domain is registered to{" "}
          <span className="font-medium text-[var(--text)]">
            {organization.name}
          </span>
          . Would you like to join?
        </p>
        <JoinOrgForm
          workspaceId={organization.workspaceId}
          workspaceName={organization.name}
          requested={organization.membershipState === "requested"}
        />
      </div>
    </div>
  );
}
