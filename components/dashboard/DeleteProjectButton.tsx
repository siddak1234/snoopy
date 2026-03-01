"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProjectAction } from "@/app/account/projects/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
  redirectAfterDelete,
}: {
  projectId: string;
  projectName: string;
  /** If set, navigate here after successful delete (e.g. from project detail page). */
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      if (redirectAfterDelete) {
        router.push(redirectAfterDelete);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={`Delete project ${projectName}`}
      className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
