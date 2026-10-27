"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setupPath } from "@/lib/flow-steps";
import { subscribeToAutomation } from "./actions";
import { SPACING } from "@/lib/spacing";

/**
 * Add a flow to this workspace. No team is chosen (backend ADR-0036; the
 * owner, 2026-10-14: "theres no choose a team. there will be pre existing
 * teams depending on which flows are added"): the platform puts the flow in
 * the team of its category, making that team when the workspace has none, and
 * puts the person adding it on the team. Any member may add a flow.
 *
 * A workspace holds each flow once (the owner, build 12's #9): the card draws
 * this only while the flow is held nowhere, and the action refuses a second
 * copy that a page drawn earlier would still send.
 *
 * A refusal is shown rather than swallowed: the plan limit and an unconfigured
 * billing service are answers a person needs.
 *
 * An archived flow's row draws this too, as Unarchive (the owner, build 12's
 * #4): unarchiving is adding the flow afresh, so it is this Add — the same
 * action and refusals — in that word.
 *
 * **Added, its Set up opens** (Build 21; the owner's AM4: "set up page is
 * initial, after that flow page is the run page"): one simple page with its
 * vendors and its few settings, and Turn on.
 */
export function AddAutomation({
  templateId,
  name,
  available,
  workspaceId,
  unarchive = false,
}: {
  templateId: string;
  name: string;
  available: boolean;
  /** The workspace this page shows; Add is refused once it is not active. */
  workspaceId: string;
  /** Drawn on an archived flow's row: "Unarchive", named for its flow. */
  unarchive?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("templateId", templateId);
      data.append("workspaceId", workspaceId);
      const result = await subscribeToAutomation(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.subscriptionId) router.push(setupPath(result.subscriptionId));
    });
  };

  return (
    <div className={`flex flex-col ${SPACING.inner.gap}`}>
      <div>
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !available}
          onClick={add}
          aria-label={unarchive ? `Unarchive ${name}` : undefined}
        >
          {unarchive
            ? pending
              ? "Unarchiving…"
              : "Unarchive"
            : pending
              ? "Adding…"
              : "Add"}
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
