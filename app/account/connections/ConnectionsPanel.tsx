"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import {
  ConnectionMark,
  ConnectionRow,
} from "@/components/dashboard/ConnectionRow";
import {
  CONNECTIONS_MANAGED_BY,
  DISCONNECT_LABEL,
  connectionAction,
  connectionFor,
  connectionLine,
  connectionState,
  disconnectBody,
  disconnectTitle,
} from "@/lib/connection-rows";
import type { Connection, ConnectionProvider } from "@/lib/connections";
import { connectProviderWithKey, disconnectConnection } from "./actions";
import {
  PENDING_CONNECT,
  takeConnectReturn,
  withCallbackStatus,
} from "./pending-connect";
import { startConnect } from "./start-connect";
import { Group } from "@/components/dashboard/Group";
import { SPACING } from "@/lib/spacing";

function pendingConnect(): string | null {
  try {
    return sessionStorage.getItem(PENDING_CONNECT);
  } catch {
    return null;
  }
}

const noSubscription = () => () => {};

/**
 * The connections a page lists, each the one row (Build 21, spec A4; the
 * owner's build 20 items 6 and 7): Connections, and a flow page's Connections
 * — one row for every provider, its mark at 24, its name, the account's email
 * or its state under it, and for an owner or admin one button of ours:
 * Connect, Reconnect or Disconnect. ~~What connecting it lets flows do, "Used
 * by N live flows", Available connections, Intuit's Connect button image,
 * "Disconnect from QuickBooks" and Replace account~~ until Build 21 (the
 * platform's replace route stays, unused; the owner's ~04:15Z: "we will list
 * on apples app store not intuits. so we do not need that").
 *
 * `canManage` is the page's reading of the platform's rule: connecting or
 * disconnecting supersedes the account every flow in the workspace acts
 * through, so it is an owner's or an admin's. A member sees the rows and is
 * told who can change them (register F8); the server refuses them either way.
 *
 * Connect and Reconnect go through the provider at once — Reconnect keeps the
 * account (backend ADR-0019 §4) — and a key provider's opens its key form. A
 * connect started on a flow's page (`returnTo`) comes back to it. **Disconnect
 * asks first**, saying what it stops: "{n} live flows use it. They stop until
 * you connect it again."
 */
