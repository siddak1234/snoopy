"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import type { OfferedProvider } from "@/lib/connections";
import {
  EHR_REPLACE,
  postedCredentials,
  signInLabel,
  vendorField,
} from "@/lib/smart-backend";
import { SPACING } from "@/lib/spacing";
import { KeyFields } from "./KeyFields";
import { startConnect } from "./start-connect";

/**
 * An EHR sign-in's form (backend ADR-0054: `authType` `smart-launch`), in
 * `ConnectionsPanel`'s Connect: the key form's fields (`KeyFields` — the
 * vendor, picked only from two or more, then the clinic's FHIR address and its
 * help), and one button named by the vendor chosen, "Sign in with Epic"
 * (`signInLabel`). Pressed, the platform is asked to begin with them as
 * `credentials`, as an OAuth connect begins (`startConnect`), and the browser
 * goes to the EHR's own sign-in page; it comes back through the same return
 * (`app/connections/page.tsx`). A refusal is said here in the spec's words,
 * what was typed kept; the 409 `account_mismatch` — another address than the
 * workspace's sign-in — asks "Replace it?", and Replace begins again naming
 * the live connection (`replaces`).
 */
export function SignInForm({
  provider,
  workspaceId,
  replaces,
  returnTo,
  onAlready,
  onCancel,
}: {
  provider: OfferedProvider;
  /** The workspace this page shows; the begin is refused once it is not active. */
  workspaceId: string;
  /** The workspace's connection to this provider, which Replace names; none, no Replace. */
  replaces?: string;
  /** Where a sign-in started here comes back to: a flow's page. */
  returnTo?: string;
  /** The platform reused the live sign-in, as whom. */
  onAlready: (connectedAs: string) => void;
  onCancel: () => void;
}) {
  const fixed = vendorField(provider);
  const [vendor, setVendor] = useState<string | null>(
    fixed?.kind === "fixed" ? fixed.id : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [replaceable, setReplaceable] = useState(false);
  // What the refused begin sent, which Replace sends again.
  const [sent, setSent] = useState<Record<string, string> | null>(null);
  const [pending, startTransition] = useTransition();

  const begin = (
    credentials: Record<string, string>,
    replaceConnectionId?: string,
  ) => {
    setError(null);
    setReplaceable(false);
    setSent(credentials);
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
      if (started.status === "refused") {
        setError(started.message);
        setReplaceable(Boolean(started.replaceable));
      }
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    begin(postedCredentials(new FormData(event.currentTarget)));
  };

  return (
    <form
      onSubmit={submit}
      onChange={(event) => {
        const picked = new FormData(event.currentTarget).get(
          "credential:vendor",
        );
        setVendor(typeof picked === "string" ? picked : null);
      }}
      className={`${SPACING.group.top} flex flex-col ${SPACING.group.gap}`}
    >
      <KeyFields provider={provider} />
      <FormError message={error} />
      <div className={`flex flex-wrap ${SPACING.inner.gap}`}>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
        {replaceable && replaces && sent ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => begin(sent, replaces)}
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
