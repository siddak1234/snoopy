import { FormInput } from "@/components/ui/FormInput";
import { RunFileField } from "./RunFileField";
import type {
  AutomationRunInputField,
  AutomationSetupField,
} from "@/lib/automations";

/**
 * Form fields a manifest declares, rendered as the manifest orders them.
 *
 * Two declarations use this: a subscription's `setup`, and a manual run's
 * `runInput` (backend ADR-0030). They share the vocabulary `text`, `money` and
 * `toggle` (run input adds `artifact`, below), so they share one renderer, and
 * the form posts each value under
 * `<prefix>:<key>` with its control under `<prefix>-control:<key>`, which is how
 * the server action converts it back to the type the platform checks.
 */

type ManifestField = AutomationSetupField | AutomationRunInputField;

/** Setup fields, grouped under their manifest section without reordering. */
export function SetupFields({
  setup,
  config,
}: {
  setup: AutomationSetupField[];
  config: Record<string, unknown>;
}) {
  const groups: Array<{
    section: AutomationSetupField["section"];
    fields: AutomationSetupField[];
  }> = [];

  // `setup` is published in manifest order. The contract declares a field's
  // section, but it does not declare an independent section order, so grouping
  // may never move a field ahead of an earlier one.
  for (const field of setup) {
    const currentGroup = groups.at(-1);
    if (currentGroup?.section === field.section) {
      currentGroup.fields.push(field);
      continue;
    }
    groups.push({ section: field.section, fields: [field] });
  }

  return groups.map(({ section, fields }, groupIndex) => {
    return (
      <fieldset key={`${section}-${groupIndex}`} className="space-y-4">
        <legend className="text-sm font-medium text-[var(--text)] capitalize">
          {section}
        </legend>
        {fields.map((field) => (
          <ManifestFieldInput
            key={field.key}
            field={field}
            value={config[field.key]}
            prefix="config"
          />
        ))}
      </fieldset>
    );
  });
}

/**
 * A manual run's input fields. An `artifact` field is a file the run reads: it
 * is uploaded when chosen (backend FR-14) and carried as the file's id.
 */
export function RunInputFields({
  runInput,
  subscriptionId,
  onUploadingChange,
}: {
  runInput: AutomationRunInputField[];
  subscriptionId: string;
  onUploadingChange: (uploading: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {runInput.map((field) =>
        field.control === "artifact" ? (
          <RunFileField
            key={field.key}
            field={field}
            subscriptionId={subscriptionId}
            onBusyChange={onUploadingChange}
          />
        ) : (
          <ManifestFieldInput
            key={field.key}
            field={field}
            value={undefined}
            prefix="input"
          />
        ),
      )}
    </div>
  );
}

function ManifestFieldInput({
  field,
  value,
  prefix,
}: {
  field: ManifestField;
  value: unknown;
  prefix: "config" | "input";
}) {
  const hasDefault = Object.hasOwn(field, "defaultValue");
  const initialValue = value ?? field.defaultValue;
  const required = field.required && !hasDefault;
  const fieldId = `${prefix}-${field.key}`;

  if (field.control === "toggle") {
    return (
      <div>
        <input
          type="hidden"
          name={`${prefix}-control:${field.key}`}
          value={field.control}
        />
        <label
          htmlFor={fieldId}
          className="flex items-start gap-3 text-sm text-[var(--text)]"
        >
          <input
            id={fieldId}
            name={`${prefix}:${field.key}`}
            type="checkbox"
            value="true"
            defaultChecked={initialValue === true}
            className="mt-1 size-4 rounded border-[var(--color-divider)] accent-[var(--color-accent)]"
          />
          <span>
            <span className="font-medium">{field.title}</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {field.description}
            </span>
          </span>
        </label>
        <FieldMetadata field={field} />
      </div>
    );
  }

  return (
    <div>
      <input
        type="hidden"
        name={`${prefix}-control:${field.key}`}
        value={field.control}
      />
      <FormInput
        id={fieldId}
        name={`${prefix}:${field.key}`}
        type={field.control === "money" ? "number" : "text"}
        step={field.control === "money" ? "any" : undefined}
        min={field.control === "money" ? 0 : undefined}
        label={field.title}
        hint={field.description}
        required={required}
        defaultValue={
          initialValue === undefined || initialValue === null
            ? undefined
            : String(initialValue)
        }
        autoComplete="off"
      />
      <FieldMetadata field={field} />
    </div>
  );
}

// The contract provides no resource-list endpoint, so a `resource-picker`
// accepts the supplied opaque value as text without inventing a
// provider-specific list.

/**
 * What a notifications toggle switches, in words (register F22) — the manifest
 * allows `notifies` only on a toggle in the `notifications` section. Keyed by the
 * generated enum, so a value the contract adds cannot render as its wire token.
 */
const NOTIFIES: Record<
  NonNullable<AutomationSetupField["notifies"]>,
  string
> = {
  "approval-requested": "an approval is requested",
  "approval-expiring": "an approval is about to expire",
  "run-failed": "a run fails",
  "run-succeeded": "a run succeeds",
};

function FieldMetadata({ field }: { field: ManifestField }) {
  if (!("notifies" in field) || !field.notifies) return null;
  return (
    <p className="mt-1 text-xs text-[var(--muted)]">
      Controls the notification sent when {NOTIFIES[field.notifies]}.
    </p>
  );
}
