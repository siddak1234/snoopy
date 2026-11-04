"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { unlinkRefusal } from "@/components/account/LinkedAccountsSection";
import {
  JOIN_OUTSIDE_DOMAIN,
  OUTSIDE_SIGN_IN_NEXT,
  removeSignIn,
  type OutsideSignIn as Provider,
} from "@/lib/domain-only";
import { loginHref, platformApiJson, sessionEnded } from "@/lib/platform-api";
import { PAGE_CARD, SPACING } from "@/lib/spacing";

/**
 * The account area when the active workspace is a domain-only organization
 * that refuses this person at session resolve (backend §12.1 #221, option
 * b′): its words, then "Remove {provider} sign-in" for each sign-in outside
 * its verified domains. A press removes that sign-in (`unlinkLoginIdentity`,
 * as Settings' linked accounts do) and reads the area again; a refusal is
 * said in Settings' words; nothing is removed until a press.
 * Stage 2 (BUILD-PLAN 29.4.6; §12.1 #221): the platform does not send this before Stage 2.
 */
export function OutsideSignIn({ providers }: { providers: Provider[] }) {
  const router = useRouter();
  const [removing, setRemoving] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = async (provider: Provider) => {
    setRemoving(provider);
    setError(null);
    try {
      await platformApiJson(`/v1/auth/identities/${provider}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch (caught) {
      if (sessionEnded(caught)) {
        window.location.assign(loginHref("/account"));
        return;
      }
      setError(unlinkRefusal(caught));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section
      aria-labelledby="outside-sign-in-title"
      data-testid="outside-sign-in"
      className={`bubble mx-auto ${SPACING.group.top} flex max-w-lg flex-col ${SPACING.inner.gap} ${PAGE_CARD}`}
    >
      <h1
        id="outside-sign-in-title"
        className="text-xl font-medium text-[var(--text)]"
      >
        {JOIN_OUTSIDE_DOMAIN}
      </h1>
      <p className="text-sm text-[var(--muted)]">{OUTSIDE_SIGN_IN_NEXT}</p>
      <div className={`flex flex-wrap ${SPACING.inner.gap}`}>
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="primary"
            size="sm"
            disabled={removing !== null}
            onClick={() => void remove(provider)}
          >
            {removeSignIn(provider)}
          </Button>
        ))}
      </div>
      <FormError message={error} />
    </section>
  );
}
