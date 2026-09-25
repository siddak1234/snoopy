"use client";

import { useState } from "react";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import {
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

export default function DeleteAccountButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirmDelete() {
    setLoading(true);
    setError(null);
    try {
      await platformApiJson<void>("/v1/account", {
        method: "DELETE",
      });
    } catch (caught) {
      // 409 is a partial deletion, relayed as 409 rather than 200 so a client
      // cannot tell a person their data is gone while some of it remains. The
      // account is still here and the session still valid; nothing to sign out.
      if (caught instanceof PlatformApiError && caught.status === 409) {
        setError(RETRY_COPY);
        setLoading(false);
        return;
      }
      // 502 is the contract's "deleted, but the identity provider could not be
      // reached to revoke the session": the account is gone. Leave as on 200 —
      // a retry would be a DELETE for an account that no longer exists.
      if (!(caught instanceof PlatformApiError && caught.status === 502)) {
        setError(
          caught instanceof PlatformApiError
            ? caught.message
            : "Something went wrong. Please try again.",
        );
        setLoading(false);
        return;
      }
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
    setError(null);
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
          <FormError message={error} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={loading}
              className="rounded-full border border-[var(--error-border-strong)] bg-[var(--error-bg)] px-4 py-2 text-sm font-medium text-[var(--error-text)] transition hover:bg-[var(--error-bg-strong)] disabled:opacity-50"
            >
              {loading
                ? "Deleting…"
                : error
                  ? "Try again"
                  : "Yes, delete my account"}
            </button>
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