export function ConnectionsPanel({
  connections,
  providers,
  canManage,
  callbackStatus,
  workspaceId,
  returnTo,
}: {
  connections: Connection[];
  /** The providers to list, in order: every one on Connections, a flow's own on its page. */
  providers: ConnectionProvider[];
  canManage: boolean;
  /** Back from a vendor's sign-in, as the platform's callback said it ended. */
  callbackStatus: "connected" | "error" | null;
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
  /** Where a connect started here comes back to: a flow's page. */
  returnTo?: string;
}) {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] =
    useState<ConnectionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A connect's answer, under its row.
  const [rowError, setRowError] = useState<{
    providerId: string;
    message: string;
  } | null>(null);
  const [retryWithSameIntent, setRetryWithSameIntent] = useState(false);
  const [connectionIntentKey, setConnectionIntentKey] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  // The provider whose disconnect is being confirmed, and its refusal.
  const [disconnecting, setDisconnecting] = useState<ConnectionProvider | null>(
    null,
  );
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Read in the browser only: the server cannot know, so the unfinished-connect
  // banner is drawn once, in its final words, rather than announced as one
  // sentence and changed to another on hydration.
  const returnedFor = useSyncExternalStore(
    noSubscription,
    pendingConnect,
    () => undefined,
  );

  // A connect started on a flow's page goes back there once the vendor's
  // sign-in has landed here, with how it ended (spec A2).
  useEffect(() => {
    if (!callbackStatus) return;
    const back = takeConnectReturn();
    if (back) router.replace(withCallbackStatus(back, callbackStatus));
  }, [callbackStatus, router]);

  const close = () => {
    setSelectedProvider(null);
    setError(null);
    setRetryWithSameIntent(false);
    setConnectionIntentKey(null);
  };

  const connectionOf = (providerId: string) =>
    connectionFor(connections, providerId);

  const authorize = (provider: ConnectionProvider) => {
    setBusyProvider(provider.providerId);
    startTransition(async () => {
      const started = await startConnect(
        workspaceId,
        provider.providerId,
        returnTo,
      );
      if (started.status === "already") {
        setBusyProvider(null);
        setNotice(
          `${provider.displayName} is already connected as ${started.connectedAs}, with everything it needs — there is nothing to authorize.`,
        );
        router.refresh();
        return;
      }
      if (started.status === "refused") {
        setBusyProvider(null);
        setRowError({
          providerId: provider.providerId,
          message: started.message,
        });
      }
    });
  };

  /** The row's one button. What the last one came back with goes as the next is pressed. */
  const press = (provider: ConnectionProvider) => {
    setError(null);
    setRowError(null);
    setNotice(null);
    if (connectionState(connectionOf(provider.providerId)) === "connected") {
      setDisconnectError(null);
      setDisconnecting(provider);
      return;
    }
    if (provider.authType === "api-key") {
      // This is intentionally browser-memory only: it identifies one explicit
      // connect intent, but neither it nor any credential is persisted.
      setConnectionIntentKey(`connection-${crypto.randomUUID()}`);
      setRetryWithSameIntent(false);
      setSelectedProvider(provider);
      return;
    }
    authorize(provider);
  };

  const submitKey = (formData: FormData) => {
    setError(null);
    setRetryWithSameIntent(false);
    startTransition(async () => {
      const result = await connectProviderWithKey(formData);
      if (!result.ok) {
        setError(result.error);
        setRetryWithSameIntent(Boolean(result.retryWithSameIntent));
        return;
      }
      close();
      router.refresh();
    });
  };

  const submitKeyForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("workspaceId", workspaceId);
    submitKey(data);
  };

  const closeDisconnect = () => {
    if (pending) return;
    setDisconnecting(null);
    setDisconnectError(null);
  };

  const confirmDisconnect = (provider: ConnectionProvider) => {
    const connection = connectionOf(provider.providerId);
    if (!connection) return;
    setDisconnectError(null);
    startTransition(async () => {
      const result = await disconnectConnection(workspaceId, connection.id);
      if (!result.ok) {
        setDisconnectError(result.error);
        return;
      }
      setDisconnecting(null);
      router.refresh();
    });
  };

  // Still active only when the provider the connect left for has a live
  // connection — never because some other provider does (register F100).
  const stillActive =
    typeof returnedFor === "string" &&
    connections.some(
      (connection) =>
        connection.providerId === returnedFor &&
        connection.status === "connected",
    );

  return (
    <Group>
      {callbackStatus === "connected" ? (
        <p role="status" className="mb-4 text-sm text-[var(--success-text)]">
          Connection completed successfully.
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="mb-4 text-sm text-[var(--success-text)]">
          {notice}
        </p>
      ) : null}
      {callbackStatus === "error" && returnedFor !== undefined ? (
        <p role="alert" className="mb-4 text-sm text-[var(--error-text)]">
          {stillActive
            ? "The new authorization didn't complete, so nothing changed — your existing connection is still active. Try again or contact an owner."
            : "The connection could not be completed. Try again or contact an owner."}
        </p>
      ) : null}

      {providers.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No connection providers are available in this environment.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--ring)]">
          {providers.map((provider) => {
            const connection = connectionOf(provider.providerId);
            const state = connectionState(connection);
            const line = connectionLine(connection);
            const action = connectionAction(state);
            const failed = rowError?.providerId === provider.providerId;
            return (
              <li key={provider.providerId}>
                <ConnectionRow
                  testId={`connection-${provider.providerId}`}
                  mark={<ConnectionMark icon={provider.icon} />}
                  name={provider.displayName}
                  line={line.text}
                  lineTone={line.tone}
                  right={
                    !canManage ? null : action === DISCONNECT_LABEL ? (
                      // Red: it ends the connection every flow here acts
                      // through (the owner's build 12, #5).
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        disabled={pending}
                        aria-label={`Disconnect ${provider.displayName}`}
                        onClick={() => press(provider)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={pending}
                        aria-label={`${action} ${provider.displayName}`}
                        onClick={() => press(provider)}
                      >
                        {busyProvider === provider.providerId && pending
                          ? "Working…"
                          : action}
                      </Button>
                    )
                  }
                />
                {failed ? (
                  <p
                    role="alert"
                    className={`${SPACING.inner.pb} text-xs text-[var(--error-text)]`}
                  >
                    {rowError.message}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {canManage || providers.length === 0 ? null : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          {CONNECTIONS_MANAGED_BY}
        </p>
      )}

      {disconnecting ? (
        <Modal
          onClose={closeDisconnect}
          bubble
          ariaLabelledBy="disconnect-connection-title"
          ariaDescribedBy="disconnect-connection-description"
          zIndex={100}
          dismissible={!pending}
        >
          <h2
            id="disconnect-connection-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            {disconnectTitle(disconnecting.displayName)}
          </h2>
          <p
            id="disconnect-connection-description"
            className={`${SPACING.title.top} text-sm text-[var(--muted)]`}
          >
            {disconnectBody(
              connectionOf(disconnecting.providerId)?.usedByCount ?? 0,
            )}
          </p>
          <FormError message={disconnectError} className={SPACING.inner.top} />
          <div className="mt-4 flex flex-wrap gap-2">
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

      {selectedProvider ? (
        <Modal
          onClose={close}
          bubble
          ariaLabelledBy="connect-provider-title"
          ariaDescribedBy="connect-provider-description"
          zIndex={100}
        >
          <h2
            id="connect-provider-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Connect {selectedProvider.displayName}
          </h2>
          <p
            id="connect-provider-description"
            className={`${SPACING.title.top} text-sm text-[var(--muted)]`}
          >
            Provide the connection details supplied by this provider.
          </p>
          <form
            onSubmit={submitKeyForm}
            className={`${SPACING.group.top} flex flex-col ${SPACING.group.gap}`}
          >
            <input
              type="hidden"
              name="providerId"
              value={selectedProvider.providerId}
            />
            <input
              type="hidden"
              name="idempotencyKey"
              value={connectionIntentKey ?? ""}
            />
            {selectedProvider.credentialFields?.map((field) => (
              <FormInput
                key={field.name}
                id={`credential-${field.name}`}
                name={`credential:${field.name}`}
                type={field.secret ? "password" : "text"}
                label={field.label}
                hint={field.help}
                required
                autoComplete="off"
              />
            ))}
            <FormError message={error} />
            {retryWithSameIntent ? (
              <p className="text-xs text-[var(--muted)]">
                This request may still be in progress. Retry with the same
                details or refresh the connection list; a new connection request
                was not created.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending
                  ? "Verifying…"
                  : retryWithSameIntent
                    ? "Retry verification"
                    : "Verify and connect"}
              </Button>
              {retryWithSameIntent ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => router.refresh()}
                >
                  Refresh connections
                </Button>
              ) : null}
            </div>
          </form>
        </Modal>
      ) : null}
    </Group>
  );
}
