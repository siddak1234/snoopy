"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { PurchasablePlan, WorkspaceBillingResponse } from "@/lib/billing";
import { formatPlanPrice } from "@/lib/plan-price";
import {
  beginBillingCheckout,
  openBillingPortal,
  type BillingActionResult,
} from "./actions";

/**
 * The billing surface: the plans, as cards, and the way to change one.
 *
 * A client component only because it holds pending state and the last refusal.
 * Checkout and the portal are hosted pages the browser navigates to; nothing
 * here renders a card field or any identifier that is not this platform's own
 * plan id.
 *
 * Three cards, side by side (the owner, build 9): Free, then the platform's
 * plans by price — each its name and its price, nothing more. Free is not on
 * the platform's list (a plan with no provider price is left off it), so its
 * card is drawn here, at no cost. So is Pro, until the platform lists it (the
 * owner, build 10): at the price the owner set, with no way to buy it — the
 * platform has nothing to sell under that name until its price exists — and
 * replaced by the platform's Pro once listed. Each card is its natural height
 * (build 10): name, price, the status line, no stretching. The workspace's own
 * plan, from its billing state, says Enrolled, with its status and when it
 * renews or ends.
 *
 * Buying and changing are different doors (ADR-0025 §1). A workspace with no
 * live subscription buys the plan it picks through checkout; one with a live
 * subscription changes or cancels it in the portal — a second checkout would
 * start a second subscription for the same workspace. The platform refuses one
 * (backend 24.12, `plan_exists`), and that refusal opens the portal too.
 */

// Free costs nothing, said as the formatter says every price.
const FREE_PRICE = { amount: 0, currency: "usd", interval: "month" } as const;
// The Free card's control: never a plan id, which the platform's list holds.
const FREE_CARD = "free-card";
// Pro, before the platform lists it: the owner's price (build 10), said as the
// formatter says every price. Drawn only while no listed plan is named Pro —
// the platform's own Pro, under any id, takes its place — and never a door to
// checkout or the portal, which have no Pro to offer yet.
const PRO_NAME = "Pro";
const PRO_PRICE = { amount: 1000, currency: "usd", interval: "month" } as const;

/** A plan's place among the cards: by price, one the provider left unstated last. */
function priceOrder(plan: PurchasablePlan): number {
  return plan.price?.amount ?? Number.MAX_SAFE_INTEGER;
}

function PlanCard({
  name,
  price,
  children,
}: {
  name: string;
  price: string;
  children?: ReactNode;
}) {
  // Compact (the owner, build 10): the card is as tall as its name, its price
  // and whatever its status adds — no minimum height, nothing pushed to the
  // bottom.
  return (
    <li className="bubble flex flex-col gap-1 p-4">
      <p className="text-lg font-medium text-[var(--text)]">{name}</p>
      <p className="text-2xl font-semibold text-[var(--text)]">{price}</p>
      {children ? (
        <div className="flex flex-col items-start gap-3 pt-3">{children}</div>
      ) : null}
    </li>
  );
}

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
  // The free floor reports no status; a plan whose access ended leaves the
  // workspace on Free too.
  const onFree = billing.status === undefined || accessEnded;
  // Whether the platform lists a Pro of its own, by the name a person reads:
  // its id is the platform's to choose, and the fixture's differs from
  // production's.
  const proListed = plans.some((plan) => plan.displayName === PRO_NAME);

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

  // The workspace's own plan: Enrolled, and — for a paid one — its status, when
  // it renews or ends, and Manage billing.
  const enrolled = (paid: boolean) => (
    <>
      <span className="inline-flex rounded-full bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--chip-text)]">
        Enrolled
      </span>
      {paid ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]">
          {billing.status ? <StatusPill status={billing.status} /> : null}
          {/* A period line only while access lasts: once it has ended, the
              pill says so, and a period end can lie in the future. */}
          {periodEnd && !accessEnded ? (
            <dl className="flex gap-1">
              <dt>{billing.cancelAtPeriodEnd ? "Ends" : "Renews"}</dt>
              <dd className="text-[var(--text)]">{periodEnd}</dd>
            </dl>
          ) : null}
        </div>
      ) : null}
      {portalManaged ? (
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
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      {needsCheckout ? (
        <p className="text-sm text-[var(--muted)]">
          {plans.length > 0
            ? "This workspace has no billing account yet. Choose a plan below to start one."
            : "This workspace has no billing account yet, and no plan can be bought right now."}
        </p>
      ) : null}
      {/* Side by side, each at its own height: a card is not stretched to
          the tallest in its row. */}
      <ul className="grid gap-4 md:grid-cols-3 md:items-start">
        <PlanCard name="Free" price={formatPlanPrice(FREE_PRICE) ?? ""}>
          {onFree ? (
            enrolled(false)
          ) : (
            // Back to Free is a cancellation: the portal's. Free is not a
            // provider price, so the portal cannot list it — said here (the
            // owner's build 13 decision 7c).
            <>
              <Button
                variant="primary"
                size="sm"
                disabled={busy}
                onClick={() =>
                  navigate(FREE_CARD, () => openBillingPortal(workspaceId))
                }
              >
                {opening(FREE_CARD) ? "Opening…" : "Choose plan"}
              </Button>
              <p className="mt-2 text-sm text-[var(--muted)]">
                To move to Free, cancel {billing.displayName} in Manage billing.
              </p>
            </>
          )}
        </PlanCard>
        {[...plans]
          .sort((a, b) => priceOrder(a) - priceOrder(b))
          .map((plan) => {
            const current = !accessEnded && plan.planId === billing.planId;
            return (
              <PlanCard
                key={plan.planId}
                name={plan.displayName}
                // The provider's own figure when it can state one flat amount
                // (ADR-0031); otherwise said, not guessed.
                price={
                  (plan.price && formatPlanPrice(plan.price)) ??
                  "Price shown at checkout"
                }
              >
                {current ? (
                  enrolled(true)
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      portalManaged
                        ? navigate(plan.planId, () =>
                            openBillingPortal(workspaceId),
                          )
                        : navigate(plan.planId, () =>
                            beginBillingCheckout(workspaceId, plan.planId),
                          )
                    }
                  >
                    {opening(plan.planId) ? "Opening…" : "Choose plan"}
                  </Button>
                )}
              </PlanCard>
            );
          })}
        {/* Pro, last — the dearest — while the platform has none to sell: its
            name and the owner's price, and no control, since a checkout for it
            would be refused and the portal cannot change to it. */}
        {proListed ? null : (
          <PlanCard name={PRO_NAME} price={formatPlanPrice(PRO_PRICE) ?? ""} />
        )}
      </ul>
      {plans.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No plans are available to purchase right now.
        </p>
      ) : null}

      <FormError message={error} />
    </div>
  );
}
