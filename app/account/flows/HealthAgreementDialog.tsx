"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import {
  ACCEPT_AND_ADD,
  ACCEPT_AND_START,
  ADDING,
  AGREEMENT_TITLE,
  SIGNER_NAME,
  SIGNER_TITLE,
  STARTING,
  acceptThenRepeat,
  agreementVersion,
  authorizedToSign,
  type AgreementOffer,
} from "@/lib/health-agreement";
import { SPACING } from "@/lib/spacing";
import { acceptHealthAgreement } from "./agreement-actions";

/**
 * The health data agreement, for the workspace's owner, when Add, Start run
 * or an item's upload (which starts a run) of a flow that carries health data
 * was refused 403 `agreement_required` (backend ADR-0049, C3): one dialog —
 * its title, "Version {n}", the text to scroll, "I'm authorized to sign for
 * {organization}", Full name and Title, and the button that accepts and then
 * sends the add, the run or the item again ("Accept and add flow", "Accept
 * and start run"). The caller sends it again with the key the refused request
 * carried (a refused add, run or item recorded none), so a lost answer starts
 * nothing twice. Accepted once: a
 * press after the repeat was refused sends the repeat alone, never a second
 * acceptance; a newer version opens a new dialog (`key` by its hash). Anyone
 * else gets the caller's one line (`ASK_OWNER`) and no dialog. Words:
 * `lib/health-agreement.ts`, the app's too.
 */
export function HealthAgreementDialog({
  offer,
  workspaceId,
  purpose,
  onAccepted,
  onClose,
}: {
  offer: AgreementOffer;
  /** The workspace the page shows; the acceptance is refused once it is not active. */
  workspaceId: string;
  /** What the button does once accepted: add the flow, or start the run. */
  purpose: "add" | "run";
  /** Sends the add or the run again: its refusal in words, or null once it went. */
  onAccepted: () => Promise<string | null>;
  onClose: () => void;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  // One acceptance per opening: a retry after a lost answer signs once.
  const [agreementKey] = useState(() => `agreement-${crypto.randomUUID()}`);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspaceId);
    setError(null);
    startTransition(async () => {
      // Accepted once per opening (`acceptThenRepeat`): a press after the
      // repeat was refused sends the repeat alone.
      const pressed = await acceptThenRepeat(
        accepted,
        () => acceptHealthAgreement(data),
        onAccepted,
      );
      setAccepted(pressed.accepted);
      setError(pressed.error);
    });
  };

  return (
    <Modal
      onClose={onClose}
      bubble
      ariaLabelledBy={`${id}-title`}
      ariaDescribedBy={`${id}-version`}
      zIndex={100}
      dismissible={!pending}
    >
      <h2
        id={`${id}-title`}
        className="text-xl font-semibold text-[var(--text)]"
      >
        {AGREEMENT_TITLE}
      </h2>
      <p
        id={`${id}-version`}
        className={`${SPACING.title.top} text-sm text-[var(--muted)]`}
      >
        {agreementVersion(offer.version)}
      </p>
      <form
        data-testid="agreement-form"
        onSubmit={submit}
        className={`${SPACING.group.top} flex flex-col ${SPACING.group.gap}`}
      >
        <input type="hidden" name="version" value={offer.version} />
        <input type="hidden" name="sha256" value={offer.sha256} />
        <input type="hidden" name="agreementKey" value={agreementKey} />
        {/* The text to scroll, reachable by the keyboard. */}
        <div
          role="region"
          aria-label={AGREEMENT_TITLE}
          tabIndex={0}
          data-testid="agreement-text"
          className={`max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--ring)] ${SPACING.card.all} text-sm whitespace-pre-wrap text-[var(--text)]`}
        >
          {offer.text}
        </div>
        <label
          className={`flex items-center ${SPACING.inner.gap} text-sm text-[var(--text)]`}
        >
          <input
            name="authorized"
            type="checkbox"
            value="true"
            required
            className="size-4 rounded border-[var(--color-divider)] accent-[var(--color-accent)]"
          />
          <span>{authorizedToSign(offer.organization)}</span>
        </label>
        <FormInput
          id={`${id}-name`}
          name="signerName"
          label={SIGNER_NAME}
          required
          maxLength={120}
          autoComplete="name"
        />
        <FormInput
          id={`${id}-signer-title`}
          name="signerTitle"
          label={SIGNER_TITLE}
          required
          maxLength={120}
          autoComplete="organization-title"
        />
        <FormError message={error} />
        <div className={`flex flex-wrap ${SPACING.inner.gap}`}>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {purpose === "add"
              ? pending
                ? ADDING
                : ACCEPT_AND_ADD
              : pending
                ? STARTING
                : ACCEPT_AND_START}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
