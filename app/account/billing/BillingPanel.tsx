"use client";

import { useEffect, useState, useTransition } from "react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { PurchasablePlan, WorkspaceBillingResponse } from "@/lib/billing";
import {
  beginBillingCheckout,
  openBillingPortal,
  type BillingActionResult,
} from "./actions";

/**
 * The billing surface: the workspace's plan, and the way to change it.
 *
 * A client component only because it holds pending state and the last refusal.
 * Checkout and the portal are hosted pages the browser navigates to; nothing
 * here renders a card field or any identifier that is not this platform's own
 * plan id.
 *
 * Buying and changing are different doors (ADR-0025 §1). A workspace with no
 * live subscription buys through checkout; one with a live subscription changes
 * or cancels it in the portal — a second checkout would start a second
 * subscription for the same workspace.
 */

// Capabilities are data (ADR-0016): a plan lists what it allows by name and
// number. The one name that exists today reads as a person would say it; any
// other is shown as written rather than hidden.
const capabilityCopy: Record<string, string> = {
  "automation.subscribe": "Automations",
};

export function BillingPanel({
  workspaceId,
  billing,
  plans,
  periodEnd,
}: {
  /** The workspace this page rendered; the actions refuse if it stopped being active. */
  workspaceId: string;
  billing: WorkspaceBillingResponse;
  plans: PurchasablePlan[];
  /** `currentPeriodEnd` as a person reads it — formatted on the server. */
  periodEnd: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [needsCheckout, setNeedsCheckout] = useState(false);
  // Which control started the hand-off: every button is disabled while one is
  // in flight, but only the one that was pressed says it is opening.
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  // `window.location.assign` returns before the hosted page loads, which ends
  // the transition; without this the buttons would re-enable while the browser
  // is still leaving, and a second press would start a second session.
  const [departing, setDeparting] = useState(false);
  const busy = pending || departing;

  // Coming back with the browser's back button can restore this page from the
  // back/forward cache — with the billing state it rendered BEFORE the hosted
  // page, which after a purchase is stale and would offer checkout again. A
  // restored page is therefore reloaded, never merely unlocked.
  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      window.location.reload();
    };
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  // `canceled` and `unpaid` are what end access (the contract's own words on
  // `status`): a plan in either state is named but no longer current.
  const accessEnded =
    billing.status === "canceled" || billing.status === "unpaid";
  // Which door. Checkout starts a NEW subscription, so it is offered only when
  // the provider holds none for this workspace: the free floor (no status) or a
  // canceled one. Every other status — `unpaid` and `incomplete` included — is
  // a subscription the provider still holds, paid, changed or cancelled in the
  // portal (ADR-0025 §1); a checkout beside it would be a second subscription.
  const portalManaged =
    billing.status !== undefined && billing.status !== "canceled";

  const navigate = (
    action: string,
    run: () => Promise<BillingActionResult>,
  ) => {
    setError(null);
    setNeedsCheckout(false);
    setPendingAction(action);
    startTransition(async () => {
      let result: BillingActionResult;
      try {
        result = await run();
      } catch {
        // The action never answered (the network, or a deploy that replaced
        // it). Said here, in the panel, rather than by replacing the page.
        setError("Billing could not be reached. Try again.");
        return;
      }
      if (!result.ok) {
        if (result.needsCheckout) setNeedsCheckout(true);
        else setError(result.error);
        return;
      }
      setDeparting(true);
      window.location.assign(result.url);
    });
  };

  const opening = (action: string) => busy && pendingAction === action;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="billing-current">
        <h2
          id="billing-current"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          Current plan
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-base font-medium text-[var(--text)]">
            {billing.displayName}
          </p>
          {billing.status ? <StatusPill status={billing.status} /> : null}
        </div>
        {/* A period line only while access lasts: once it has ended, the pill
            says so, and a period end can lie in the future. */}
        {periodEnd && !accessEnded ? (
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]">
            <div className="flex gap-1">
              <dt>{billing.cancelAtPeriodEnd ? "Ends" : "Renews"}</dt>
              <dd className="text-[var(--text)]">{periodEnd}</dd>
            </div>
          </dl>
        ) : null}
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() =>
              navigate("portal", () => openBillingPortal(workspaceId))
            }
          >
            {opening("portal") ? "Opening…" : "Manage billing"}
          </Button>
        </div>
        {needsCheckout ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            {plans.length > 0
              ? "This workspace has no billing account yet. Choose a plan below to start one."
              : "This workspace has no billing account yet, and no plan can be bought right now."}
          </p>
        ) : null}
      </section>

      <section
        aria-labelledby="billing-plans"
        className="border-t border-[var(--ring)] pt-5"
      >
        <h2
          id="billing-plans"
          className="text-xs font-medium tracking-wide text-[var(--muted)] uppercase"
        >
          Plans
        </h2>
        {portalManaged ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            To change or cancel your plan, or to finish a payment, use Manage
            billing.
          </p>
        ) : null}
        {plans.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">
            No plans are available to purchase right now.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {plans.map((plan) => {
              const current = !accessEnded && plan.planId === billing.planId;
              return (
                <li
                  key={plan.planId}
                  className="bubble flex flex-col gap-2 p-4"
                >
                  <p className="text-base font-medium text-[var(--text)]">
                    {plan.displayName}
                  </p>
                  <dl className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                    {Object.entries(plan.capabilities).map(
                      ([capability, allowance]) => (
                        <div key={capability} className="flex gap-1">
                          <dt>{capabilityCopy[capability] ?? capability}</dt>
                          <dd className="text-[var(--text)]">{allowance}</dd>
                        </div>
                      ),
                    )}
                  </dl>
                  {current ? (
                    <div className="mt-auto pt-2">
                      <Button variant="secondary" size="sm" disabled>
                        Current plan
                      </Button>
                    </div>
                  ) : portalManaged ? null : (
                    <div className="mt-auto pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          navigate(plan.planId, () =>
                            beginBillingCheckout(workspaceId, plan.planId),
                          )
                        }
                      >
                        {opening(plan.planId) ? "Opening…" : "Choose plan"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <FormError message={error} />
    </div>
  );
}
