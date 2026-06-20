import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/auth-supabase";
import { getProjectForUser } from "@/lib/projects";
import SectionCard from "@/components/dashboard/SectionCard";
import { CandidateDetail } from "@/components/dashboard/CandidateDetail";
import {
  findCandidateById,
  getCandidateDetail,
} from "@/lib/resume-candidates";

// Per-candidate detail page — mirrors the invoice detail route
// (app/account/projects/[id]/invoices/detail). The candidate id rides in a
// query string (?candidate=…) for the same reason the invoice route uses one.
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
  const userId = session.user.id;

  const project = await getProjectForUser(id, userId);
  if (!project) notFound();

  // MOCK lookup. Seeded candidates resolve; freshly-uploaded ones live only in
  // the dashboard's in-memory state (not persisted yet), so they show a friendly
  // not-available state instead of a hard 404.
  const candidate = findCandidateById(candidateId);
  const detail = candidate ? getCandidateDetail(candidate.id) : null;

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
        {candidate ? (
          <CandidateDetail candidate={candidate} detail={detail} />
        ) : (
          <div className="rounded-lg border border-[var(--ring)]/50 px-4 py-10 text-center text-sm text-[var(--muted)]">
            This candidate isn’t available yet. Uploaded candidates aren’t
            persisted in this preview — they live only in the dashboard session.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
