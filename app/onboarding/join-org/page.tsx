import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
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
  if (!session?.user.email) redirect("/login");

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
