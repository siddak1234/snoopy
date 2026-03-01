import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { getAuthOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import SectionCard from "@/components/dashboard/SectionCard";

const statusLabel: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  archived: "Archived",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(getAuthOptions());
  if (!session?.user?.id) {
    notFound();
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    notFound();
  }

  return (
    <SectionCard
      title={project.name}
      subheader={project.description ?? undefined}
      primaryAction={
        <Link href="/account/projects" className="btn-secondary inline-flex px-5">
          Back to projects
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <dl className="grid gap-2 text-sm">
          <dt className="text-[var(--muted)]">Status</dt>
          <dd>
            <span className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
              {statusLabel[project.status] ?? project.status}
            </span>
          </dd>
          <dt className="text-[var(--muted)]">Created</dt>
          <dd className="text-[var(--text)]">
            {new Date(project.createdAt).toLocaleDateString(undefined, {
              dateStyle: "medium",
            })}
          </dd>
        </dl>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Project settings and workflow links will go here.
        </p>
      </div>
    </SectionCard>
  );
}
