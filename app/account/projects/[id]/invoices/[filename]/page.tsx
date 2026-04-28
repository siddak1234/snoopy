import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { InvoiceDetailClient } from "@/components/dashboard/InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string; filename: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) notFound();

  const { id, filename: rawFilename } = await params;
  const filename = decodeURIComponent(rawFilename);
  const userId = session.user.id;

  const project = await getProjectForUser(id, userId);
  if (!project) notFound();

  return (
    <SectionCard
      title={project.name}
      subheader="Invoice details"
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
        <InvoiceDetailClient filename={filename} />
      </div>
    </SectionCard>
  );
}
