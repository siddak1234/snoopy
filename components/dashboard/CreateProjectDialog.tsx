"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createProjectAction } from "@/app/account/projects/actions";
import Modal from "@/components/ui/Modal";
import { FormInput } from "@/components/ui/FormInput";
import { FormError } from "@/components/ui/FormError";
import {
  PROJECT_TYPES,
  type ProjectScope,
  type ProjectType,
} from "@/lib/project-types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void | Promise<void>;
  hasOrg?: boolean;
};

export function CreateProjectDialog({
  open,
  onClose,
  onSuccess,
  hasOrg = false,
}: Props) {
  const [scope, setScope] = useState<ProjectScope>("personal");
  const [selectedType, setSelectedType] = useState<ProjectType | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setError(null);
    setPending(false);
    setCreated(false);
    setScope("personal");
    setSelectedType("");
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(reset);
      return;
    }
    const timeout = setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => clearTimeout(timeout);
  }, [open, reset]);

  const handleClose = useCallback(async () => {
    if (created) await Promise.resolve(onSuccess?.());
    onClose();
  }, [created, onClose, onSuccess]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void handleClose();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [handleClose, open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await createProjectAction(new FormData(event.currentTarget));
    setPending(false);
    if (result.ok) setCreated(true);
    else setError(result.error);
  }

  if (!open) return null;

  const dialog = (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="create-project-title"
      ariaDescribedBy={
        created ? "create-project-success-desc" : "create-project-desc"
      }
      bubble
      zIndex={100}
    >
      <h2
        id="create-project-title"
        className="text-xl font-semibold text-[var(--text)]"
      >
        Create project
      </h2>
      {created ? (
        <>
          <p
            id="create-project-success-desc"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Your project was created. Use its project page to add team members.
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
          <p
            id="create-project-desc"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Add a new project to your workspace.
          </p>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >
            <fieldset disabled={pending}>
              <legend className="block text-sm font-medium text-[var(--text)]">
                Project scope{" "}
                <span className="text-[var(--muted)]">(required)</span>
              </legend>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["personal", "team"] as const).map((value) => {
                  const disabled = value === "team" && !hasOrg;
                  const selected = scope === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 transition ${selected ? "border-[var(--accent-strong)] bg-[var(--card)]" : "border-[var(--ring)] bg-[var(--card)]"} ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--surface-hover)]"}`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setScope(value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${selected ? "border-[var(--accent-strong)]" : "border-[var(--ring)]"}`}
                      >
                        {selected ? (
                          <span className="h-2 w-2 rounded-full bg-[var(--accent-strong)]" />
                        ) : null}
                      </span>
                      <span className="text-sm font-medium text-[var(--text)] capitalize">
                        {value}
                      </span>
                    </label>
                  );
                })}
              </div>
              {!hasOrg ? (
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  Join an organization to enable team projects.
                </p>
              ) : null}
            </fieldset>
            <FormInput
              ref={nameInputRef}
              id="project-name"
              label={
                <>
                  Project name{" "}
                  <span className="text-[var(--muted)]">(required)</span>
                </>
              }
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={60}
              placeholder="My project"
              autoComplete="off"
              disabled={pending}
            />
            <div>
              <label
                htmlFor="project-type"
                className="block text-sm font-medium text-[var(--text)]"
              >
                Project type{" "}
                <span className="text-[var(--muted)]">(required)</span>
              </label>
              <select
                id="project-type"
                name="projectType"
                required
                disabled={pending}
                value={selectedType}
                onChange={(event) =>
                  setSelectedType(event.target.value as ProjectType | "")
                }
                className="mt-1.5 w-full cursor-pointer rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
              >
                <option value="" disabled>
                  Select project type
                </option>
                {PROJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="project-description"
                className="block text-sm font-medium text-[var(--text)]"
              >
                Description{" "}
                <span className="text-[var(--muted)]">(optional)</span>
              </label>
              <textarea
                id="project-description"
                name="description"
                rows={3}
                maxLength={4000}
                placeholder="Describe this project"
                disabled={pending}
                className="mt-1.5 w-full resize-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
              />
            </div>
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="submit"
                disabled={pending}
                className="btn-primary inline-flex px-5"
              >
                {pending ? "Creating…" : "Create project"}
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
