import Link from "next/link";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { FormInput } from "@/components/ui/FormInput";
import { NumberedStep } from "@/components/ui/NumberedStep";
import { VendorMark } from "@/components/dashboard/VendorLogo";
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
 * A field's title and help line are the manifest's own; nothing here adds one
 * (spec §3.0 rule 5).
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
 * The flow's vendor choice — its `connection` setting (backend ADR-0037) — as
 * Set up's Connect row shows it (spec §3.B), with the way to the vendor page.
 */
export type VendorChoiceRow = {
  /** The setting's key. */
  key: string;
  /** `none`, or the chosen provider. */
  providerId: string;
  /** The flow's vendor page. */
  href: string;
  displayName?: string;
  /** The provider's published icon name, which may name its logo. */
  icon?: string | null;
  /** False while the chosen vendor is not connected. */
  connected?: boolean;
};

/** Setup fields, grouped under their manifest section without reordering. */
export function SetupFields({
  setup,
  config,
  vendor = null,
}: {
  setup: AutomationSetupField[];
  config: Record<string, unknown>;
  /** The vendor row; absent where the vendor is not chosen (a move). */
  vendor?: VendorChoiceRow | null;
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
    const name = SECTION_NAME[section];
    return (
      <div
        key={`${section}-${groupIndex}`}
        role="group"
        aria-label={name}
        className="space-y-4"
      >
        <NumberedStep index={groupIndex + 1} title={name} />
        {fields.map((field) =>
          field.control === "connection" ? (
            <VendorField
              key={field.key}
              field={field}
              value={config[field.key]}
              vendor={vendor?.key === field.key ? vendor : null}
            />
          ) : (
            <ManifestFieldInput
              key={field.key}
              field={field}
              value={config[field.key]}
              prefix="config"
            />
          ),
        )}
      </div>
    );
  });
}

/**
 * The vendor choice (spec §3.B): the chosen vendor's logo — or its icon and
 * name — or None, with "Not connected" while the chosen vendor still needs
 * connecting, and Connect vendor, which goes to the flow's vendor page, where
 * it is chosen. The value is carried as it is, since a save replaces every
 * setting.
 */
function VendorField({
  field,
  value,
  vendor,
}: {
  field: AutomationSetupField;
  value: unknown;
  vendor: VendorChoiceRow | null;
}) {
  const chosen =
    vendor?.providerId ??
    (typeof value === "string"
      ? value
      : typeof field.defaultValue === "string"
        ? field.defaultValue
        : "none");
  return (
    <div>
      <input
        type="hidden"
        name={`config-control:${field.key}`}
        value="connection"
      />
      <input type="hidden" name={`config:${field.key}`} value={chosen} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {chosen === "none" ? (
            <span className="inline-flex items-center gap-3">
              <ProhibitIcon
                size={24}
                aria-hidden
                className="shrink-0 text-[var(--muted)]"
              />
              <span className="text-sm font-medium text-[var(--text)]">
                None
              </span>
            </span>
          ) : (
            <VendorMark
              icon={vendor?.icon}
              displayName={vendor?.displayName ?? field.title}
            />
          )}
          {vendor && chosen !== "none" && vendor.connected === false ? (
            <p className="mt-1 text-xs text-[var(--warning-text)]">
              Not connected
            </p>
          ) : null}
        </div>
        {vendor ? (
          <Link
            prefetch={false}
            href={vendor.href}
            className="btn-secondary btn-sm"
          >
            Connect vendor
          </Link>
        ) : null}
      </div>
    </div>
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
