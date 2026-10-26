import { notFound } from "next/navigation";
import SectionCard from "@/components/dashboard/SectionCard";
import { BackLink } from "@/components/dashboard/BackLink";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { getAppSession } from "@/lib/app-session";
import { readRun } from "@/lib/automations";
import { PlatformServerError } from "@/lib/platform-server";
import { PACKAGE_UNAVAILABLE } from "@/lib/run-documents";
import { runLabel } from "@/lib/run-progress";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { PackageActions, PackageFrame } from "../RunLive";

/**
 * A job's run package (Build 24, P12; the owner's build 23 words: "View
 * button should take them to a page showing the package"): the A8X PDF itself
 * — cover, summary, subtotals, every invoice and the original files — in a
 * frame the page's height, through the site's own route (`file/route.ts`),
 * and Download PDF and Download Excel. A job the platform cannot package yet
 * (no documents, or still going: `packageAvailable`) says so, with the way
 * back to its run.
 * ~~The package's content drawn as sections of this page~~ (the session's
 * S16), overridden by the owner: the page shows the PDF.
 */

export const dynamic = "force-dynamic";

export default async function RunPackagePage(
  props: PageProps<"/account/runs/[runId]/package">,
) {
  const { runId } = await props.params;
  const workspaceId = await resolveActiveWorkspaceId(await getAppSession());
  if (!workspaceId) notFound();

  let detail;
  try {
    detail = await readRun(workspaceId, runId);
  } catch (error) {
    // Another workspace's job answers 404, as one that does not exist.
    if (error instanceof PlatformServerError && error.status === 404)
      notFound();
    throw error;
  }
  const job = detail.run.id;
  // The platform says whether the job has a package (backend ADR-0048).
  const ready = detail.packageAvailable === true;

  return (
    <SectionCard
      title="Run package"
      subheader={runLabel(job)}
      back={<BackLink href={`/account/runs/${encodeURIComponent(job)}`} />}
      primaryAction={
        ready ? (
          <PackageActions workspaceId={workspaceId} runId={job} view={false} />
        ) : undefined
      }
    >
      {ready ? (
        <div className="py-5 first:pt-0">
          <PackageFrame runId={job} />
        </div>
      ) : (
        <EmptyRow text={PACKAGE_UNAVAILABLE} />
      )}
    </SectionCard>
  );
}
