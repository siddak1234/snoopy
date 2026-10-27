"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestTeamAccessAction,
  withdrawTeamAccessAction,
} from "@/app/account/teams/actions";
import { ConfirmRemoveButton } from "@/components/dashboard/ConfirmRemoveButton";
import { FormError } from "@/components/ui/FormError";
import type { TeamDirectoryEntry } from "@/lib/tenancy";
import { Button } from "@/components/ui/Button";

/**
 * The teams in an organization a person can ask to join (BUILD-PLAN 24.11.11,
 * backend 24.11.2 and 24.11.4): Request, or — once asked — Requested, with a way
 * to withdraw. Teams they can already see are not listed here. Each is titled by
 * its kind, once (the owner, build 9: a team IS its kind).
 */
export function AskToJoinList({
  workspaceId,
  headingId,
  entries,
}: {
  /** The organization whose directory listed these teams. */
  workspaceId: string;
  /** The list's heading, where focus goes once a row changes. */
  headingId: string;
  entries: TeamDirectoryEntry[];
}) {
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(projectId: string) {
    setAsking(projectId);
    setError(null);
    const result = await requestTeamAccessAction(workspaceId, projectId);
    setAsking(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-2">
      <ul className="divide-y divide-[var(--ring)]">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="flex flex-wrap items-center justify-between gap-2 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text)]">
                {entry.type}
              </p>
            </div>
            {entry.access === "requested" ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Requested</span>
                <ConfirmRemoveButton
                  label="Withdraw"
                  busyLabel="Withdrawing…"
                  title={`Withdraw your request to join ${entry.type}?`}
                  description="You can ask again any time."
                  confirmLabel="Withdraw"
                  action={withdrawTeamAccessAction.bind(
                    null,
                    workspaceId,
                    entry.id,
                  )}
                  focusAfter={headingId}
                />
              </div>
            ) : (
              <Button
                type="button"
                onClick={() => ask(entry.id)}
                disabled={asking !== null}
                variant="secondary"
                size="sm"
                className="disabled:opacity-60"
              >
                {asking === entry.id ? "Asking…" : "Request to join"}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <FormError message={error} className="mt-2" />
    </div>
  );
}
