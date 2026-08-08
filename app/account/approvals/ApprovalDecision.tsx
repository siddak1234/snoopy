"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { decideApproval } from "@/app/account/automations/actions";

/**
 * Approve or reject one held run.
 *
 * The form carries only the decision. The actor and their workspace role come
 * from the session server-side — a body naming its own role is refused as an
 * unsupported field, because a caller choosing its own role would make the
 * approval's eligible roles a formality.
 */
export function ApprovalDecision({
  approvalId,
  canDecide,
}: {
  approvalId: string;
  canDecide: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const decide = (decision: "approved" | "rejected") => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("approvalId", approvalId);
      data.append("decision", decision);
      const result = await decideApproval(data);
      if (!result.ok) setError(result.error);
    });
  };

  if (!canDecide) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={pending}
          onClick={() => decide("approved")}
        >
          {pending ? "Working…" : "Approve"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => decide("rejected")}
        >
          Reject
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
