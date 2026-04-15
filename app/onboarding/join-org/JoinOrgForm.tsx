"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  joinOrgWorkspaceAction,
  createPersonalWorkspaceAction,
} from "@/app/onboarding/actions";

export function JoinOrgForm({ workspaceName }: { workspaceName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"join" | "skip" | null>(null);
  const router = useRouter();

  async function handleJoin() {
    setError(null);
    setPending("join");
    const result = await joinOrgWorkspaceAction();
    setPending(null);
    if (result.ok) {
      router.push("/account");
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
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleJoin}
        disabled={busy}
        className="btn-primary inline-flex w-full justify-center px-5 disabled:opacity-60"
      >
        {pending === "join" ? "Joining…" : `Join ${workspaceName}`}
      </button>

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
        {pending === "skip" ? "Setting up…" : "No thanks, create a personal account instead"}
      </button>
    </div>
  );
}
