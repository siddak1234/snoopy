"use client";

import { useId } from "react";
import { FormInput } from "@/components/ui/FormInput";
import { NumberedStep } from "@/components/ui/NumberedStep";
import { formatDateMediumUTC } from "@/lib/date";
import {
  AGREEMENT_FINALIZING,
  AGREEMENT_TITLE,
  AGREEMENT_UNAVAILABLE,
  ASK_OWNER,
  CONTRACT_STEP,
  SIGNER_NAME,
  SIGNER_TITLE,
  agreementAccepted,
  authorizedToSign,
  fillForDisplay,
  signerLine,
  type ContractState,
} from "@/lib/health-agreement";
import { SPACING } from "@/lib/spacing";

/** What Set up's server read of the health data agreement (`page.tsx`). */
export type ContractView = {
  /** Never `hidden`: the section is drawn only for a flow that carries health data. */
  state: Exclude<ContractState, "hidden">;
  /** The workspace's name: who signs, and the text's `{Covered Entity}`. */
  organization: string;
  /** The text the owner reads and signs, as read (`sign` only). */
  offer: { version: number; text: string; sha256: string } | null;
  /** The workspace's acceptance of the current version (`accepted` only). */
  acceptance: {
    version: number;
    signerName: string;
    signerTitle: string;
    acceptedAt: string;
  } | null;
  /** Today, as the server read it: the text's `{Effective date}`. */
  today: string;
};

/** The owner's signature, held by the form: the box and the two fields. */
export type ContractSigned = {
  authorized: boolean;
  name: string;
  title: string;
};

/**
 * Set up's "Contract and accept" (the owner's item 9 of builds 37 and 39:
 * "Where is the BAA contract to view prefilled and checkmark to accept below
 * it … 4. Contract and accept"; backend ADR-0049 amendment 2): the numbered
 * section after the flow's own, drawn as they are (`NumberedStep`), for a
 * flow that carries health data. By its state (`contractStep`): "The
 * agreement is being finalized."; "Accepted · Version {n} · {date}" and the
 * signer; for the workspace's owner, the text to scroll — its `{Covered
 * Entity}` the workspace's name and its `{Effective date}` today
 * (`fillForDisplay`, display only) — then "I'm authorized to sign for
 * {organization}", Full name and Title; for anyone else, the line asking the
 * owner; a read that failed, "Unavailable". Its fields are the form's
 * (`SetupForm`), whose Turn on accepts, then turns the flow on.
 */
export function ContractStep({
  index,
  view,
  signed,
  onSigned,
}: {
  index: number;
  view: ContractView;
  signed: ContractSigned;
  onSigned: (signed: ContractSigned) => void;
}) {
  const id = useId();
  const line = (words: string) => (
    <p className="text-sm text-[var(--muted)]">{words}</p>
  );
  return (
    <div
      role="group"
      aria-label={CONTRACT_STEP}
      data-testid="setup-contract"
      className={`flex flex-col ${SPACING.group.gap}`}
    >
      <NumberedStep index={index} title={CONTRACT_STEP} />
      {view.state === "finalizing" ? line(AGREEMENT_FINALIZING) : null}
      {view.state === "unavailable" ? line(AGREEMENT_UNAVAILABLE) : null}
      {view.state === "ask-owner" ? line(ASK_OWNER) : null}
      {view.state === "accepted" && view.acceptance ? (
        <div className={`flex flex-col ${SPACING.inner.gap}`}>
          <p className="text-sm text-[var(--text)]">
            {agreementAccepted(
              view.acceptance.version,
              formatDateMediumUTC(view.acceptance.acceptedAt),
            )}
          </p>
          {line(
            signerLine(view.acceptance.signerName, view.acceptance.signerTitle),
          )}
        </div>
      ) : null}
      {view.state === "sign" && view.offer ? (
        <>
          {/* The text to scroll, reachable by the keyboard: the dialog's look. */}
          <div
            role="region"
            aria-label={AGREEMENT_TITLE}
            tabIndex={0}
            data-testid="setup-agreement-text"
            className={`max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--ring)] ${SPACING.card.all} text-sm whitespace-pre-wrap text-[var(--text)]`}
          >
            {fillForDisplay(view.offer.text, view.organization, view.today)}
          </div>
          <label
            className={`flex items-center ${SPACING.inner.gap} text-sm text-[var(--text)]`}
          >
            <input
              type="checkbox"
              checked={signed.authorized}
              onChange={(event) =>
                onSigned({ ...signed, authorized: event.target.checked })
              }
              className="size-4 rounded border-[var(--color-divider)] accent-[var(--color-accent)]"
            />
            <span>{authorizedToSign(view.organization)}</span>
          </label>
          <FormInput
            id={`${id}-name`}
            label={SIGNER_NAME}
            value={signed.name}
            onChange={(event) =>
              onSigned({ ...signed, name: event.target.value })
            }
            maxLength={120}
            autoComplete="name"
          />
          <FormInput
            id={`${id}-signer-title`}
            label={SIGNER_TITLE}
            value={signed.title}
            onChange={(event) =>
              onSigned({ ...signed, title: event.target.value })
            }
            maxLength={120}
            autoComplete="organization-title"
          />
        </>
      ) : null}
    </div>
  );
}
