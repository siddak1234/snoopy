"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import { createTeamAction } from "./actions";

/**
 * Creating a team is an owner's or an admin's, and the page renders this only
 * for them. Submitted from onSubmit, not a form action, so a refusal keeps what
 * was typed. It names the workspace the page showed, so a switch in another tab
 * is refused rather than creating the team elsewhere.
 */
export function CreateTeamForm({ workspaceId }: { workspaceId: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createTeamAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      form.current?.reset();
    });
  };

  return (
    <form ref={form} onSubmit={submit} className="mt-3 grid gap-3 sm:max-w-md">
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <FormInput
        id="team-name"
        name="name"
        label="Team name"
        required
        minLength={2}
        maxLength={120}
        autoComplete="off"
      />
      <FormInput
        id="team-description"
        name="description"
        label="Description"
        hint="Optional."
        maxLength={1000}
        autoComplete="off"
      />
      <FormError message={error} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create team"}
        </Button>
      </div>
    </form>
  );
}
