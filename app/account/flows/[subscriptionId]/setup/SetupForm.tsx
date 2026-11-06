"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { NumberedStep } from "@/components/ui/NumberedStep";
import type {
  AutomationSetupField,
  AutomationSetupSection,
  SubscriptionStatus,
} from "@/lib/automations";
import type { Connection, OfferedProvider } from "@/lib/connections";
import {
  connectionFor,
  connectionState,
  type ProviderAuthType,
} from "@/lib/connection-rows";
import {
  NONE,
  connectFirst,
  connectFirstOrNone,
  flowPath,
} from "@/lib/flow-steps";
import { ConnectionsPanel } from "@/app/account/connections/ConnectionsPanel";
import { PENDING_CONNECT } from "@/app/account/connections/pending-connect";
import { acceptThenRepeat, contractAllowsTurnOn } from "@/lib/health-agreement";
import { saveSetup } from "../../actions";
import { acceptHealthAgreement } from "../../agreement-actions";
import {
  SECTION_NAME,
  SetupFields,
  setupSectionCount,
} from "../../ManifestFields";
import { missingChoices, setupProblem } from "../../setup-check";
import { VendorRows, type VendorOption } from "../../VendorRows";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";
import { FLOW_CHANGE_ADMIN_ONLY } from "@/lib/subscription-entitlements";
import {
  ContractStep,
  type ContractSigned,
  type ContractView,
} from "./ContractStep";

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
 *
 * A flow that carries health data draws "Contract and accept" after its own
 * sections, numbered next (`ContractStep`; the owner's item 9 of builds 37
 * and 39; backend ADR-0049 amendment 2). Its Turn on is disabled until the
 * section allows it (`contractAllowsTurnOn`: accepted, or the owner's box
 * ticked and both fields filled); for the owner one press accepts (the text's
 * version and sha256, one key per text read), then saves and turns the flow
 * on, and a retry after a later refusal never accepts twice
 * (`acceptThenRepeat`). A text that changed since it was read (409) is read
 * again, the box unticked; a turn-on the platform refuses 403
 * `agreement_required` reads the section again, the box unticked and a new
 * key — never the agreement dialog. "Accepted" by this page's press holds
 * only while the text offered is the one it accepted (its sha256): a newer
 * version read since is signed afresh.
 * Save, on a flow on or paused, is never held by it.
 *
 * Only an owner or admin changes a flow (backend §12.1 #180): to a member the
 * page is read-only — the vendor rows and the settings drawn as they are, no
 * Turn on or Save — under "Only an owner or admin can change this flow.".
 * ~~A member makes a newly added flow's first choice~~ until Round 21's stage
 * 1 (it was ADR-0043 §2's).
 */
export function SetupForm({
  workspaceId,
  subscriptionId,
  status,
  available,
  setup,
  sections,
  config,
  vendorFields,
  required,
  connections,
  canManage,
  returnTo,
  callbackStatus,
  contract = null,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  status: SubscriptionStatus;
  available: boolean;
  /** The settings of the version the flow runs. */
  setup: AutomationSetupField[];
  /** Its manifest's sections, when it declares them (`Subscription.setupSections`). */
  sections?: AutomationSetupSection[];
  config: Record<string, unknown>;
  vendorFields: SetupVendorField[];
  /** The accounts the flow cannot run without. */
  required: OfferedProvider[];
  connections: Connection[];
  canManage: boolean;
  /** This page, for a connect's way back. */
  returnTo: string;
  callbackStatus: "connected" | "error" | null;
  /** The health data agreement's section, for a flow that carries health data; else null. */
  contract?: ContractView | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Every required drop-down the save found empty, said under each.
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());
  const [picked, setPicked] = useState<Record<string, string>>({});
  // The owner's signature, accepted by this page's press, and the key of
  // the text read (a new one after the text changed).
  const [signed, setSigned] = useState<ContractSigned>({
    authorized: false,
    name: "",
    title: "",
  });
  // The hash of the text this page's press accepted.
  const [acceptedHere, setAcceptedHere] = useState<string | null>(null);
  const [agreementKey, setAgreementKey] = useState(
    () => `agreement-${crypto.randomUUID()}`,
  );
  // Read in the browser only: which vendor this tab's last connect left for.
  const returnedFor = useSyncExternalStore(
    noSubscription,
    pendingConnect,
    () => null,
  );
  // A draft is turned on by this page; a flow on or paused keeps its status.
  const turnOn = status === "draft";
  // A public service (`authType` none) is connected for every workspace
  // (platform round 2's B5).
  const authTypes = new Map<string, ProviderAuthType | undefined>([
    ...required.map(
      (provider) => [provider.providerId, provider.authType] as const,
    ),
    ...vendorFields.flatMap((field) =>
      field.options.map(
        (option) => [option.providerId, option.authType] as const,
      ),
    ),
  ]);
  const connected = (providerId: string) =>
    connectionState(
      connectionFor(connections, providerId),
      authTypes.get(providerId),
    ) === "connected";

  const choiceOf = (field: SetupVendorField) => {
    if (picked[field.key] !== undefined) return picked[field.key]!;
    const returned =
      callbackStatus === "connected" &&
      returnedFor !== null &&
      field.options.some((option) => option.providerId === returnedFor) &&
      connected(returnedFor);
    return returned ? returnedFor! : field.saved;
  };

  // The manifest's own sections (ADR-0048 amendment 5) draw each vendor
  // choice in the section it names; Connect then holds only the accounts
  // the flow cannot run without.
  const declared = (sections?.length ?? 0) > 0;
  const hasConnect =
    (!declared && vendorFields.length > 0) || required.length > 0;
  // Accepted by this page's press: said so while the text offered is the
  // one accepted — a newer one read since (a turn-on refused 403) is signed.
  const shownContract: ContractView | null =
    contract && acceptedHere !== null && contract.offer?.sha256 === acceptedHere
      ? {
          ...contract,
          state: "accepted",
          acceptance: {
            version: contract.offer.version,
            signerName: signed.name.trim(),
            signerTitle: signed.title.trim(),
            acceptedAt: contract.today,
          },
        }
      : contract;
  // Only Turn on is held by the agreement (the platform asks nothing of Save).
  const contractHolds =
    turnOn &&
    shownContract !== null &&
    !contractAllowsTurnOn(shownContract.state, signed);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspaceId);
    const empty = missingChoices(setup, data);
    setMissing(empty);
    if (empty.size > 0) return;
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
    // The owner signing: accept first, once, then turn on.
    const offer = shownContract?.state === "sign" ? shownContract.offer : null;
    const signing = turnOn && offer !== null;
    const accept = async () => {
      const form = new FormData();
      form.set("workspaceId", workspaceId);
      form.set("version", String(offer!.version));
      form.set("sha256", offer!.sha256);
      form.set("signerName", signed.name);
      form.set("signerTitle", signed.title);
      form.set("authorized", "true");
      form.set("agreementKey", agreementKey);
      const answer = await acceptHealthAgreement(form);
      if (!answer.ok && answer.state === "agreement-changed") {
        // Read again: the box unticked, the name and title kept, a new key.
        setSigned((current) => ({ ...current, authorized: false }));
        setAgreementKey(`agreement-${crypto.randomUUID()}`);
        router.refresh();
      }
      return answer;
    };
    const save = async (): Promise<string | null> => {
      const result = await saveSetup(data);
      if (result.ok) {
        router.push(flowPath(subscriptionId));
        return null;
      }
      // Its section, read again, says what is owed: a text to sign again
      // is signed afresh — the box unticked, a new key.
      if (result.state === "agreement-required") {
        setSigned((current) => ({ ...current, authorized: false }));
        setAgreementKey(`agreement-${crypto.randomUUID()}`);
        router.refresh();
        return null;
      }
      return result.error;
    };
    startTransition(async () => {
      const pressed = await acceptThenRepeat(!signing, accept, save);
      if (signing && pressed.accepted && offer) setAcceptedHere(offer.sha256);
      setError(pressed.error);
    });
  };

  /** One step's vendor choice: its rows, a tap the choice. */
  const vendorRows = (field: SetupVendorField) => (
    <div
      key={field.key}
      data-testid={`setup-vendor-${field.key}`}
      className={`flex flex-col ${SPACING.inner.gap}`}
    >
      {/* A flow that chooses a vendor for more than one step names each step's choice. */}
      {vendorFields.length > 1 ? (
        <p className="text-xs font-medium text-[var(--muted)]">{field.title}</p>
      ) : null}
      <VendorRows
        label={field.title}
        options={field.options}
        chosen={choiceOf(field)}
        canManage={canManage}
        // A member changes no flow (§12.1 #180).
        readOnly={!canManage}
        workspaceId={workspaceId}
        saving={null}
        returnTo={returnTo}
        onChoose={(choice) => {
          setError(null);
          setPicked((current) => ({ ...current, [field.key]: choice }));
        }}
      />
    </div>
  );

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
          {declared ? null : vendorFields.map(vendorRows)}
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
        <fieldset
          disabled={!canManage}
          className={`flex min-w-0 flex-col ${SPACING.group.gap}`}
        >
          <SetupFields
            setup={setup}
            config={config}
            sections={sections}
            firstSection={hasConnect ? 2 : 1}
            hideConnections
            vendors={(key) => {
              const field = vendorFields.find((one) => one.key === key);
              return field ? vendorRows(field) : null;
            }}
            missingChoices={missing}
          />
        </fieldset>
        {shownContract ? (
          <ContractStep
            index={
              (hasConnect ? 1 : 0) +
              setupSectionCount(setup, sections, true) +
              1
            }
            view={shownContract}
            signed={signed}
            onSigned={(next) => {
              setError(null);
              setSigned(next);
            }}
          />
        ) : null}
        <FormError message={error} />
        {canManage ? (
          <div>
            <Button type="submit" disabled={pending || contractHolds}>
              {turnOn
                ? pending
                  ? "Turning on…"
                  : "Turn on"
                : pending
                  ? "Saving…"
                  : "Save"}
            </Button>
          </div>
        ) : (
          <p
            data-testid="flow-change-admin-only"
            className="text-xs text-[var(--muted)]"
          >
            {FLOW_CHANGE_ADMIN_ONLY}
          </p>
        )}
      </form>
    </Group>
  );
}
