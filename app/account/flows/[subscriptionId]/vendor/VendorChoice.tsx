"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr/Check";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import Modal from "@/components/ui/Modal";
import {
  VendorConnectButton,
  VendorMark,
} from "@/components/dashboard/VendorLogo";
import { DISCONNECT_BODY, brandLogo, disconnectTitle } from "@/lib/brand-logos";
import {
  beginConnectionAuthorization,
  disconnectConnection,
} from "@/app/account/connections/actions";
import {
  PENDING_CONNECT,
  rememberConnect,
} from "@/app/account/connections/pending-connect";
import { saveVendorChoice } from "../../actions";
import { vendorPath } from "../../vendor-path";

/** One vendor the flow may use: an optional connection of its manifest. */
export type VendorOption = {
  providerId: string;
  displayName: string;
  /** The provider's published icon name, which may name its logo. */
  icon: string | null;
  /** Whether it connects through the vendor's consent page, here. */
  connectable: boolean;
  /** The workspace's live connection to it, or null. */
  connectionId: string | null;
};

const NONE = "none";

function pendingConnect(): string | null {
  try {
    return sessionStorage.getItem(PENDING_CONNECT);
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

/**
 * The vendor rows and Save (spec §3.C). A row is chosen by a tap; a check (24)
 * marks the choice. A vendor that is not connected cannot be chosen until it
 * is: an owner or admin connects it from its row — QuickBooks with Intuit's
 * own Connect to QuickBooks button — and, back from the vendor's sign-in, it is
 * the choice; a member is told who connects it. A connected vendor's row says
 * so and, for an owner or admin, offers its disconnect — "Disconnect from
 * QuickBooks", Intuit's words — confirmed first, as in the app, since it ends
 * the connection every flow in the workspace acts through. None is always
 * last: the details are saved, and no vendor is called.
 */
export function VendorChoice({
  workspaceId,
  subscriptionId,
  saved,
  options,
  canManage,
  callbackStatus,
}: {
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  subscriptionId: string;
  /** The choice the flow holds now. */
  saved: string;
  options: VendorOption[];
  canManage: boolean;
  /** Back from a vendor's sign-in, as Connections was told it ended. */
  callbackStatus: "connected" | "error" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The vendor whose disconnect is being confirmed, and its refusal.
  const [disconnecting, setDisconnecting] = useState<VendorOption | null>(null);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  // Read in the browser only: which vendor this tab's last connect left for.
  const returnedFor = useSyncExternalStore(
    noSubscription,
    pendingConnect,
    () => null,
  );
  const connected = (providerId: string) =>
    options.some(
      (option) =>
        option.providerId === providerId && option.connectionId !== null,
    );
  // Back from a vendor's sign-in that connected it, that vendor is the choice
  // until another is picked; otherwise the flow's own.
  const choice =
    picked ??
    (callbackStatus === "connected" &&
    returnedFor !== null &&
    connected(returnedFor)
      ? returnedFor
      : saved);

  const connect = (option: VendorOption) => {
    setError(null);
    startTransition(async () => {
      const result = await beginConnectionAuthorization(
        workspaceId,
        option.providerId,
      );
      if (result.ok && result.alreadyConnectedAs) {
        setPicked(option.providerId);
        router.refresh();
        return;
      }
      if (!result.ok || !result.authorizationUrl) {
        setError(result.ok ? "Could not start the connection" : result.error);
        return;
      }
      // Connections, where the vendor's sign-in returns, comes back here.
      rememberConnect(option.providerId, vendorPath(subscriptionId));
      window.location.assign(result.authorizationUrl);
    });
  };

  const closeDisconnect = () => {
    if (pending) return;
    setDisconnecting(null);
    setDisconnectError(null);
  };

  const confirmDisconnect = (option: VendorOption) => {
    if (!option.connectionId) return;
    const connectionId = option.connectionId;
    setDisconnectError(null);
    startTransition(async () => {
      const result = await disconnectConnection(workspaceId, connectionId);
      if (!result.ok) {
        setDisconnectError(result.error);
        return;
      }
      // A vendor no longer connected is no choice: None until it is
      // connected again (as the app does).
      if (choice === option.providerId) setPicked(NONE);
      setDisconnecting(null);
      router.refresh();
    });
  };

  const save = () => {
    setError(null);
    setSaving(true);
    startTransition(async () => {
      const data = new FormData();
      data.set("workspaceId", workspaceId);
      data.set("subscriptionId", subscriptionId);
      data.set("choice", choice);
      const result = await saveVendorChoice(data);
      if (!result.ok) {
        setSaving(false);
        const vendor = options.find((option) => option.providerId === choice);
        setError(
          result.state === "vendor-not-connected" && vendor
            ? `Connect ${vendor.displayName} first, or choose None.`
            : result.error,
        );
        return;
      }
      router.push(`/account/flows#flow-${subscriptionId}`);
    });
  };

  return (
    <div className="py-5 first:pt-0">
      {callbackStatus === "error" ? (
        <p role="alert" className="mb-4 text-sm text-[var(--error-text)]">
          The connection could not be completed. Try again or contact an owner.
        </p>
      ) : null}
      <fieldset>
        <legend className="sr-only">Connect vendor</legend>
        <div className="flex flex-col divide-y divide-[var(--ring)]">
          {options.map((option) => {
            const isConnected = option.connectionId !== null;
            const logo = brandLogo(option.icon);
            return (
              <div
                key={option.providerId}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <label
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-md)] p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent-strong)] ${isConnected ? "cursor-pointer" : ""}`.trim()}
                >
                  <input
                    type="radio"
                    name="vendor"
                    value={option.providerId}
                    checked={choice === option.providerId}
                    disabled={!isConnected || pending}
                    onChange={() => setPicked(option.providerId)}
                    className="sr-only"
                  />
                  {/* A logo keeps its own clear space (VendorLogo's). */}
                  <VendorMark
                    icon={option.icon}
                    displayName={option.displayName}
                  />
                  {isConnected ? (
                    <span className="text-sm text-[var(--success-text)]">
                      Connected
                    </span>
                  ) : null}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {!canManage ? (
                    isConnected ? null : (
                      <p className="text-sm text-[var(--muted)]">
                        Ask an owner or admin to connect it.
                      </p>
                    )
                  ) : isConnected && option.connectionId ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        setDisconnectError(null);
                        setDisconnecting(option);
                      }}
                      className="text-sm text-[var(--link)] underline underline-offset-2 disabled:opacity-60"
                    >
                      {logo ? logo.disconnectLabel : "Disconnect"}
                    </button>
                  ) : !option.connectable ? (
                    <Button
                      href="/account/connections"
                      variant="secondary"
                      size="sm"
                      prefetch={false}
                    >
                      Connect
                    </Button>
                  ) : logo ? (
                    <VendorConnectButton
                      logo={logo}
                      disabled={pending}
                      onClick={() => connect(option)}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => connect(option)}
                    >
                      Connect
                    </Button>
                  )}
                  <ChoiceMark chosen={choice === option.providerId} />
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-4 py-4">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[var(--radius-md)] p-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--accent-strong)]">
              <input
                type="radio"
                name="vendor"
                value={NONE}
                checked={choice === NONE}
                disabled={pending}
                onChange={() => setPicked(NONE)}
                className="sr-only"
              />
              <ProhibitIcon
                size={24}
                aria-hidden
                className="shrink-0 text-[var(--muted)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[var(--text)]">
                  None
                </span>
                <span className="block text-xs text-[var(--muted)]">
                  Save the details only.
                </span>
              </span>
            </label>
            <ChoiceMark chosen={choice === NONE} />
          </div>
        </div>
      </fieldset>
      {/* One refusal, one alert (register F52): the dialog's own says it. */}
      {disconnecting ? null : <FormError message={error} className="mt-4" />}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {disconnecting ? (
        <Modal
          onClose={closeDisconnect}
          bubble
          ariaLabelledBy="disconnect-vendor-title"
          ariaDescribedBy="disconnect-vendor-description"
          zIndex={100}
          dismissible={!pending}
        >
          <h2
            id="disconnect-vendor-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            {disconnectTitle(disconnecting.icon, disconnecting.displayName)}
          </h2>
          <p
            id="disconnect-vendor-description"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            {DISCONNECT_BODY}
          </p>
          <FormError message={disconnectError} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeDisconnect}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => confirmDisconnect(disconnecting)}
              disabled={pending}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

/** The check (24) on the chosen row; the radio itself says it to a screen reader. */
function ChoiceMark({ chosen }: { chosen: boolean }) {
  return (
    <span aria-hidden className="inline-flex size-6 shrink-0">
      {chosen ? (
        <CheckIcon size={24} className="text-[var(--accent-strong)]" />
      ) : null}
    </span>
  );
}
