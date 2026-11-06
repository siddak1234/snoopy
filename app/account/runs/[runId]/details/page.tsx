import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { runFrom } from "@/lib/run-progress";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { RunLive } from "../RunLive";
import { readRunPage } from "../run-page-data";

/**
 * A run's details (build 28, the owner's item 9: "In the bottom make a section
 * that says Run details … When clicked it takes you to this list with steps
 * and steps done, started ended and everything"): its metadata alone —
 * Duration and Steps done, Started, Ended, Trigger and the full Run ID (the
 * owner's builds 37 and 39, item 10: "I just dont want to see the meta data
 * in the bottom. That should be through the run details button for a
 * separate page"; ~~every step from the start~~ until then: they are the
 * run page's steps face). Every run's, whatever its flow: the standard row
 * at the foot of a run's page opens it. Read as the run's page is
 * (`readRunPage`), kept live by the same `RunLive`; another workspace's run
 * is the same "not found". Opened from a run that came from its job or its
 * flow (`?from=`), back keeps that.
 */

export const dynamic = "force-dynamic";

export default async function RunDetailsPage(
  props: PageProps<"/account/runs/[runId]/details">,
) {
  const { runId } = await props.params;
  const { from } = await props.searchParams;
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  if (!workspaceId) notFound();

  const { detail, flow, approvals, role } = await readRunPage(
    workspaceId,
    runId,
  );
  return (
    <RunLive
      workspaceId={workspaceId}
      initial={detail}
      flow={flow}
      approvals={approvals}
      role={role}
      view="details"
      from={runFrom(from)}
    />
  );
}
