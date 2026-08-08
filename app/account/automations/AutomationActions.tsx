"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { SubscriptionStatus } from "@/lib/automations";
import {
  setSubscriptionStatus,
  subscribeToAutomation,
  triggerRun,
  type ActionResult,
} from "./actions";

/**
 * The buttons on an automation card.
 *
 * A client component only because it holds pending state and the last refusal.
 * The work happens in server actions, so nothing here knows the backend origin
 * and no fetch call is written by hand.
 *
 * A refusal is shown rather than swallowed. "Add" can fail because the
 * subscription already exists, and "Go live" can fail because a connection is
 * unmet — both are answers a person needs, not console noise.
 */
export function AutomationActions({
  templateId,
  available,
  subscription,
}: {
  templateId: string;
  available: boolean;
  subscription: {
    id: string;
    status: SubscriptionStatus;
    canGoLive: boolean;
  } | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (
    action: (data: FormData) => Promise<ActionResult>,
    data: FormData,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) setError(result.error);
    });
  };

  const field = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  };

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!subscription ? (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !available}
            onClick={() => submit(subscribeToAutomation, field({ templateId }))}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        ) : (
          <>
            {subscription.status !== "live" ? (
              <Button
                variant="primary"
                size="sm"
                disabled={pending || !subscription.canGoLive || !available}
                onClick={() =>
                  submit(
                    setSubscriptionStatus,
                    field({ subscriptionId: subscription.id, status: "live" }),
                  )
                }
              >
                {pending ? "Working…" : "Go live"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  submit(
                    setSubscriptionStatus,
                    field({
                      subscriptionId: subscription.id,
                      status: "paused",
                    }),
                  )
                }
              >
                {pending ? "Working…" : "Pause"}
              </Button>
            )}

            {/* Only a live subscription can be run. The server refuses otherwise,
                and offering a button that is certain to fail is worse than not
                offering it. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || subscription.status !== "live"}
              onClick={() =>
                submit(triggerRun, field({ subscriptionId: subscription.id }))
              }
            >
              Run now
            </Button>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
