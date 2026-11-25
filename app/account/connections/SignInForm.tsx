"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { OfferedProvider } from "@/lib/connections";
import {
  EHR_REPLACE,
  accountMismatch,
  postedCredentials,
  signInLabel,
  vendorField,
} from "@/lib/smart-backend";
import { SPACING } from "@/lib/spacing";
import { KeyFields } from "./KeyFields";
import { startConnect } from "./start-connect";

/**
 * An EHR sign-in's form (backend ADR-0054: `authType` `smart-launch`), in
 * `ConnectionsPanel`'s Connect and in a flow step's vendor rows on Set up
 * (`VendorRows`): the key form's fields (`KeyFields` — the vendor, picked
 * only from two or more, then the clinic's FHIR address and its help), and
 * one button named by the vendor chosen, "Sign in with Epic"
 * (`signInLabel`). Pressed, the platform is asked to begin with them as
 * `credentials`, as an OAuth connect begins (`startConnect`), and the browser
 * goes to the EHR's own sign-in page; it comes back through the same return
 * (`app/connections/page.tsx`), and on to `returnTo` when it was started on a
 * flow's page. A refusal is said here in the spec's words, what was typed
 * kept. The 409 `account_mismatch` — another address than the workspace's
 * sign-in — asks "Replace it?" while the live connection is known
 * (`replaces`), and Replace begins again with what the form holds now,
 * naming it; any change to a field takes the question back. Not known, it
 * says the first sentence alone and the connections are read again
 * (`onReread`), which brings the question (the session's D3, Round 22).
 */
export function SignInForm({
  provider,
  workspaceId,
  replaces,
  returnTo,
  onAlready,
  onCancel,
  onReread,
}: {
  provider: OfferedProvider;
  /** The workspace this page shows; the begin is refused once it is not active. */
  workspaceId: string;
  /** The workspace's connection to this provider, which Replace names; none, no Replace. */
  replaces?: string;
  /** Where a sign-in started here comes back to: a flow's page, or its Set up. */
  returnTo?: string;
  /** The platform reused the live sign-in, as whom. */
  onAlready: (connectedAs: string) => void;
  onCancel: () => void;
  /** Read the workspace's connections again: a 409 named one this page does not know. */
  onReread: () => void;
}) {
  const fixed = vendorField(provider);
  const [vendor, setVendor] = useState<string | null>(
    fixed?.kind === "fixed" ? fixed.id : null,
  );
  const [error, setError] = useState<string | null>(null);
  // The 409 `account_mismatch`, for the values the form holds now.
  const [mismatch, setMismatch] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  /** Begins with what the form holds now; Replace names the live connection. */
  const begin = (replaceConnectionId?: string) => {
    if (!form.current) return;
    const credentials = postedCredentials(new FormData(form.current));
    setError(null);
    setMismatch(false);
    startTransition(async () => {
      const started = await startConnect(
        workspaceId,
        provider.providerId,
        returnTo,
        {
          credentials,
          ...(replaceConnectionId ? { replaceConnectionId } : {}),
        },
      );
      if (started.status === "already") onAlready(started.connectedAs);
      if (started.status !== "refused") return;
      if (started.replaceable) {
        // A field changed while the begin was asked: Replace answers the values refused, so
        // a 409 for values the form no longer holds offers nothing (the session's D3).
        const now = form.current
          ? JSON.stringify(postedCredentials(new FormData(form.current)))
          : null;
        if (now !== JSON.stringify(credentials)) return;
        setMismatch(true);
        if (!replaces) onReread();
        return;
      }
      setError(started.message);
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Drawn in a dialog over Set up's own form: this submit is this form's alone.
    event.stopPropagation();
    begin();
  };

  return (
    <form
      ref={form}
      onSubmit={submit}
      onChange={(event) => {
        event.stopPropagation();
        const picked = new FormData(event.currentTarget).get(
          "credential:vendor",
        );
        setVendor(typeof picked === "string" ? picked : null);
        // Replace answers the values refused, never others.
        setMismatch(false);
      }}
      className={`${SPACING.group.top} flex flex-col ${SPACING.group.gap}`}
    >
      <KeyFields provider={provider} />
      <FormError
        message={mismatch ? accountMismatch(Boolean(replaces)) : error}
      />
      <div className={`flex flex-wrap ${SPACING.inner.gap}`}>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        {mismatch && replaces ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => begin(replaces)}
          >
            {EHR_REPLACE}
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Working…" : signInLabel(provider.vendors, vendor)}
        </Button>
      </div>
    </form>
  );
}
