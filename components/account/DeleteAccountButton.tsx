"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import {
  loginHref,
  PlatformApiError,
  platformApiJson,
  signOutFromPlatform,
} from "@/lib/platform-api";

/**
 * Account deletion, as ADR-0028 defines it: a workspace is removed only with
 * its owner's account, so this is where the personal workspace and every
 * organization this person alone owns go — including organizations other people
 * belong to, who lose them. An organization with another owner is kept; this
 * person simply leaves it. Deletion runs one workspace at a time and is not
 * all-or-nothing across them: a refusal answers 409 and leaves the account in
 * place while workspaces removed earlier in the same call are already gone, and
 * a retry resumes. The copy below promises no more than the route does.
 */

const RETRY_COPY =
  "Some of your workspaces could not be removed, so your account is still here. Anything already removed is gone. You can try again.";
const UNKNOWN_COPY =
  "The platform could not complete this request, so it is not known whether your account was removed. You can try again.";
const EXPIRED_COPY =
  "Your session ended, so this attempt did not run. Sign in again to come back here.";
const EXPIRED_AFTER_UNKNOWN_COPY =
  "Your session ended, and your account may already have been removed by the earlier attempt. Sign in again to check.";

// What an attempt came to, with the words to show for it: a session that
// ended, a refusal, or an answer that may have been lost. One value, so "Try
// again" and "Sign in again" cannot both be offered.
type Settled = { kind: "expired" | "failed" | "unknown"; message: string };
type Outcome = null | Settled;

// The words for what an attempt came to, in one place, by what the status
// says about whether the deletion ran:
// - 401: the session ended, so this attempt did not run — unless an earlier
//   attempt on this page ended unknown, in which case the session may have
//   ended BECAUSE that attempt finished, and the copy hedges.
// - 409: a partial deletion; the account is kept.
// - Any 5xx, or no answer at all: the server did not complete the request, so
//   whether the deletion ran is not known. That covers the Edge's own 502 —
//   the contract's "deleted, but not revoked" 502 is raised only for a bearer
//   caller (`apps/api/src/app.ts`: the throw needs `revoking`, undefined
//   without a bearer), so for this website it is the Access hop failing — and
//   whatever stands between this page and the Edge: the standalone server's
//   rewrite answers 500 when the Edge's answer is lost, a gateway 502 or 504.
//   The account is never read as gone.
// - Any other 4xx: a refusal, so the deletion did not run; the server's title.
function outcomeFor(
  failure: PlatformApiError | null,
  anAttemptWasLost: boolean,
): Settled {
  if (failure?.status === 401) {
    return {
      kind: "expired",
      message: anAttemptWasLost ? EXPIRED_AFTER_UNKNOWN_COPY : EXPIRED_COPY,
    };
  }
  if (failure?.status === 409) {
    return { kind: "failed", message: RETRY_COPY };
  }
  if (!failure || failure.status >= 500) {
    return { kind: "unknown", message: UNKNOWN_COPY };
  }
  return { kind: "failed", message: failure.message };
}

export default function DeleteAccountButton() {
  const pathname = usePathname();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  // Whether an attempt on this page ended unknown. It outlives the dialog —
  // closing and reopening does not make a lost answer less lost — so it is a
  // ref, not part of the outcome that Cancel clears.
  const anAttemptWasLost = useRef(false);

  // Focus goes back to the control that answers the outcome: the confirm
  // button ("Try again") after a refusal or a lost answer — it lost focus when
  // it was disabled mid-request — or the sign-in link that replaces it once the
  // session has ended. A keyboard or screen-reader user is never left on the
  // document body inside an open dialog. (React moves focus for `autoFocus`
  // only on form controls.)
  const confirmRef = useRef<HTMLButtonElement>(null);
  const signInRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (outcome?.kind === "expired") signInRef.current?.focus();
    else if (outcome) confirmRef.current?.focus();
  }, [outcome]);

  async function handleConfirmDelete() {
    setLoading(true);
    setOutcome(null);
    try {
      await platformApiJson<void>("/v1/account", {
        method: "DELETE",
      });
    } catch (caught) {
      // Nothing in here leaves the page or signs out: the account is still
      // here, or its fate is unknown — and the session is intact either way.
      const failure = caught instanceof PlatformApiError ? caught : null;
      const next = outcomeFor(failure, anAttemptWasLost.current);
      if (next.kind === "unknown") anAttemptWasLost.current = true;
      setOutcome(next);
      setLoading(false);
      return;
    }
    // Deleted. The Edge cleared the cookies on 200, so the sign-out is a
    // courtesy that must not turn a finished deletion into "try again".
    try {
      await signOutFromPlatform();
    } catch {
      /* the cookies are already cleared by the deletion */
    }
    window.location.replace("/login?deleted=1");
  }

  function close() {
    if (loading) return;
    setConfirmOpen(false);
    // A refusal is forgotten on close; an ended session is not — reopening
    // must not offer the destructive button to a session already known dead.
    // (A session restored elsewhere recovers through the sign-in link, whose
    // bounce reloads this page.)
    setOutcome((current) => (current?.kind === "expired" ? current : null));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="rounded-full border border-[var(--error-border-strong)] bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error-text)] transition hover:bg-[var(--error-bg-strong)] focus-visible:ring-2 focus-visible:ring-[var(--error-text)] focus-visible:outline-none"
      >
        Delete Account
      </button>

      {confirmOpen ? (
        <Modal onClose={close} ariaLabelledBy="delete-account-title" bubble>
          <h2
            id="delete-account-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Delete account?
          </h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            This removes your personal workspace and every organization you are
            the only owner of — including organizations other people belong to,
            who lose them and everything in them. Organizations that have
            another owner are kept; you just leave them.
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Workspaces are removed one at a time. If one cannot be removed, your
            account stays and you can try again; anything already removed stays
            removed. This cannot be undone.
          </p>
          <FormError message={outcome?.message ?? null} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-3">
            {outcome?.kind === "expired" ? (
              <Button
                ref={signInRef}
                href={loginHref(pathname)}
                variant="secondary"
                size="sm"
              >
                Sign in again
              </Button>
            ) : (
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirmDelete}
                disabled={loading}
                className="rounded-full border border-[var(--error-border-strong)] bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error-text)] transition hover:bg-[var(--error-bg-strong)] focus-visible:ring-2 focus-visible:ring-[var(--error-text)] focus-visible:outline-none disabled:opacity-50"
              >
                {loading
                  ? "Deleting…"
                  : outcome
                    ? "Try again"
                    : "Yes, delete my account"}
              </button>
            )}
            <button
              type="button"
              onClick={close}
              disabled={loading}
              className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
