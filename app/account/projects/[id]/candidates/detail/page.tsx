import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { CandidateDetailClient } from "@/components/dashboard/CandidateDetailClient";

// Per-candidate detail page — mirrors the invoice detail route. The candidate id
// rides in a query string (?candidate=…). Auth + project membership are checked
// here; the row itself is fetched client-side (RLS-gated) by CandidateDetailClient.
export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ candidate?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const { candidate: candidateId } = await searchParams;
  if (!candidateId) notFound();

  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  return (
    <SectionCard
      title={project.name}
      subheader="Candidate details"
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
        <CandidateDetailClient projectId={project.id} candidateId={candidateId} />
      </div>
    </SectionCard>
  );
}
