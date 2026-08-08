import Link from "next/link";
import { getAppSession } from "@/lib/app-session";
import {
  emptyWhenUnavailable,
  listApprovals,
  type Approval,
} from "@/lib/automations";
import SectionCard from "@/components/dashboard/SectionCard";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { ApprovalDecision } from "./ApprovalDecision";

/**
 * Approvals — the runs waiting on a person.
 *
 * A held run has already ENDED. Deciding does not resume it; approving mints a
 * continuation that carries the automation's state back. That is why this screen
 * links to the held run rather than pretending the work is still in flight.
 */

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const session = await getAppSession();
  const workspaceId = session?.user.workspaceId ?? session?.workspaces[0]?.id;
  const role = session?.workspaces.find((w) => w.id === workspaceId)?.role;

  if (!workspaceId) {
    return (
      <SectionCard title="Approvals" subheader="Runs waiting on a decision">
        <Empty text="No workspace is active yet." />
      </SectionCard>
    );
  }

  const pending = await emptyWhenUnavailable(
    () => listApprovals(workspaceId, "pending"),
    { approvals: [] },
  );

  return (
    <SectionCard title="Approvals" subheader="Runs waiting on a decision">
      {pending.approvals.length === 0 ? (
        <Empty text="Nothing is waiting on you." />
      ) : (
        pending.approvals.map((approval) => (
          <ApprovalRow
            key={approval.id}
            approval={approval}
            // Whether this person may decide is the approval's own answer. The
            // server checks it again and refuses with 403 — this only avoids
            // offering a button that is certain to be refused.
            canDecide={Boolean(role && approval.eligibleRoles.includes(role))}
          />
        ))
      )}
    </SectionCard>
  );
}

function ApprovalRow({
  approval,
  canDecide,
}: {
  approval: Approval;
  canDecide: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 py-5 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text)]">{approval.reason}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Held at “{approval.stepId}” · expires{" "}
            {formatExpiry(approval.expiresAt)}
          </p>
        </div>
        <StatusPill status={approval.status} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <ApprovalDecision approvalId={approval.id} canDecide={canDecide} />
        <Link
          href={`/account/runs/${approval.runId}`}
          prefetch={false}
          className="text-xs text-[var(--accent)] underline underline-offset-2"
        >
          View the run
        </Link>
      </div>

      {!canDecide ? (
        <p className="text-xs text-[var(--muted)]">
          Only {approval.eligibleRoles.join(" or ")} can decide this.
        </p>
      ) : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-5 first:pt-0">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
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
