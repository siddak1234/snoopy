"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideOrganizationJoinRequestAction } from "@/app/account/organization/actions";
import { FormError } from "@/components/ui/FormError";
import type { OrganizationJoinRequest } from "@/lib/tenancy";

export function OrgJoinRequestList({
  workspaceId,
  requests,
}: {
  workspaceId: string;
  requests: OrganizationJoinRequest[];
}) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );

  async function decide(requestId: string, decision: "approve" | "reject") {
    setWorkingId(requestId);
    setError(null);
    const result = await decideOrganizationJoinRequestAction(
      workspaceId,
      requestId,
      decision,
    );
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (pendingRequests.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--muted)]">No pending requests.</p>
    );
  }

  return (
    <div className="mt-3">
      <ul className="divide-y divide-[var(--ring)]">
        {pendingRequests.map((request) => {
          const busy = workingId === request.id;
          return (
            <li
              key={request.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-[var(--muted)]">
                {request.userId}
              </span>
              <button
                type="button"
                onClick={() => decide(request.id, "approve")}
                disabled={busy}
                className="btn-primary inline-flex px-3 py-1.5 text-xs disabled:opacity-60"
              >
                {busy ? "Updating…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => decide(request.id, "reject")}
                disabled={busy}
                className="btn-secondary inline-flex px-3 py-1.5 text-xs disabled:opacity-60"
              >
                Reject
              </button>
            </li>
          );
        })}
      </ul>
      <FormError message={error} className="mt-3" />
    </div>
  );
}
