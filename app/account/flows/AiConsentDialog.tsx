"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import {
  AI_CONSENT,
  POLICY_AFTER_LINK,
  POLICY_BEFORE_LINK,
} from "./ai-consent";

/**
 * The question asked before a run whose input carries a file starts
 * (`ai-consent.ts`), in the app's words. A confirmation like Delete account's
 * and Replace account's, opened over the Run window, which stays open beneath
 * it with everything typed and chosen: Cancel — or Escape, or a click outside —
 * starts nothing and keeps nothing, and the Run window is as it was. Only this
 * dialog answers the keyboard while it is open (`components/ui/Modal.tsx`).
 *
 * The Privacy Policy opens in a new tab, as the app opens it in the browser, so
 * reading it does not throw away the run being started.
 */
export function AiConsentDialog({
  subscriptionId,
  onAgree,
  onCancel,
}: {
  subscriptionId: string;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const id = `automation-ai-consent-${subscriptionId}`;
  return (
    <Modal
      onClose={onCancel}
      bubble
      ariaLabelledBy={`${id}-title`}
      ariaDescribedBy={`${id}-body ${id}-policy`}
      zIndex={110}
    >
      <h2
        id={`${id}-title`}
        className="text-xl font-semibold text-[var(--text)]"
      >
        {AI_CONSENT.title}
      </h2>
      <p id={`${id}-body`} className="mt-1 text-sm text-[var(--muted)]">
        {AI_CONSENT.body}
      </p>
      <p id={`${id}-policy`} className="mt-2 text-sm text-[var(--muted)]">
        {POLICY_BEFORE_LINK}
        <Link
          prefetch={false}
          href={AI_CONSENT.policyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline underline-offset-2"
        >
          {AI_CONSENT.policyLink}
        </Link>
        {POLICY_AFTER_LINK}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {AI_CONSENT.cancel}
        </Button>
        <Button type="button" onClick={onAgree}>
          {AI_CONSENT.agree}
        </Button>
      </div>
    </Modal>
  );
}
