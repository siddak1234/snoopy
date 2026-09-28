"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormSelect } from "@/components/ui/FormSelect";
import { upsertTeamMemberAction } from "../actions";

/**
 * One control for two writes: adding a workspace member to the team, and
 * changing the role of someone already on it — the same operation
 * (`upsertTeamMembership`). Taking someone off is each row's own control
 * (backend §12.1 #174).
 */
export function TeamMemberForm({
  workspaceId,
  teamId,
  people,
}: {
  workspaceId: string;
  teamId: string;
  people: { userId: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await upsertTeamMemberAction(data);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 sm:max-w-md">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="teamId" value={teamId} />
      <FormSelect id="team-member-person" name="userId" label="Person" required>
        {people.map((person) => (
          <option key={person.userId} value={person.userId}>
            {person.label}
          </option>
        ))}
      </FormSelect>
      <FormSelect
        id="team-member-role"
        name="role"
        label="Team role"
        defaultValue="member"
        hint="A manager can add people to this team and change their roles."
      >
        <option value="member">Member</option>
        <option value="manager">Manager</option>
      </FormSelect>
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Add or change role"}
        </Button>
      </div>
    </form>
  );
}
