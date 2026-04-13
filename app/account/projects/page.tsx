import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { ensureTenantForUser } from "@/lib/tenant";
import { getMyProjects, getTeamProjects } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList, TeamProjectList } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";
import { JoinProjectButton } from "@/components/dashboard/JoinProjectButton";
import { AuthHydrationGate } from "@/components/auth/AuthHydrationGate";

export default async function AccountProjectsPage() {
  const session = await getAppSession();
  if (!session?.user?.id) {
    const cookieStore = await cookies();
    const hasSupabaseAuthCookies = cookieStore
      .getAll()
      .some((c) => c.name.includes("auth-token"));
    if (hasSupabaseAuthCookies) {
      return <AuthHydrationGate destination="/account/projects" />;
    }
    redirect("/login?callbackUrl=/account/projects");
  }

  await ensureTenantForUser(session.user.id);
  const [myProjects, teamProjects] = await Promise.all([
    getMyProjects(session.user.id),
    getTeamProjects(session.user.id),
  ]);

  return (
    <SectionCard
      title="Projects"
      subheader="Manage your projects"
    >
      <div className=”py-5 first:pt-0”>
        <div className=”flex items-center justify-between”>
          <h2 className=”text-xs font-medium uppercase tracking-wide text-[var(--muted)]”>
            My projects
          </h2>
          <CreateProjectButton />
        </div>
        {myProjects.length === 0 ? (
          <div className=”mt-3”>
            <p className=”text-sm text-[var(--muted)]”>No projects yet.</p>
            <p className=”mt-1 text-xs text-[var(--muted)]”>
              Create a project to get started, or join one with an access code.
            </p>
          </div>
        ) : (
          <div className=”mt-3”>
            <ProjectList projects={myProjects} />
          </div>
        )}
      </div>

      <div className=”py-5”>
        <div className=”flex items-center justify-between”>
          <h2 className=”text-xs font-medium uppercase tracking-wide text-[var(--muted)]”>
            Team projects
          </h2>
          <JoinProjectButton />
        </div>
        {teamProjects.length === 0 ? (
          <div className=”mt-3”>
            <p className=”text-sm text-[var(--muted)]”>You haven’t joined any team projects yet.</p>
            <p className=”mt-1 text-xs text-[var(--muted)]”>
              Ask your project owner for an access code, then use “Join team project”.
            </p>
          </div>
        ) : (
          <div className=”mt-3”>
            <TeamProjectList projects={teamProjects} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
