"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { setupPath } from "@/lib/flow-steps";
import type { AgreementOffer } from "@/lib/health-agreement";
import { FLOW_CHANGE_ADMIN_ONLY } from "@/lib/subscription-entitlements";
import { subscribeToAutomation } from "./actions";
import { HealthAgreementDialog } from "./HealthAgreementDialog";
import { SPACING } from "@/lib/spacing";

/**
 * Add a flow to this workspace. No team is chosen (backend ADR-0036; the
 * owner, 2026-10-14: "theres no choose a team. there will be pre existing
 * teams depending on which flows are added"): the platform puts the flow in
 * the team of its category, making that team when the workspace has none, and
 * puts the person adding it on the team. Only an owner or admin adds one
 * (backend §12.1 #180): a member sees Add read-only, with "Only an owner or
 * admin can change this flow." under it. ~~Any member may add a flow~~ until
 * Round 21's stage 1.
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
 *
 * **One add per press, under its key**: a flow that carries health data is
 * refused until the workspace's owner accepts the health data agreement
 * (backend ADR-0049, C3). The owner reads and accepts it in
 * `HealthAgreementDialog`, and its "Accept and add flow" sends the add again
 * with the same key; anyone else sees "Ask your workspace owner to accept the
 * health data agreement." and Add does nothing more.
 */
export function AddAutomation({
  templateId,
  name,
  available,
  workspaceId,
  unarchive = false,
  canManage = true,
}: {
  templateId: string;
  name: string;
  available: boolean;
  /** The workspace this page shows; Add is refused once it is not active. */
  workspaceId: string;
  /** Drawn on an archived flow's row: "Unarchive", named for its flow. */
  unarchive?: boolean;
  /** An owner or admin: a member's Add is read-only. */
  canManage?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The agreement to accept, and the key of the add it refused.
  const [offer, setOffer] = useState<{
    agreement: AgreementOffer;
    key: string;
  } | null>(null);

  /** One add under `key`: its refusal in words, or null once it went or the dialog opened. */
  const send = async (key: string): Promise<string | null> => {
    const data = new FormData();
    data.append("templateId", templateId);
    data.append("workspaceId", workspaceId);
    data.append("idempotencyKey", key);
    const result = await subscribeToAutomation(data);
    if (!result.ok) {
      if (!result.agreement) return result.error;
      setOffer({ agreement: result.agreement, key });
      return null;
    }
    if (result.subscriptionId) router.push(setupPath(result.subscriptionId));
    return null;
  };

  const add = () => {
    setError(null);
    startTransition(async () => {
      setError(await send(`subscribe-${crypto.randomUUID()}`));
    });
  };

  return (
    <div className={`flex flex-col ${SPACING.inner.gap}`}>
      <div>
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !available || !canManage}
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
      {canManage ? null : (
        <p className="text-xs text-[var(--muted)]">{FLOW_CHANGE_ADMIN_ONLY}</p>
      )}
      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}
      {offer ? (
        <HealthAgreementDialog
          key={offer.agreement.sha256}
          offer={offer.agreement}
          workspaceId={workspaceId}
          purpose="add"
          onAccepted={() => send(offer.key)}
          onClose={() => setOffer(null)}
        />
      ) : null}
    </div>
  );
}
