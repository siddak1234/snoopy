"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { subscribeToAutomation } from "./actions";

/** Where a new subscription applies: one team (a project, in the contract). */
export type AddScope = { projectId: string; label: string };

/**
 * Add an automation to a team, so that only the people who can see that team
 * see it (backend 18.6.2). A flow is added to a team and nowhere else (the
 * owner, build 10): only the teams this automation is not already in are
 * offered, and with just one to choose it is the single "Add" it always was.
 *
 * With no team in the workspace yet, nothing can be added, and the card says so
 * in the app's words: an owner or admin is told to create a team first, with the
 * way to Teams, where Create a team is; a plain member, whom the platform would
 * refuse, is told who does. Nothing is sent in either case.
 *
 * A refusal is shown rather than swallowed: the plan limit and an unconfigured
 * billing service are answers a person needs.
 */
export function AddAutomation({
  templateId,
  name,
  available,
  scopes,
  hasTeam,
  canAdminister,
  workspaceId,
}: {
  templateId: string;
  name: string;
  available: boolean;
  scopes: AddScope[];
  /** Whether the workspace has an open team at all — the scopes offered are the ones left. */
  hasTeam: boolean;
  /** Owner or admin, from the workspace list: who may create the first team. */
  canAdminister: boolean;
  /** The workspace this page shows; Add is refused once it is not active. */
  workspaceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState(scopes[0]?.projectId ?? "");

  if (!hasTeam) {
    return canAdminister ? (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-[var(--muted)]">Create a team first.</p>
        <Link
          prefetch={false}
          href="/account/teams"
          className="btn-secondary btn-sm"
        >
          Create a team
        </Link>
      </div>
    ) : (
      <p className="text-xs text-[var(--muted)]">
        An owner or admin creates the first team.
      </p>
    );
  }

  // In every team already: each row above says where, and nothing is left to
  // add.
  if (scopes.length === 0) return null;

  // What was chosen, while it is still on offer. The page re-renders after an
  // Add with that scope gone, and this state outlives the render: sending it
  // again would add the automation where it already is.
  const scope = scopes.some((option) => option.projectId === chosen)
    ? chosen
    : (scopes[0]?.projectId ?? "");

  const add = () => {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.append("templateId", templateId);
      data.append("workspaceId", workspaceId);
      data.append("projectId", scope);
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
                <option key={option.projectId} value={option.projectId}>
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
