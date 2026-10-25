import { notFound } from "next/navigation";
import { getAppSession } from "@/lib/app-session";
import { resolveActiveWorkspaceId } from "@/lib/tenancy";
import { RunLive } from "../RunLive";
import { readRunPage } from "../run-page-data";

/**
 * A run's details (build 28, the owner's item 9: "In the bottom make a section
 * that says Run details … When clicked it takes you to this list with steps
 * and steps done, started ended and everything"): Duration and Steps done,
 * every step from the start — a held step its state alone, its Approve and
 * Deny on the run's page (build 28's review, finding 1) — and Started, Ended,
 * Trigger and the full Run ID.
 * Every run's, whatever its flow: the standard row at the foot of a run's
 * page opens it. Read as the run's page is (`readRunPage`), kept live by the
 * same `RunLive`; another workspace's run is the same "not found".
 */

export const dynamic = "force-dynamic";

export default async function RunDetailsPage(
  props: PageProps<"/account/runs/[runId]/details">,
) {
  const { runId } = await props.params;
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
    />
  );
}
