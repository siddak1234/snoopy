"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import type {
  AutomationSetupField,
  SubscriptionStatus,
} from "@/lib/automations";
import {
  saveSubscriptionConfiguration,
  setSubscriptionStatus,
  subscribeToAutomation,
  triggerRun,
  type ActionResult,
} from "./actions";

/**
 * The buttons on an automation card.
 *
 * A client component only because it holds pending state and the last refusal.
 * The work happens in server actions, so nothing here knows the backend origin
 * and no fetch call is written by hand.
 *
 * A refusal is shown rather than swallowed. "Add" can fail because the
 * subscription already exists, and "Go live" can fail because a connection is
 * unmet — both are answers a person needs, not console noise.
 */
export function AutomationActions({
  templateId,
  available,
  setup,
  subscription,
}: {
  templateId: string;
  available: boolean;
  setup: AutomationSetupField[];
  subscription: {
    id: string;
    status: SubscriptionStatus;
    canGoLive: boolean;
    config: Record<string, unknown>;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const submit = (
    action: (data: FormData) => Promise<ActionResult>,
    data: FormData,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) setError(result.error);
    });
  };

  const field = (entries: Record<string, string>): FormData => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.append(key, value);
    return data;
  };

  const closeSetup = () => {
    setSetupOpen(false);
    setError(null);
  };

  const closeRun = () => {
    setRunOpen(false);
    setError(null);
  };

  // The run input is opaque and validated by the automation, so the dialog only
  // checks that what the person typed is a JSON object before sending it. A
  // parseable but incomplete payload (e.g. "{}") is submitted and the server's
  // own refusal is surfaced on the run it creates.
  const submitRun = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const raw = String(data.get("input") ?? "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw === "" ? "{}" : raw);
    } catch {
      setError("Run input must be valid JSON.");
      return;
    }
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      setError("Run input must be a JSON object.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await triggerRun(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Follow the run so its steps — success or failure — are watched as they
      // appear, rather than failing silently out of sight in Activity.
      if (result.runId) router.push(`/account/runs/${result.runId}`);
    });
  };

  const submitSetup = (data: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await saveSubscriptionConfiguration(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      closeSetup();
    });
  };

  return (
    <div className="mt-auto flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!subscription ? (
          <Button
            variant="primary"
            size="sm"
            disabled={pending || !available}
            onClick={() => submit(subscribeToAutomation, field({ templateId }))}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        ) : (
          <>
            {setup.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setSetupOpen(true);
                }}
              >
                Set up
              </Button>
            ) : null}
            {subscription.status !== "live" ? (
              <Button
                variant="primary"
                size="sm"
                disabled={pending || !subscription.canGoLive || !available}
                onClick={() =>
                  submit(
                    setSubscriptionStatus,
                    field({ subscriptionId: subscription.id, status: "live" }),
                  )
                }
              >
                {pending ? "Working…" : "Go live"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  submit(
                    setSubscriptionStatus,
                    field({
                      subscriptionId: subscription.id,
                      status: "paused",
                    }),
                  )
                }
              >
                {pending ? "Working…" : "Pause"}
              </Button>
            )}

            {/* Only a live subscription can be run. The server refuses otherwise,
                and offering a button that is certain to fail is worse than not
                offering it. */}
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || subscription.status !== "live"}
              onClick={() => {
                setError(null);
                setRunOpen(true);
              }}
            >
              Run now
            </Button>
          </>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[var(--error-text)]">
          {error}
        </p>
      ) : null}

      {subscription && setupOpen ? (
        <Modal
          onClose={closeSetup}
          bubble
          ariaLabelledBy={`automation-setup-${subscription.id}-title`}
          ariaDescribedBy={`automation-setup-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-setup-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Automation setup
          </h2>
          <p
            id={`automation-setup-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Complete the settings supplied by this automation.
          </p>
          <form action={submitSetup} className="mt-6 space-y-6">
            <input
              type="hidden"
              name="subscriptionId"
              value={subscription.id}
            />
            <SetupFields setup={setup} config={subscription.config} />
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeSetup}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save setup"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {subscription && runOpen ? (
        <Modal
          onClose={closeRun}
          bubble
          ariaLabelledBy={`automation-run-${subscription.id}-title`}
          ariaDescribedBy={`automation-run-${subscription.id}-description`}
          zIndex={100}
        >
          <h2
            id={`automation-run-${subscription.id}-title`}
            className="text-xl font-semibold text-[var(--text)]"
          >
            Run now
          </h2>
          <p
            id={`automation-run-${subscription.id}-description`}
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Provide the trigger input for this run as a JSON object. Leave it as{" "}
            <code>{"{}"}</code> to send no input.
          </p>
          <form onSubmit={submitRun} className="mt-6 space-y-4">
            <input
              type="hidden"
              name="subscriptionId"
              value={subscription.id}
            />
            <div>
              <label
                htmlFor={`run-input-${subscription.id}`}
                className="block text-sm font-medium text-[var(--text)]"
              >
                Run input (JSON)
              </label>
              <textarea
                id={`run-input-${subscription.id}`}
                name="input"
                rows={6}
                defaultValue="{}"
                spellCheck={false}
                autoComplete="off"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 font-mono text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60"
              />
            </div>
            <FormError message={error} />
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={closeRun}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Running…" : "Run"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function SetupFields({
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
          <SetupField key={field.key} field={field} value={config[field.key]} />
        ))}
      </fieldset>
    );
  });
}

function SetupField({
  field,
  value,
}: {
  field: AutomationSetupField;
  value: unknown;
}) {
  const hasDefault = Object.hasOwn(field, "defaultValue");
  const initialValue = value ?? field.defaultValue;
  const required = field.required && !hasDefault;
  const fieldId = `setup-${field.key}`;

  if (field.control === "toggle") {
    return (
      <div>
        <input
          type="hidden"
          name={`config-control:${field.key}`}
          value={field.control}
        />
        <label
          htmlFor={fieldId}
          className="flex items-start gap-3 text-sm text-[var(--text)]"
        >
          <input
            id={fieldId}
            name={`config:${field.key}`}
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
        <SetupFieldMetadata field={field} />
      </div>
    );
  }

  return (
    <div>
      <input
        type="hidden"
        name={`config-control:${field.key}`}
        value={field.control}
      />
      <FormInput
        id={fieldId}
        name={`config:${field.key}`}
        type={inputType(field.control)}
        step={field.control === "money" ? "any" : undefined}
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
      <SetupFieldMetadata field={field} />
    </div>
  );
}

function inputType(
  control: AutomationSetupField["control"],
): "number" | "text" {
  if (control === "money") return "number";
  // The contract provides no resource-list endpoint. A resource-picker therefore
  // accepts the supplied opaque value without inventing a provider-specific list.
  if (control === "resource-picker") return "text";
  return "text";
}

function SetupFieldMetadata({ field }: { field: AutomationSetupField }) {
  if (!field.notifies) return null;
  return <p className="mt-1 text-xs text-[var(--muted)]">{field.notifies}</p>;
}
