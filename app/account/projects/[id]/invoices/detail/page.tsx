import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { InvoiceDetailClient } from "@/components/dashboard/InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ file?: string; lounge?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  // Filename is passed as a query string rather than a path segment because
  // the DB key contains literal "%2F" characters (not real "/"). Next.js's
  // path normalization decodes %2F into / and re-splits the URL, mangling
  // the value. Query strings are decoded once and pass through verbatim.
  // lounge is carried alongside so the detail query stays scoped to the
  // same lounge the user was viewing in the dashboard.
  const { file: filename, lounge: loungeCode } = await searchParams;
  if (!filename) notFound();
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
        <InvoiceDetailClient projectId={project.id} filename={filename} loungeCode={loungeCode ?? null} />
      </div>
    </SectionCard>
  );
}
