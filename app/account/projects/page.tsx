import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";
import { ensureTenantForUser } from "@/lib/tenant";
import { getMyProjects, getTeamProjects } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList, TeamProjectList } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";
import { JoinProjectButton } from "@/components/dashboard/JoinProjectButton";

export default async function AccountProjectsPage() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
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
      primaryAction={<CreateProjectButton />}
      secondaryAction={<JoinProjectButton />}
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          My projects
        </h2>
        {myProjects.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">No projects yet.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Create a project to get started, or join one with an access code.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CreateProjectButton />
              <JoinProjectButton />
            </div>
          </>
        ) : (
          <div className="mt-3">
            <ProjectList projects={myProjects} />
          </div>
        )}
      </div>

      <div className="py-5">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Team projects
        </h2>
        {teamProjects.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-[var(--muted)]">
            You haven’t joined any team projects yet.
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Ask your project owner for an access code, then use “Join team project”.
          </p>
          <div className="mt-3">
            <JoinProjectButton />
          </div>
          </>
        ) : (
          <div className="mt-3">
            <TeamProjectList projects={teamProjects} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
