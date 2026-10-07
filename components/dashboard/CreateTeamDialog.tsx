"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createProjectAction } from "@/app/account/teams/actions";
import Modal from "@/components/ui/Modal";
import { FormInput } from "@/components/ui/FormInput";
import { FormSelect } from "@/components/ui/FormSelect";
import { FormError } from "@/components/ui/FormError";
import { OTHER_TEAM_TYPE, TEAM_TYPES } from "@/lib/team-types";

/** The workspace a team is created in: the one the page showed. */
export type TeamWorkspace = {
  id: string;
  name: string;
  type: "personal" | "organization";
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** The team made, once the person has seen that it was. */
  onSuccess?: (projectId: string) => void | Promise<void>;
  workspace: TeamWorkspace;
};

/**
 * Create a team, as the app does (BUILD-PLAN 24.11.11; the owner, build 9). A
 * team is its kind: the kind of team, from a dropdown, "Other" opening a field
 * for the person's own words — no name, no description and no workspace
 * picker. It is made in the workspace the page showed, which one line names;
 * the form sends that workspace's id, and the server refuses once another tab
 * has changed the active one (register F57).
 */
export function CreateTeamDialog({
  open,
  onClose,
  onSuccess,
  workspace,
}: Props) {
  const [kind, setKind] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const kindSelectRef = useRef<HTMLSelectElement>(null);
  const personal = workspace.type === "personal";

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    setCreated(null);
    setKind("");
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(reset);
      return;
    }
    const timeout = setTimeout(() => kindSelectRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [open, reset]);

  const handleClose = useCallback(async () => {
    if (created) await Promise.resolve(onSuccess?.(created));
    onClose();
  }, [created, onClose, onSuccess]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspace.id);
    const result = await createProjectAction(data);
    setPending(false);
    if (result.ok) setCreated(result.projectId);
    else setError(result.error);
  }

  if (!open) return null;

  const dialog = (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="create-team-title"
      ariaDescribedBy={
        created ? "create-team-success-desc" : "create-team-desc"
      }
      bubble
      zIndex={100}
      // Held open while the team is being made: closed meanwhile, its answer —
      // the team made, or a refusal — was said nowhere (register F96).
      dismissible={!pending}
    >
      <h2
        id="create-team-title"
        className="text-xl font-semibold text-[var(--text)]"
      >
        {created ? "Team created" : "Create a team"}
      </h2>
      {created ? (
        <>
          <p
            id="create-team-success-desc"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            {/* A personal workspace's team has only its owner: there is no
                one to add. */}
            {personal
              ? "Your team is ready."
              : "Your team is ready. Add people on its page."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary inline-flex px-5"
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p id="create-team-desc" className="mt-1 text-sm text-[var(--muted)]">
            {personal ? "In your personal workspace." : `In ${workspace.name}.`}
          </p>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >
            <FormSelect
              ref={kindSelectRef}
              id="team-kind"
              name="teamKind"
              label="Kind of team"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              required
              disabled={pending}
            >
              <option value="" disabled>
                Choose a kind
              </option>
              {[...TEAM_TYPES, OTHER_TEAM_TYPE].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </FormSelect>
            {kind === OTHER_TEAM_TYPE ? (
              <FormInput
                id="team-kind-other"
                label="What kind of team"
                name="teamKindOther"
                type="text"
                required
                minLength={2}
                maxLength={60}
                placeholder="Facilities"
                autoComplete="off"
                disabled={pending}
              />
            ) : null}
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="btn-primary inline-flex px-5"
              >
                {pending ? "Creating…" : "Create team"}
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
        </>
      )}
    </Modal>
  );
  return typeof document !== "undefined"
    ? createPortal(dialog, document.body)
    : null;
}
