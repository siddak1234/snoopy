"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideTeamAccessAction } from "@/app/account/teams/actions";
import { FormError } from "@/components/ui/FormError";
import type { AccessRequest } from "@/lib/tenancy";
import { Button } from "@/components/ui/Button";
import { ROW, SPACING } from "@/lib/spacing";

/**
 * Who is asking to join a team (BUILD-PLAN 24.11.11, backend 24.11.2), for those
 * who decide: the team's owner or admin, and the organization's. Approve puts
 * the person on the team as a member; Deny leaves them off, and they may ask
 * again. Only what is still waiting is listed.
 */
export function TeamAccessRequests({
  projectId,
  requests,
}: {
  projectId: string;
  requests: AccessRequest[];
}) {
  const router = useRouter();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = requests.filter((request) => request.status === "pending");

  async function decide(requestId: string, decision: "approve" | "deny") {
    setWorkingId(requestId);
    setError(null);
    const result = await decideTeamAccessAction(projectId, requestId, decision);
    setWorkingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (pending.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--muted)]">
        No one is asking to join.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <ul className="divide-y divide-[var(--ring)]">
        {pending.map((request) => {
          const busy = workingId === request.id;
          return (
            <li
              key={request.id}
              className={`flex flex-wrap items-center ${SPACING.inner.gap} ${ROW}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--text)]">
                  {request.displayName ?? request.email}
                </p>
                {request.displayName ? (
                  <p className="truncate text-xs text-[var(--muted)]">
                    {request.email}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                onClick={() => decide(request.id, "approve")}
                disabled={busy}
                size="sm"
                className="disabled:opacity-60"
              >
                {busy ? "Updating…" : "Approve"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => decide(request.id, "deny")}
                disabled={busy}
                className="disabled:opacity-60"
              >
                Deny
              </Button>
            </li>
          );
        })}
      </ul>
      <FormError message={error} className="mt-2" />
    </div>
  );
}
