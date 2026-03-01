import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";
import { getProjectsForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { CreateProjectButton } from "@/components/dashboard/CreateProjectButton";

export default async function AccountProjectsPage() {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account/projects");
  }

  const projects = await getProjectsForUser(session.user.id);

  return (
    <SectionCard
      title="Projects"
      subheader="Manage your projects"
      primaryAction={<CreateProjectButton />}
    >
      <div className="py-5 first:pt-0">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          All projects
        </h2>
        {projects.length === 0 ? (
          <div className="mt-4 rounded-xl border border-[var(--ring)]/50 bg-[var(--surface)]/50 px-4 py-8 text-center">
            <p className="text-sm text-[var(--muted)]">No projects yet.</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Create your first project to get started.
            </p>
            <div className="mt-4">
              <CreateProjectButton />
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <ProjectList projects={projects} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}
