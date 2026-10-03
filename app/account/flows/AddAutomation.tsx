"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { subscribeToAutomation } from "./actions";

/** Where a new subscription applies: the whole workspace, or one project. */
export type AddScope = { projectId: string | null; label: string };

/**
 * Add an automation — to the whole workspace, or to one project so that only
 * the people who can see that project see it (backend 18.6.2). Only the scopes
 * this automation is not already in are offered; with just the workspace to
 * choose, it is the single "Add" it always was.
 *
 * A refusal is shown rather than swallowed: the plan limit and an unconfigured
 * billing service are answers a person needs.
 */
export function AddAutomation({
  templateId,
  name,
  available,
  scopes,
  workspaceId,
}: {
  templateId: string;
  name: string;
  available: boolean;
  scopes: AddScope[];
  /** The workspace this page shows; Add is refused once it is not active. */
  workspaceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState(scopes[0]?.projectId ?? "");

  if (scopes.length === 0) return null;

  // What was chosen, while it is still on offer. The page re-renders after an
  // Add with that scope gone, and this state outlives the render: sending it
  // again would add the automation where it already is.
  const scope = scopes.some((option) => (option.projectId ?? "") === chosen)
    ? chosen
    : (scopes[0]?.projectId ?? "");

  const add = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("templateId", templateId);
      data.append("workspaceId", workspaceId);
      if (scope) data.append("projectId", scope);
      const result = await subscribeToAutomation(data);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {scopes.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span>Add to</span>
            <select
              value={scope}
              onChange={(event) => setChosen(event.target.value)}
              disabled={pending}
              aria-label={`Where to add ${name}`}
              className="rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)]"
            >
              {scopes.map((option) => (
                <option
                  key={option.projectId ?? "workspace"}
                  value={option.projectId ?? ""}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          disabled={pending || !available}
          onClick={add}
        >
          {pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
