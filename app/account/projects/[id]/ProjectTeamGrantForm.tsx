"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormSelect } from "@/components/ui/FormSelect";
import { grantProjectTeamAction } from "@/app/account/teams/actions";

/**
 * Gives a team a role on this project, or changes it — the project's owner's or
 * admin's to do. Ownership is never granted to a team, and no grant is revoked
 * from here: no operation does (backend §12.1 #174).
 */
export function ProjectTeamGrantForm({
  projectId,
  teams,
}: {
  projectId: string;
  teams: { id: string; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await grantProjectTeamAction(data);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:max-w-md">
      <input type="hidden" name="projectId" value={projectId} />
      <FormSelect id="project-team" name="teamId" label="Team" required>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name}
          </option>
        ))}
      </FormSelect>
      <FormSelect
        id="project-team-role"
        name="role"
        label="Role on this project"
        defaultValue="member"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </FormSelect>
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Give access"}
        </Button>
      </div>
    </form>
  );
}
