"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteProjectAction } from "@/app/account/teams/actions";

export function DeleteProjectButton({
  projectId,
  projectName,
  redirectAfterDelete,
}: {
  projectId: string;
  projectName: string;
  /** If set, navigate here after successful delete (e.g. from the team's page). */
  redirectAfterDelete?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        // What actually happens: archiving leaves the team's flows running. The
        // platform never "reattached" anything, as this once promised.
        `Delete "${projectName}"? It leaves every team list. Its flows keep running until you archive them in Flows.`,
      )
    )
      return;
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
      aria-label={`Delete team ${projectName}`}
      className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--error-bg)] hover:text-[var(--error-text)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
