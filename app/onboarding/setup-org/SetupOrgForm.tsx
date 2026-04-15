"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createOrgWorkspaceAction,
  createPersonalWorkspaceAction,
} from "@/app/onboarding/actions";

const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60";

export function SetupOrgForm({ domain }: { domain: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "skip" | null>(null);
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending("create");
    const result = await createOrgWorkspaceAction(new FormData(e.currentTarget));
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
    <form onSubmit={handleCreate} className="mt-6 space-y-5">
      {/* Read-only domain pill */}
      <div>
        <label className="block text-sm font-medium text-[var(--text)]">
          Domain
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5">
          <span className="font-mono text-sm text-[var(--muted)]">{domain}</span>
          <span className="ml-auto shrink-0 rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--chip-text)]">
            from your email
          </span>
        </div>
      </div>

      {/* Org name */}
      <div>
        <label
          htmlFor="onboarding-org-name"
          className="block text-sm font-medium text-[var(--text)]"
        >
          Organization name
        </label>
        <input
          id="onboarding-org-name"
          name="name"
          type="text"
          required
          autoComplete="organization"
          placeholder="Acme Corp"
          disabled={busy}
          className={inputClass}
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="btn-primary inline-flex w-full justify-center px-5 disabled:opacity-60"
      >
        {pending === "create" ? "Creating…" : "Create organization"}
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
        {pending === "skip" ? "Setting up…" : "Skip — create a personal account instead"}
      </button>
    </form>
  );
}
