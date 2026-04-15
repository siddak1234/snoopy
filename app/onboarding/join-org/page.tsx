import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { extractDomain } from "@/lib/domain-utils";
import { JoinOrgForm } from "./JoinOrgForm";

export const metadata = { title: "Join your organization" };

export default async function JoinOrgPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w: workspaceId } = await searchParams;

  if (!workspaceId) redirect("/onboarding/setup-org");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/login");

  // Fetch workspace for display only — workspaceId from the URL is used here
  // solely to show the org name. The actual join action re-verifies domain
  // server-side and never trusts this ID.
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId, domainVerified: true },
    select: { id: true, name: true, domain: true },
  });

  if (!workspace) redirect("/onboarding/setup-org");

  // Belt-and-suspenders: confirm the user's domain still matches before rendering
  const userDomain = extractDomain(user.email);
  if (!userDomain || userDomain !== workspace.domain) {
    redirect("/onboarding/setup-org");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="bubble w-full max-w-md px-8 py-8">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          Join your team
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Your email domain{" "}
          <span className="font-mono font-medium text-[var(--text)]">
            {workspace.domain}
          </span>{" "}
          is registered to{" "}
          <span className="font-medium text-[var(--text)]">{workspace.name}</span>.
          Would you like to join?
        </p>

        <JoinOrgForm workspaceName={workspace.name} />
      </div>
    </div>
  );
}
