"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import { saveAiDocumentReading } from "@/app/account/ai-consent-actions";
import {
  AI_CONSENT,
  POLICY_AFTER_LINK,
  POLICY_BEFORE_LINK,
} from "@/lib/ai-consent";

/**
 * "AI reads your documents" (spec §3.G; backend ADR-0038): Allow or Not now,
 * saved on the account. Shown by the account area once, while the account has
 * never answered — after sign-in, to a new account and an existing one alike —
 * and by Start run over the Run window when a run with a file would otherwise
 * start unasked (§3.H).
 *
 * Escape or a click outside closes it and saves nothing, so it asks again next
 * time; while an answer is being saved it holds, and a refusal is said inside
 * it. The Privacy Policy opens in a new tab, so reading it loses nothing.
 */
export function AiConsentCard({
  id = "ai-consent",
  onClose,
  onAnswered,
  zIndex = 100,
}: {
  id?: string;
  /** Closed without an answer. */
  onClose: () => void;
  /** Saved: the account's answer. */
  onAnswered: (choice: "allowed" | "declined") => void;
  zIndex?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const answer = (choice: "allowed" | "declined") => {
    setError(null);
    startTransition(async () => {
      const result = await saveAiDocumentReading(choice);
      if (!result.ok) {
        setError(AI_CONSENT.saveFailed);
        return;
      }
      onAnswered(choice);
      router.refresh();
    });
  };

  return (
    <Modal
      onClose={onClose}
      bubble
      ariaLabelledBy={`${id}-title`}
      ariaDescribedBy={`${id}-body ${id}-policy`}
      zIndex={zIndex}
      dismissible={!pending}
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
      <FormError message={error} className="mt-3" />
      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => answer("declined")}
        >
          {AI_CONSENT.notNow}
        </Button>
        <Button
          type="button"
          disabled={pending}
          onClick={() => answer("allowed")}
        >
          {AI_CONSENT.allow}
        </Button>
      </div>
    </Modal>
  );
}

const noSubscription = () => () => {};

/**
 * The account area's card (§3.G): drawn by `app/account/layout.tsx` while the
 * account has never answered, and gone once it has — or until the next visit,
 * when closed unanswered.
 */
export function AiConsentOnce() {
  const [open, setOpen] = useState(true);
  // Drawn once the page is in the browser: a dialog is a portal into the
  // document's body, which the server's render has no part of.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!open || !inBrowser) return null;
  return (
    <AiConsentCard
      onClose={() => setOpen(false)}
      onAnswered={() => setOpen(false)}
    />
  );
}
