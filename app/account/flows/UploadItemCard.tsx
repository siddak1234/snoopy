"use client";

import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import type {
  AutomationItemField,
  AutomationItems,
  AutomationRunInputField,
  Item,
} from "@/lib/automations";
import {
  OTHER_CHOICE,
  OTHER_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  firstChoice,
  inSentence,
  itemFieldValues,
  selectChoices,
  uploadLabel,
} from "@/lib/flow-items";
import { createItem } from "./actions";
import { RunFileField } from "./RunFileField";

/** Under a field the platform refused. */
const CHECK_THIS = "Check this value.";

/** A field's input: the same look as `FormInput`'s. */
const FIELD_CLASS =
  "mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-2.5 text-[var(--text)] transition hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60";

/**
 * The upload card (Round 19, plan §5.2; backend ADR-0046): a dialog that
 * makes an item. Each of the flow's item fields, in order — a select of its
 * `options`, then the values typed for it before (`saved`, `listItems`'
 * `choices`), then "Other", which shows a text box of 40 characters; or a text
 * box — then the file, uploaded as soon as it is chosen through the run's own
 * upload path (`RunFileField`: open, put, complete), with the types it takes
 * in words beside it. Upload sends the values and the file's id
 * (`createItem`); the card closes and the new row reads "Reading…".
 *
 * **One item per key**, as a run's form keeps one run per key: the key is
 * made with the card and again whenever a value changes, so only a resend of
 * the same values reuses it. A refusal is said on the card, and a field the
 * platform refused says so under it.
 */
export function UploadItemCard({
  workspaceId,
  subscriptionId,
  declared,
  saved,
  onClose,
  onMade,
}: {
  workspaceId: string;
  subscriptionId: string;
  declared: AutomationItems;
  /** The values typed for each field on earlier items (`listItems`' `choices`). */
  saved: Record<string, string[]>;
  onClose: () => void;
  onMade: (item: Item) => void;
}) {
  const titleId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [refused, setRefused] = useState<readonly string[]>([]);
  const [picked, setPicked] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      declared.fields
        .filter((field) => field.control === "select")
        .map((field) => [field.key, firstChoice(field)]),
    ),
  );
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [itemKey, setItemKey] = useState(() => `item-${crypto.randomUUID()}`);
  const newItemKey = () => setItemKey(`item-${crypto.randomUUID()}`);
  const [fileBusy, setFileBusy] = useState(false);
  // Bumped to empty the file field when the platform will not take its file.
  const [fileRound, setFileRound] = useState(0);
  const file: AutomationRunInputField = {
    key: declared.file.key,
    title: declared.file.title,
    description: declared.file.description,
    control: "artifact",
    required: false,
    acceptedContentTypes: declared.file.acceptedContentTypes,
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || fileBusy) return;
    const artifactId = String(
      new FormData(event.currentTarget).get(`input:${declared.file.key}`) ?? "",
    );
    if (!artifactId) {
      setError(`Choose the ${inSentence(declared.file.title)} first.`);
      return;
    }
    setError(null);
    setRefused([]);
    startTransition(async () => {
      const result = await createItem({
        workspaceId,
        subscriptionId,
        fields: itemFieldValues(declared.fields, saved, picked, typed),
        fieldKeys: declared.fields.map((field) => field.key),
        file: artifactId,
        idempotencyKey: itemKey,
      });
      if (!result.ok) {
        setError(result.error);
        setRefused(result.fields ?? []);
        if (result.state === "file-unavailable") {
          setFileRound((round) => round + 1);
          newItemKey();
        }
        return;
      }
      onMade(result.item);
    });
  };

  const fieldError = (field: AutomationItemField) =>
    refused.includes(field.key) ? CHECK_THIS : undefined;

  return (
    <Modal
      onClose={onClose}
      bubble
      ariaLabelledBy={titleId}
      zIndex={100}
      dismissible={!pending}
    >
      <form
        data-testid="item-upload"
        onSubmit={submit}
        onChange={newItemKey}
        className="flex flex-col gap-4"
      >
        <h2 id={titleId} className="text-xl font-semibold text-[var(--text)]">
          {uploadLabel(declared.words)}
        </h2>
        {declared.fields.map((field) =>
          field.control === "select" ? (
            <SelectField
              key={field.key}
              field={field}
              saved={saved[field.key]}
              picked={picked[field.key] ?? ""}
              typed={typed[field.key] ?? ""}
              error={fieldError(field)}
              disabled={pending}
              onPick={(value) =>
                setPicked((current) => ({ ...current, [field.key]: value }))
              }
              onType={(value) =>
                setTyped((current) => ({ ...current, [field.key]: value }))
              }
            />
          ) : (
            <FormInput
              key={field.key}
              id={`item-${field.key}`}
              label={field.title}
              value={typed[field.key] ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setTyped((current) => ({ ...current, [field.key]: value }));
              }}
              maxLength={field.maxLength ?? TEXT_MAX_LENGTH}
              required={field.required}
              disabled={pending}
              error={fieldError(field)}
              autoComplete="off"
            />
          ),
        )}
        <RunFileField
          key={`${declared.file.key}:${fileRound}`}
          field={file}
          workspaceId={workspaceId}
          subscriptionId={subscriptionId}
          onBusyChange={(_, busy) => setFileBusy(busy)}
          showTypes
        />
        <FormError message={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || fileBusy}>
            {pending || fileBusy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * A select field (plan §5.2): its title over its choices (`selectChoices`);
 * "Other" shows a text box under it for a value of the person's own, 40
 * characters at most.
 */
function SelectField({
  field,
  saved,
  picked,
  typed,
  error,
  disabled,
  onPick,
  onType,
}: {
  field: AutomationItemField;
  saved: string[] | undefined;
  picked: string;
  typed: string;
  error: string | undefined;
  disabled: boolean;
  onPick: (value: string) => void;
  onType: (value: string) => void;
}) {
  const id = `item-${field.key}`;
  const other = picked === OTHER_CHOICE;
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-[var(--text)]"
      >
        {field.title}
      </label>
      <select
        id={id}
        value={picked}
        required={field.required}
        disabled={disabled}
        onChange={(event) => onPick(event.currentTarget.value)}
        className={FIELD_CLASS}
      >
        {picked === "" ? (
          <option value="" disabled>
            Choose
          </option>
        ) : null}
        {selectChoices(field, saved).map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
      {other ? (
        <FormInput
          id={`${id}-other`}
          aria-label={field.title}
          value={typed}
          onChange={(event) => onType(event.currentTarget.value)}
          maxLength={OTHER_MAX_LENGTH}
          required={field.required}
          disabled={disabled}
          autoComplete="off"
        />
      ) : null}
      {error ? (
        <p className="mt-1 text-sm text-[var(--error-text)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
