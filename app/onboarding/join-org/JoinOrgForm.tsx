"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  cancelJoinRequestAction,
  joinOrgWorkspaceAction,
  createPersonalWorkspaceAction,
} from "@/app/onboarding/actions";
import { FormError } from "@/components/ui/FormError";

export function JoinOrgForm({
  workspaceId,
  workspaceName,
  requested,
}: {
  workspaceId: string;
  workspaceName: string;
  requested: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"join" | "skip" | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const router = useRouter();

  async function handleJoin() {
    setError(null);
    setPending("join");
    const result = await joinOrgWorkspaceAction(workspaceId);
    setPending(null);
    if (result.ok) {
      if (result.outcome === "joined") {
        router.push("/account");
      } else {
        setRequestId(result.requestId ?? null);
      }
    } else {
      setError(result.error);
    }
  }

  async function handleCancelRequest() {
    if (!requestId) return;
    setError(null);
    setPending("join");
    const result = await cancelJoinRequestAction(workspaceId, requestId);
    setPending(null);
    if (result.ok) {
      setRequestId(null);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  async function handleSkip() {
    setError(null);
    setPending("skip");
    const result = await createPersonalWorkspaceAction();
    setPending(null);
    if (result.ok) {
      router.push("/account");
    } else {
      setError(result.error);
    }
  }

  const busy = pending !== null;

  return (
    <div className="mt-6 space-y-3">
      <FormError message={error} />

      {requestId ? (
        <>
          <p className="text-sm text-[var(--muted)]">
            Your request was sent for approval.
          </p>
          <button
            type="button"
            onClick={handleCancelRequest}
            disabled={busy}
            className="btn-secondary inline-flex w-full justify-center px-5 disabled:opacity-60"
          >
            {pending === "join" ? "Cancelling…" : "Cancel request"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={handleJoin}
          disabled={busy || requested}
          className="btn-primary inline-flex w-full justify-center px-5 disabled:opacity-60"
        >
          {pending === "join"
            ? "Joining…"
            : requested
              ? "Request pending"
              : `Join ${workspaceName}`}
        </button>
      )}

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[var(--ring)]" />
        <span className="mx-3 shrink-0 text-xs text-[var(--muted)]">or</span>
        <div className="flex-grow border-t border-[var(--ring)]" />
      </div>

      <button
        type="button"
        onClick={handleSkip}
        disabled={busy}
        className="inline-flex w-full justify-center text-sm text-[var(--muted)] underline underline-offset-2 hover:text-[var(--text)] disabled:opacity-60"
      >
        {pending === "skip"
          ? "Setting up…"
          : "No thanks, create a personal account instead"}
      </button>
    </div>
  );
}
