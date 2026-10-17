import { FormInput } from "@/components/ui/FormInput";
import { NumberedStep } from "@/components/ui/NumberedStep";
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
 *
 * A field shows its title and its input — **no help line under it** (Build
 * 21, spec A6 and B5; the session's S11; the owner's build 20 items 3 and 9:
 * "What is the gets a short summary even mean", "Why is there a paragraph").
 * The manifest's `description` stays the manifest's record and is not drawn.
 * A notification switch's line stays: it says what the switch does.
 */

type ManifestField = AutomationSetupField | AutomationRunInputField;

/**
 * A setup section's name (spec §3.B): numbered, in plain words — never the
 * manifest's own token. Keyed by the generated enum, so a section the contract
 * adds cannot render as its wire token.
 */
export const SECTION_NAME: Record<AutomationSetupField["section"], string> = {
  connections: "Connect",
  source: "Source",
  rules: "Settings",
  notifications: "Email",
};

/**
 * Setup fields, grouped under their manifest section without reordering, and
 * numbered from `firstSection` — Set up's Connect is 1 when it draws one. A
 * vendor choice (`connection`) is not drawn here: Set up draws its vendors
 * (`VendorRows`); its value is carried as it is, since a save replaces every
 * setting — a move keeps the vendor a flow chose.
 */
export function SetupFields({
  setup,
  config,
  firstSection = 1,
  hideConnections = false,
}: {
  setup: AutomationSetupField[];
  config: Record<string, unknown>;
  firstSection?: number;
  /** Set up carries each vendor choice itself, as the page's choice. */
  hideConnections?: boolean;
}) {
  const groups: Array<{
    section: AutomationSetupField["section"];
    fields: AutomationSetupField[];
  }> = [];

  // `setup` is published in manifest order. The contract declares a field's
  // section, but it does not declare an independent section order, so grouping
  // may never move a field ahead of an earlier one.
  for (const field of setup) {
    if (field.control === "connection") continue;
    const currentGroup = groups.at(-1);
    if (currentGroup?.section === field.section) {
      currentGroup.fields.push(field);
      continue;
    }
    groups.push({ section: field.section, fields: [field] });
  }

  return (
    <>
      {hideConnections
        ? null
        : setup
            .filter((field) => field.control === "connection")
            .map((field) => {
              const value = config[field.key] ?? field.defaultValue;
              return (
                <span key={field.key} hidden>
                  <input
                    type="hidden"
                    name={`config-control:${field.key}`}
                    value="connection"
                  />
                  <input
                    type="hidden"
                    name={`config:${field.key}`}
                    value={typeof value === "string" && value ? value : "none"}
                  />
                </span>
              );
            })}
      {groups.map(({ section, fields }, groupIndex) => {
        const name = SECTION_NAME[section];
        return (
          <div
            key={`${section}-${groupIndex}`}
            role="group"
            aria-label={name}
            className="space-y-4"
          >
            <NumberedStep index={groupIndex + firstSection} title={name} />
            {fields.map((field) => (
              <ManifestFieldInput
                key={field.key}
                field={field}
                value={config[field.key]}
                prefix="config"
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

/**
 * A manual run's input fields. An `artifact` field is a file the run reads: it
 * is uploaded when chosen (backend FR-14) and carried as the file's id.
 */
export function RunInputFields({
  runInput,
  workspaceId,
  subscriptionId,
  onUploadingChange,
  fileRound,
}: {
  runInput: AutomationRunInputField[];
  /** The workspace the page showed, which a file's upload is checked against. */
  workspaceId: string;
  subscriptionId: string;
  onUploadingChange: (key: string, uploading: boolean) => void;
  /** Changed to empty every file field — a file the platform will no longer take. */
  fileRound: number;
}) {
  return (
    <div className="space-y-4">
      {runInput.map((field) =>
        field.control === "artifact" ? (
          <RunFileField
            key={`${field.key}:${fileRound}`}
            field={field}
            workspaceId={workspaceId}
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

/** "Optional", beside the title of a field that may be left empty (spec §3.B). */
function OptionalMark({ field }: { field: ManifestField }) {
  if (field.required) return null;
  return (
    <span className="ml-2 text-xs font-normal text-[var(--muted)]">
      Optional
    </span>
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
          <span className="font-medium">{field.title}</span>
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
        type={
          field.control === "money"
            ? "number"
            : field.control === "email"
              ? "email"
              : "text"
        }
        step={field.control === "money" ? "any" : undefined}
        min={field.control === "money" ? 0 : undefined}
        prefix={field.control === "money" ? "$" : undefined}
        label={
          <>
            {field.title}
            <OptionalMark field={field} />
          </>
        }
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
