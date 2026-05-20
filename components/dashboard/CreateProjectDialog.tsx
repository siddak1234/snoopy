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

type UsedTypesByScope = Record<ProjectScope, ProjectType[]>;

type Props = {
  open: boolean;
  onClose: () => void;
  /** Called after the user closes the success view; use to revalidate + router.refresh(). */
  onSuccess?: () => void | Promise<void>;
  /** Types the user has already created or joined, partitioned by scope. */
  usedTypesByScope?: UsedTypesByScope;
  /** Whether the signed-in user belongs to an organization workspace. */
  hasOrg?: boolean;
};

const EMPTY_USED: UsedTypesByScope = { personal: [], team: [] };

export function CreateProjectDialog({
  open,
  onClose,
  onSuccess,
  usedTypesByScope,
  hasOrg = false,
}: Props) {
  const used = usedTypesByScope ?? EMPTY_USED;
  const [scope, setScope] = useState<ProjectScope>("personal");
  const usedSet = new Set<ProjectType>(used[scope]);
  const allUsedForScope = usedSet.size >= PROJECT_TYPES.length;
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
    formRef.current?.reset();
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => reset());
      return;
    }
    const t = setTimeout(() => nameInputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open, reset]);

  const handleClose = useCallback(async () => {
    if (created) {
      await Promise.resolve(onSuccess?.());
    }
    onClose();
  }, [created, onClose, onSuccess]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, handleClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const formData = new FormData(e.currentTarget);
    const result = await createProjectAction(formData);
    setPending(false);
    if (result.ok) {
      setCreated(true);
    } else {
      setError(result.error);
    }
  }

  if (!open) return null;

  const dialogContent = (
    <Modal
      onClose={handleClose}
      ariaLabelledBy="create-project-title"
      ariaDescribedBy={
        created
          ? "create-project-success-desc"
          : allUsedForScope
            ? "create-project-all-used-desc"
            : "create-project-desc"
      }
      bubble
      zIndex={100}
    >
      <h2 id="create-project-title" className="text-xl font-semibold text-[var(--text)]">
        Create project
      </h2>

      {created ? (
        <>
          <p id="create-project-success-desc" className="mt-1 text-sm text-[var(--muted)]">
            Your project was created. Use the project page to invite team members.
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
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </>
      ) : (
        <>
          <p id="create-project-desc" className="mt-1 text-sm text-[var(--muted)]">
            Add a new project to your workspace.
          </p>
          <form ref={formRef} onSubmit={handleSubmit} className="mt-6 space-y-4">
            <fieldset disabled={pending}>
              <legend className="block text-sm font-medium text-[var(--text)]">
                Project scope <span className="text-[var(--muted)]">(required)</span>
              </legend>
              <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["personal", "team"] as const).map((value) => {
                  const isDisabled = value === "team" && !hasOrg;
                  const selected = scope === value;
                  return (
                    <label
                      key={value}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-2.5 transition ${
                        selected
                          ? "border-[var(--accent-strong)] bg-[var(--card)]"
                          : "border-[var(--ring)] bg-[var(--card)]"
                      } ${isDisabled ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--surface-hover)]"}`}
                    >
                      <input
                        type="radio"
                        name="scope"
                        value={value}
                        checked={selected}
                        disabled={isDisabled}
                        onChange={() => setScope(value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
                          selected
                            ? "border-[var(--accent-strong)]"
                            : "border-[var(--ring)]"
                        }`}
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
            {allUsedForScope ? (
              <>
                <p
                  id="create-project-all-used-desc"
                  className="text-sm text-[var(--muted)]"
                >
                  You&apos;ve already created a {scope} project of every available type. Delete or leave one before creating another{hasOrg ? `, or switch scope above` : ""}.
                </p>
                <FormError message={error} />
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-secondary inline-flex px-5"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <FormInput
                  ref={nameInputRef}
                  id="project-name"
                  label={<>Project name <span className="text-[var(--muted)]">(required)</span></>}
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
                  <label htmlFor="project-type" className="block text-sm font-medium text-[var(--text)]">
                    Project type <span className="text-[var(--muted)]">(required)</span>
                  </label>
                  <div className="relative mt-1.5">
                    <select
                      id="project-type"
                      name="projectType"
                      required
                      disabled={pending}
                      defaultValue=""
                      className="w-full appearance-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 cursor-pointer"
                    >
                      <option value="" disabled className="text-[var(--muted)]">
                        Select project type
                      </option>
                      {PROJECT_TYPES.map((type) => {
                        const taken = usedSet.has(type);
                        return (
                          <option key={type} value={type} disabled={taken}>
                            {taken ? `${type} — already created` : type}
                          </option>
                        );
                      })}
                    </select>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </div>
                </div>
                <div>
                  <label htmlFor="project-description" className="block text-sm font-medium text-[var(--text)]">
                    Description <span className="text-[var(--muted)]">(optional)</span>
                  </label>
                  <textarea
                    id="project-description"
                    name="description"
                    rows={3}
                    maxLength={140}
                    placeholder="Max 140 characters"
                    disabled={pending}
                    className="mt-1.5 w-full resize-none rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60"
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
              </>
            )}
          </form>
        </>
      )}
    </Modal>
  );

  return typeof document !== "undefined"
    ? createPortal(dialogContent, document.body)
    : null;
}
