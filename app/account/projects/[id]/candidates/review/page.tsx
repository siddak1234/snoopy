import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { CandidateReviewClient } from "@/components/dashboard/CandidateReviewClient";

// "Needs review" page — lists every flagged candidate for the project (optionally
// narrowed to the Role/Department the dashboard was filtered to, so the list
// matches the count on the card). Mirrors the candidate detail route: auth +
// project membership are checked here; the rows are fetched client-side
// (RLS-gated) by CandidateReviewClient.
export default async function CandidateReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ role?: string; department?: string }>;
}) {
  const session = await getAppSession();
  if (!session?.user?.id) notFound();

  const { id } = await params;
  const { role, department } = await searchParams;

  const project = await getProjectForUser(id, session.user.id);
  if (!project) notFound();

  return (
    <SectionCard
      title={project.name}
      subheader="Needs review"
      primaryAction={
        <Link
          href={`/account/projects/${id}`}
          className="btn-secondary inline-flex !min-h-0 !px-4 !py-1.5 text-sm"
        >
          Back to dashboard
        </Link>
      }
    >
      <div className="py-5 first:pt-0">
        <CandidateReviewClient
          projectId={project.id}
          role={role ?? ""}
          department={department ?? ""}
        />
      </div>
    </SectionCard>
  );
}
