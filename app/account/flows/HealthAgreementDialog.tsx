"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import {
  ACCEPT_AND_START,
  ACCEPT_AND_TURN_ON,
  AGREEMENT_TITLE,
  SIGNER_NAME,
  SIGNER_TITLE,
  STARTING,
  TURNING_ON,
  acceptThenRepeat,
  agreementVersion,
  authorizedToSign,
  type AgreementOffer,
} from "@/lib/health-agreement";
import { SPACING } from "@/lib/spacing";
import { acceptHealthAgreement } from "./agreement-actions";

/**
 * The health data agreement, for the workspace's owner, when Start run, an
 * item's upload (which starts a run) or Turn on on a flow's own page, of a
 * flow that carries health data, was refused 403 `agreement_required`
 * (backend ADR-0049, C3; amendment 2): one dialog — its title, "Version {n}",
 * the text to scroll, "I'm authorized to sign for {organization}", Full name
 * and Title, and "Accept and start run" ("Accept and turn on" for a turn-on,
 * `purpose`), which accepts and then sends the run, the item or the turn-on
 * again. The caller sends a run or an item again with the key the refused
 * request carried (a refused run or item recorded none), so a lost answer
 * starts nothing twice. Set up's turn-on asks in its
 * own "Contract and accept" section instead (`ContractStep.tsx`), and an Add
 * is no longer refused (ADR-0049 amendment 2; ~~"Accept and add flow"~~
 * until builds 37 and 39, wave 2). Accepted once: a
 * press after the repeat was refused sends the repeat alone, never a second
 * acceptance; a newer version opens a new dialog (`key` by its hash). Anyone
 * else gets the caller's one line (`ASK_OWNER`) and no dialog. Words:
 * `lib/health-agreement.ts`, the app's too.
 */
export function HealthAgreementDialog({
  offer,
  workspaceId,
  onAccepted,
  onClose,
  purpose = "run",
}: {
  offer: AgreementOffer;
  /** The workspace the page shows; the acceptance is refused once it is not active. */
  workspaceId: string;
  /** Sends the run, the item or the turn-on again: its refusal in words, or null once it went. */
  onAccepted: () => Promise<string | null>;
  onClose: () => void;
  /** What the button does once accepted: start the run (or the item's), or turn the flow on. */
  purpose?: "run" | "turn-on";
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
            {purpose === "turn-on"
              ? pending
                ? TURNING_ON
                : ACCEPT_AND_TURN_ON
              : pending
                ? STARTING
                : ACCEPT_AND_START}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
