import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractDomain } from "@/lib/domain-utils";
import { SetupOrgForm } from "./SetupOrgForm";

export const metadata = { title: "Set up your organization" };

export default async function SetupOrgPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout handles the unauthenticated case, but we need the email here.
  if (!user?.email) redirect("/login");

  const domain = extractDomain(user.email);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="bubble w-full max-w-md px-8 py-8">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          Set up your organization
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your email uses the domain{" "}
          <span className="font-mono font-medium text-[var(--text)]">{domain}</span>.
          Create an organization workspace for your team, or continue with a personal account.
        </p>

        <SetupOrgForm domain={domain} />
      </div>
    </div>
  );
}
