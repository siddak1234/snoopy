import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { ArchivedRolesClient } from "@/components/dashboard/ArchivedRolesClient";

export default async function ArchivedPositionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  return (
    <SectionCard
      title={project.name}
      subheader="Archived roles"
      primaryAction={
        <Link
          href={`/account/projects/${id}`}
          className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
        >
          Back to project
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <ArchivedRolesClient projectId={project.id} />
      </div>
    </SectionCard>
  );
}
