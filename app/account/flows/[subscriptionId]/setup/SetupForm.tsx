"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { NumberedStep } from "@/components/ui/NumberedStep";
import type { SubscriptionStatus } from "@/lib/automations";
import type { Connection, ConnectionProvider } from "@/lib/connections";
import type { PendingSetupField } from "@/lib/pending-contract";
import { connectionFor, connectionState } from "@/lib/connection-rows";
import {
  NONE,
  connectFirst,
  connectFirstOrNone,
  flowPath,
} from "@/lib/flow-steps";
import { ConnectionsPanel } from "@/app/account/connections/ConnectionsPanel";
import { PENDING_CONNECT } from "@/app/account/connections/pending-connect";
import { saveSetup } from "../../actions";
import { SECTION_NAME, SetupFields } from "../../ManifestFields";
import { missingChoice, setupProblem } from "../../setup-check";
import { VendorRows, type VendorOption } from "../../VendorRows";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";

/** One step's vendor choice on Set up. */
export type SetupVendorField = {
  key: string;
  title: string;
  /** The choice the flow holds now. */
  saved: string;
  options: VendorOption[];
};

function pendingConnect(): string | null {
  try {
    return sessionStorage.getItem(PENDING_CONNECT);
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

const UNAVAILABLE = "This flow is not responding, so it cannot run yet.";

/**
 * Set up's page body (Build 21; the owner's AM4): 1 · Connect — each step's
 * vendor rows, a tap the choice; each account the flow cannot run without —
 * then its settings, numbered on, and one button. What it cannot send is said
 * in the spec's words, and nothing is sent: an empty amount ("Enter an amount
 * for {title}."), a required field left empty ("Fill in: {titles}."), a vendor
 * chosen and not connected ("Connect {name} first, or choose None." — for
 * Save, only a vendor this page changed), and, to turn on, an account the flow
 * cannot run without ("Connect {names} first.") or a flow not answering.
 *
 * Back from a vendor's sign-in that connected the vendor the connect left for,
 * that vendor is its step's choice, until another is picked.
 */
export function SetupForm({
  workspaceId,
  subscriptionId,
  status,
  available,
  setup,
  config,
  vendorFields,
  required,
  connections,
  canManage,
  returnTo,
  callbackStatus,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  available: boolean;
  /** The settings of the version the flow runs. */
  setup: PendingSetupField[];
  config: Record<string, unknown>;
  vendorFields: SetupVendorField[];
  /** The accounts the flow cannot run without. */
  required: ConnectionProvider[];
  connections: Connection[];
  canManage: boolean;
  /** This page, for a connect's way back. */
  returnTo: string;
  callbackStatus: "connected" | "error" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The required drop-down the save found empty, said under it.
  const [missing, setMissing] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, string>>({});
  // Read in the browser only: which vendor this tab's last connect left for.
  const returnedFor = useSyncExternalStore(
    noSubscription,
    pendingConnect,
    () => null,
  );
  // A draft is turned on by this page; a flow on or paused keeps its status.
  const turnOn = status === "draft";
  const connected = (providerId: string) =>
    connectionState(connectionFor(connections, providerId)) === "connected";

  const choiceOf = (field: SetupVendorField) => {
    if (picked[field.key] !== undefined) return picked[field.key]!;
    const returned =
      callbackStatus === "connected" &&
      returnedFor !== null &&
      field.options.some((option) => option.providerId === returnedFor) &&
      connected(returnedFor);
    return returned ? returnedFor! : field.saved;
  };

  const hasConnect = vendorFields.length > 0 || required.length > 0;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspaceId);
    const empty = missingChoice(setup, data);
    setMissing(empty);
    if (empty) return;
    const problem = setupProblem(
      setup.filter((field) => field.control !== "connection"),
      data,
    );
    if (problem) {
      setError(problem);
      return;
    }
    for (const field of vendorFields) {
      const chosen = choiceOf(field);
      const changed = turnOn || chosen !== field.saved;
      if (changed && chosen !== NONE && !connected(chosen)) {
        const option = field.options.find(
          (candidate) => candidate.providerId === chosen,
        );
        setError(connectFirstOrNone(option?.displayName ?? chosen));
        return;
      }
    }
    if (turnOn) {
      if (!available) {
        setError(UNAVAILABLE);
        return;
      }
      const owed = required.filter(
        (provider) => !connected(provider.providerId),
      );
      if (owed.length > 0) {
        setError(
          connectFirst(owed.map((provider) => provider.displayName).join(", ")),
        );
        return;
      }
    }
    for (const field of vendorFields) {
      data.set(`config-control:${field.key}`, "connection");
      data.set(`config:${field.key}`, choiceOf(field));
    }
    data.set("turnOn", turnOn ? "true" : "false");
    startTransition(async () => {
      const result = await saveSetup(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(flowPath(subscriptionId));
    });
  };

  return (
    <Group className={`flex flex-col ${SPACING.group.gap}`}>
      {callbackStatus === "connected" ? (
        <p role="status" className="text-sm text-[var(--success-text)]">
          Connection completed successfully.
        </p>
      ) : null}
      {callbackStatus === "error" ? (
        <p role="alert" className="text-sm text-[var(--error-text)]">
          The connection could not be completed. Try again or contact an owner.
        </p>
      ) : null}

      {hasConnect ? (
        <div
          role="group"
          aria-label={SECTION_NAME.connections}
          className={`flex flex-col ${SPACING.group.gap}`}
        >
          <NumberedStep index={1} title={SECTION_NAME.connections} />
          {vendorFields.map((field) => (
            <div
              key={field.key}
              data-testid={`setup-vendor-${field.key}`}
              className={`flex flex-col ${SPACING.inner.gap}`}
            >
              {/* A flow that chooses a vendor for more than one step names each step's choice. */}
              {vendorFields.length > 1 ? (
                <p className="text-xs font-medium text-[var(--muted)]">
                  {field.title}
                </p>
              ) : null}
              <VendorRows
                label={field.title}
                options={field.options}
                chosen={choiceOf(field)}
                canManage={canManage}
                // A member changes no flow already on; a new flow's first
                // choice is theirs (ADR-0043 §2; the app's Set up).
                readOnly={!canManage && !turnOn}
                workspaceId={workspaceId}
                saving={null}
                returnTo={returnTo}
                onChoose={(choice) => {
                  setError(null);
                  setPicked((current) => ({ ...current, [field.key]: choice }));
                }}
              />
            </div>
          ))}
          {required.length > 0 ? (
            <ConnectionsPanel
              workspaceId={workspaceId}
              connections={connections}
              providers={required}
              canManage={canManage}
              callbackStatus={null}
              returnTo={returnTo}
            />
          ) : null}
        </div>
      ) : null}

      <form
        onSubmit={submit}
        noValidate
        className={`flex flex-col ${SPACING.group.gap}`}
      >
        <input type="hidden" name="subscriptionId" value={subscriptionId} />
        <SetupFields
          setup={setup}
          config={config}
          firstSection={hasConnect ? 2 : 1}
          hideConnections
          missingChoice={missing}
        />
        <FormError message={error} />
        <div>
          <Button type="submit" disabled={pending}>
            {turnOn
              ? pending
                ? "Turning on…"
                : "Turn on"
              : pending
                ? "Saving…"
                : "Save"}
          </Button>
        </div>
      </form>
    </Group>
  );
}
