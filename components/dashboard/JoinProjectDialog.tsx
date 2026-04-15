"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { acceptWorkspaceInviteAction } from "@/app/account/workspace-invite-actions";
import { normalizeInviteCode, parseInviteToken } from "@/lib/invite-utils";
import Modal from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function JoinProjectDialog({ open, onClose, onSuccess }: Props) {
  const [error, setError]   = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef   = useRef<HTMLFormElement>(null);
  const urlRef    = useRef<HTMLInputElement>(null);
  const codeRef   = useRef<HTMLInputElement>(null);
  const router    = useRouter();

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => reset());
      return;
    }
    const t = setTimeout(() => urlRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const rawUrl  = urlRef.current?.value.trim() ?? "";
    const rawCode = codeRef.current?.value.trim() ?? "";

    if (!rawUrl) {
      setError("Paste the invite link or token.");
      return;
    }
    if (!rawCode) {
      setError("Enter the invite code.");
      return;
    }

    const token = parseInviteToken(rawUrl);
    const code  = normalizeInviteCode(rawCode);

    if (!token) {
      setError("Could not read a token from the link. Paste the full invite URL.");
      return;
    }

    setPending(true);
    const result = await acceptWorkspaceInviteAction(token, code);
    setPending(false);

    if (result.ok) {
      onClose();
      onSuccess?.();
      router.push("/account");
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  const dialogContent = (
    <Modal
      onClose={onClose}
      ariaLabelledBy="join-project-title"
      ariaDescribedBy="join-project-desc"
      bubble
      zIndex={100}
    >
      <h2 id="join-project-title" className="text-xl font-semibold text-[var(--text)]">
        Join organization
      </h2>
      <p id="join-project-desc" className="mt-1 text-sm text-[var(--muted)]">
        Paste the invite link and enter the code shared by the organization owner.
      </p>

      <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="join-invite-url" className="block text-sm font-medium text-[var(--text)]">
            Invite link
          </label>
          <input
            ref={urlRef}
            id="join-invite-url"
            name="inviteUrl"
            type="text"
            required
            autoComplete="off"
            placeholder="https://…/org-invite/… or paste the token"
            disabled={pending}
            className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
          />
        </div>

        <div>
          <label htmlFor="join-invite-code" className="block text-sm font-medium text-[var(--text)]">
            Invite code
          </label>
          <input
            ref={codeRef}
            id="join-invite-code"
            name="inviteCode"
            type="text"
            required
            autoComplete="off"
            placeholder="e.g. K7MN2P"
            disabled={pending}
            className="mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 font-mono uppercase tracking-widest text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
          />
        </div>

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <button type="submit" disabled={pending} className="btn-primary inline-flex px-5">
            {pending ? "Joining…" : "Join organization"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn-secondary inline-flex px-5"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );

  return typeof document !== "undefined"
    ? createPortal(dialogContent, document.body)
    : null;
}
