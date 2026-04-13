"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/app/account/projects/actions";
import { normalizeInviteCode } from "@/lib/invite-utils";

type Props = {
  token: string;
  projectId: string;
};

export function AcceptInviteForm({ token, projectId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const raw = inputRef.current?.value ?? "";
    const code = normalizeInviteCode(raw);
    if (code.length < 4) {
      setError("Enter the invite code shared by the project owner.");
      return;
    }
    setPending(true);
    const result = await acceptInviteAction(token, code);
    setPending(false);
    if (result.ok) {
      router.push(`/account/projects/${result.projectId}`);
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <div>
        <label
          htmlFor="invite-code"
          className="block text-sm font-medium text-[var(--text)]"
        >
          Invite code
        </label>
        <input
          ref={inputRef}
          id="invite-code"
          name="code"
          type="text"
          required
          autoComplete="off"
          placeholder="e.g. K7MN2P"
          disabled={pending}
          className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 font-mono uppercase tracking-widest text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          The short code the project owner shared with you alongside this link.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="btn-primary inline-flex w-full justify-center px-5"
      >
        {pending ? "Joining…" : "Accept invite & join project"}
      </button>
    </form>
  );
}
