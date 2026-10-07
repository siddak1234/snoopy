"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createOrgWorkspaceAction,
  createPersonalWorkspaceAction,
} from "@/app/onboarding/actions";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";

export function SetupOrgForm({ domain }: { domain: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "skip" | null>(null);
  // The organization made when its domain claim was refused: pressed again,
  // the form claims on it and never makes a second one (backend §12.1 #186),
  // as the app's does.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // One idempotency key per intent, made at its first press and kept for every
  // press after it — a new name makes a new create — so a press after a lost
  // answer is answered with what was already made.
  const keys = useRef<{ create?: string; claim?: string }>({});
  const router = useRouter();

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending("create");
    const data = new FormData(e.currentTarget);
    data.set(
      "createKey",
      (keys.current.create ??= `workspace-create-${crypto.randomUUID()}`),
    );
    data.set(
      "claimKey",
      (keys.current.claim ??= `domain-claim-${crypto.randomUUID()}`),
    );
    if (createdId) data.set("workspaceId", createdId);
    const result = await createOrgWorkspaceAction(data);
    setPending(null);
    if (result.ok) {
      router.push("/account");
      return;
    }
    if (result.workspaceId) setCreatedId(result.workspaceId);
    setError(result.error);
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
    <form
      onSubmit={handleCreate}
      // A new name is a new organization, so a new key.
      onChange={() => {
        keys.current.create = undefined;
      }}
      className="mt-6 space-y-5"
    >
      {/* Read-only domain pill */}
      <div>
        <label className="block text-sm font-medium text-[var(--text)]">
          Domain
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5">
          <span className="font-mono text-sm text-[var(--muted)]">
            {domain}
          </span>
          <span className="ml-auto shrink-0 rounded-full bg-[var(--chip-bg)] px-2 py-0.5 text-xs font-medium text-[var(--chip-text)]">
            from your email
          </span>
        </div>
      </div>

      <FormInput
        id="onboarding-org-name"
        label="Organization name"
        name="name"
        type="text"
        required
        autoComplete="organization"
        placeholder="Acme Corp"
        // Once the organization is made its name is set: only the claim is left.
        disabled={busy || createdId !== null}
      />

      <FormError message={error} />

      <button
        type="submit"
        disabled={busy}
        className="btn-primary inline-flex w-full justify-center px-5 disabled:opacity-60"
      >
        {pending === "create"
          ? "Creating…"
          : createdId
            ? `Claim ${domain} again`
            : "Create organization"}
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
        {pending === "skip"
          ? "Setting up…"
          : "Skip — create a personal account instead"}
      </button>
    </form>
  );
}
