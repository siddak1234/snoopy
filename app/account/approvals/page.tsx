import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { getAppSession } from "@/lib/app-session";
import { resolveActiveWorkspaceId, roleInWorkspace } from "@/lib/tenancy";
import { emptyWhenUnavailable, listApprovals } from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { ApprovalQueue } from "./ApprovalDecision";

/**
 * Approvals — the jobs waiting on a person.
 *
 * Each row links to its job by the job's id: approving continues the job under
 * that same id (backend ADR-0044), so the run page it opens is the work going
 * on. A decided row fades and leaves, and the last one leaving goes to
 * Activity (Build 24, P7; `ApprovalQueue`).
 */

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getAppSession();
  const workspaceId = await resolveActiveWorkspaceId(session);
  const role = await roleInWorkspace(workspaceId);

  if (!workspaceId) {
    return (
      <SectionCard title="Approvals" subheader="Runs waiting on a decision">
        <EmptyRow text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const pending = await emptyWhenUnavailable(
    () => listApprovals(workspaceId, "pending"),
    { approvals: [] },
  );

  return (
    <SectionCard title="Approvals" subheader="Runs waiting on a decision">
      <ApprovalQueue
        workspaceId={workspaceId}
        rows={pending.approvals.map((approval) => ({
          approval,
          // Whether this person may decide is the approval's own answer. The
          // server checks it again and refuses with 403 — this only avoids
          // offering a button that is certain to be refused.
          canDecide: Boolean(role && approval.eligibleRoles.includes(role)),
          expires: formatExpiry(approval.expiresAt),
        }))}
        // Arriving with nothing waiting, the whole page is empty: the app's
        // empty screen (the owner, build 9).
        empty={
          <EmptyRow
            icon={<CheckCircleIcon size={32} />}
            title="Nothing needs review"
            text="When an agent pauses for a human decision, it waits for you here."
          />
        }
      />
    </SectionCard>
  );
}

/**
 * How long is left.
 *
 * An approval expires and the work is abandoned, so the deadline is the part
 * that changes what someone does next — more than the timestamp it falls on.
 */
function formatExpiry(iso: string): string {
  const hours = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  if (hours <= 0) return "shortly";
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
