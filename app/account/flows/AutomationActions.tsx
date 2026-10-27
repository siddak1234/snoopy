"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/ssr/SlidersHorizontal";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type { SubscriptionStatus } from "@/lib/automations";
import {
  archiveSubscription,
  setSubscriptionStatus,
  type ActionResult,
} from "./actions";
import { WebhookAddressButton } from "./WebhookAddressButton";
import { SPACING } from "@/lib/spacing";

/** The row at the bottom of a flow's page that opens Set up again (the owner's AM4). */
export const EDIT_SETUP = "Edit setup";

/**
 * The bottom of a flow's page (Build 21, spec A6; the owner's AM4: "they can
 * have a edit settings/flow/setup thing in the bottom of the flow page in case
 * they want to change how it was set up"):
 *
 * - **Pause** while it is on — while it is off, Turn on is Step 1's alone,
 *   never two Turn on buttons (the app's M4);
 * - **Edit setup** when the version it runs declares settings or accounts: Set
 *   up again, the same page Add opened (~~Set up, a dialog on the card~~ until
 *   Build 21);
 * - **Webhook address** for a webhook-started version, owner or admin only;
 * - **Archive flow**, last and in red: the platform's one-way `archived`,
 *   behind its confirmation — it stops, moves to Archived flows, keeps its runs
 *   in Activity, and can be unarchived later (the owner's build 12, #4, #5).
 *
 * ~~The move to the catalog's newest version, while it was newer than the one
 * pinned (backend §12.1 #126)~~ until Build 22 (the owner's build 21 item 7: "I also
 * dont want a move to vx number in the flows. The user always gets the latest
 * version"): the platform moves every flow to the newest (backend ADR-0041).
 *
 * A client component only because it holds pending state and the last refusal;
 * the work happens in server actions. A refusal is shown rather than
 * swallowed.
 */
export function AutomationActions({
  workspaceId,
  name,
  subscription,
  setupHref,
  webhook,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  name: string;
  subscription: { id: string; status: SubscriptionStatus };
  /** Set up for this flow, when its version declares anything to set up. */
  setupHref: string | null;
  /** A webhook-started version, for an owner or admin. */
  webhook: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Every action carries the workspace the page showed (register F28, F70).
  const field = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    data.set("workspaceId", workspaceId);
    return data;
  };

  const run = (
    action: (data: FormData) => Promise<ActionResult>,
    data: FormData,
    done: () => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      done();
    });
  };

  const close = () => {
    setArchiving(false);
    setError(null);
  };

  return (
    <div className={`flex flex-col ${SPACING.group.gap}`}>
      {subscription.status === "live" ? (
        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                setSubscriptionStatus,
                field({ subscriptionId: subscription.id, status: "paused" }),
                () => router.refresh(),
              )
            }
          >
            {pending ? "Working…" : "Pause"}
          </Button>
        </div>
      ) : null}

      {setupHref || webhook ? (
        <ul className="flex flex-col divide-y divide-[var(--ring)] rounded-[var(--radius-md)] border border-[var(--ring)]">
          {setupHref ? (
            <li>
              <Link
                prefetch={false}
                href={setupHref}
                className={`flex min-h-14 items-center ${SPACING.inner.gap} ${SPACING.rowX.x} ${SPACING.rowY.y} text-sm font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]`}
              >
                <SlidersHorizontalIcon
                  aria-hidden
                  size={24}
                  className="shrink-0 text-[var(--link)]"
                />
                <span className="flex-1">{EDIT_SETUP}</span>
                <CaretRightIcon
                  aria-hidden
                  size={16}
                  className="text-[var(--muted)]"
                />
              </Link>
            </li>
          ) : null}
          {/* Where a vendor sends the events that start it (backend §12.1
              #91): only for a webhook-started version, and only for an owner
              or admin, as the platform allows no one else. */}
          {webhook ? (
            <li className={`${SPACING.rowX.x} ${SPACING.rowY.y}`}>
              <WebhookAddressButton
                workspaceId={workspaceId}
                subscriptionId={subscription.id}
              />
            </li>
          ) : null}
        </ul>
      ) : null}

      <div>
        <Button
          variant="danger"
          size="sm"
          disabled={pending}
          onClick={() => {
            setError(null);
            setArchiving(true);
          }}
        >
          Archive flow
        </Button>
      </div>

      {error && !archiving ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      {archiving ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={`automation-archive-${subscription.id}-title`}
          ariaDescribedBy={`automation-archive-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-archive-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Archive {name}?
          </h2>
          <p
            id={`automation-archive-${subscription.id}-description`}
            className={`${SPACING.title.top} text-sm text-[var(--muted)]`}
          >
            It stops and moves to Archived flows. Its runs stay in Activity, and
            you can unarchive it later.
          </p>
          <FormError message={error} />
          <div
            className={`${SPACING.group.top} flex flex-wrap ${SPACING.inner.gap}`}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() =>
                run(
                  archiveSubscription,
                  field({ subscriptionId: subscription.id }),
                  () => router.push("/account/flows"),
                )
              }
              disabled={pending}
            >
              {pending ? "Archiving…" : "Archive"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
