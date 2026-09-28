"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import type { IssuedWebhookEndpoint, WebhookEndpoint } from "@/lib/automations";
import { formatDateMediumUTC } from "@/lib/date";
import { issueWebhookAddress, readWebhookAddress } from "./webhook-actions";

/**
 * Where a vendor sends the events that start this automation (backend §12.1
 * #91, #109). Owner or admin only; the page renders this for no one else.
 *
 * The secret is shown once, in this dialog, when it is made — the platform
 * keeps only its hash — and is forgotten when the dialog closes. Making a new
 * one keeps the address and stops the old secret at once, so the vendor's
 * settings must be updated before its next delivery.
 */
export function WebhookAddressButton({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<WebhookEndpoint | null | undefined>(
    undefined,
  );
  const [issued, setIssued] = useState<IssuedWebhookEndpoint | null>(null);
  const titleId = `webhook-${subscriptionId}-title`;

  const show = () => {
    setError(null);
    setIssued(null);
    setOpen(true);
    startTransition(async () => {
      const result = await readWebhookAddress(subscriptionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEndpoint(result.endpoint);
    });
  };

  const issue = () => {
    setError(null);
    startTransition(async () => {
      const result = await issueWebhookAddress(subscriptionId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIssued(result.issued);
      setEndpoint({
        endpointId: result.issued.endpointId,
        createdAt: result.issued.createdAt,
        ...(result.issued.url ? { url: result.issued.url } : {}),
      });
    });
  };

  const close = () => {
    setOpen(false);
    // The secret goes with the dialog: it is not kept anywhere once shown.
    setIssued(null);
  };

  const address = issued?.url ?? endpoint?.url;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={show}>
        Webhook address
      </Button>
      {open ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy={titleId}
          ariaDescribedBy={`${titleId}-desc`}
          zIndex={100}
          // Held open while a secret is being made: the platform stops the old
          // one when it answers, and the new one exists only in that answer.
          dismissible={!pending}
        >
          <h2 id={titleId} className="text-xl font-semibold text-[var(--text)]">
            Webhook address
          </h2>
          <p
            id={`${titleId}-desc`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Give this address and secret to the service that sends the events.
            It sends the secret as the <code>x-autom8x-webhook-secret</code>{" "}
            header.
          </p>
          {endpoint === undefined && !error ? (
            <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
          ) : null}
          {address ? (
            <p className="mt-4 text-sm break-all text-[var(--text)]">
              <span className="block text-xs text-[var(--muted)]">Address</span>
              <code>{address}</code>
            </p>
          ) : null}
          {endpoint && !address ? (
            <p className="mt-4 text-sm text-[var(--text)]">
              Address id <code>{endpoint.endpointId}</code>
            </p>
          ) : null}
          {endpoint?.lastDeliveryAt ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Last delivery {formatDateMediumUTC(endpoint.lastDeliveryAt)}
              {endpoint.lastOutcome
                ? `: ${endpoint.lastOutcome.replaceAll("_", " ")}`
                : ""}
            </p>
          ) : null}
          {/* Said once it arrives — the secret itself is only shown, never
              announced. Empty while a request is pending, so a second secret
              is a change the region announces again. */}
          <p role="status" className="sr-only">
            {issued && !pending
              ? "A new secret was made. Copy it now: it is shown this once."
              : ""}
          </p>
          {issued ? (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ring)] p-3">
              <p className="text-xs text-[var(--muted)]">
                Secret — shown this once. Copy it now.
              </p>
              <code className="mt-1 block text-sm break-all text-[var(--text)]">
                {issued.secret}
              </code>
            </div>
          ) : null}
          {endpoint === null ? (
            <p className="mt-4 text-sm text-[var(--muted)]">
              This automation has no address yet.
            </p>
          ) : null}
          <FormError message={error} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={pending}
            >
              Close
            </Button>
            {endpoint !== undefined ? (
              <Button type="button" onClick={issue} disabled={pending}>
                {pending
                  ? "Working…"
                  : endpoint === null
                    ? "Create address"
                    : "Make a new secret"}
              </Button>
            ) : null}
          </div>
          {endpoint ? (
            <p className="mt-3 text-xs text-[var(--muted)]">
              A new secret keeps the address and stops the old secret at once.
            </p>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
