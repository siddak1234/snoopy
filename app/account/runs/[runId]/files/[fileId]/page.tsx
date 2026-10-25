import { notFound } from "next/navigation";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { FileView } from "@/components/dashboard/FileView";
import { getAppSession } from "@/lib/app-session";
import { fileViewHref, runFilePath } from "@/lib/run-files";
import { runLabel } from "@/lib/run-progress";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { readRunPage } from "../../run-page-data";

/**
 * One of a job's uploaded files (Round 19, build 28; the owner's item 7: "a
 * page to review the original document that you can download and share like
 * other documents"): headed by the flow's word for it ("Resume", its first
 * file field's title) else its own name, under the run's; the file itself,
 * Download and Share (`FileView`). Opened from the run's "View {file}" row.
 * A file the job does not list, or another workspace's run, is the same "not
 * found".
 */

export const dynamic = "force-dynamic";

export default async function RunFilePage(
  props: PageProps<"/account/runs/[runId]/files/[fileId]">,
) {
  const { runId, fileId } = await props.params;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const { detail, flow } = await readRunPage(workspaceId, runId);
  const file = detail.files?.find((candidate) => candidate.id === fileId);
  if (!file) notFound();
  const { run } = detail;
  const page = runFilePath(run.id, file.id);

  return (
    <SectionCard
      title={flow?.fileTitle ?? file.filename}
      subheader={run.title ?? runLabel(run.id)}
      back={<BackLink href={`/account/runs/${encodeURIComponent(run.id)}`} />}
    >
      <div className="py-5 first:pt-0">
        <FileView
          file={file}
          viewHref={fileViewHref(page)}
          linkPath={`/v1/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(run.id)}/files/${encodeURIComponent(file.id)}`}
        />
      </div>
    </SectionCard>
  );
}
