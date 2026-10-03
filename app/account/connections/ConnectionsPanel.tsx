"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { StatusPill } from "@/components/dashboard/StatusPill";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/ui/FormError";
import { FormInput } from "@/components/ui/FormInput";
import Modal from "@/components/ui/Modal";
import type { Connection, ConnectionProvider } from "@/lib/connections";
import {
  beginConnectionAuthorization,
  connectProviderWithKey,
  disconnectConnection,
} from "./actions";

/**
 * `canManage` is the page's reading of the platform's rule: connecting or
 * disconnecting supersedes the account every automation in the workspace acts
 * through, so it is an owner's or an admin's (`assertMayManageConnections`). A
 * member sees what is connected and is told who can change it (register F8);
 * the server refuses them either way.
 *
 * Reconnect keeps the account: the platform re-asks consent only when the grant
 * lacks something or needs repair, and completion must return the same account
 * (backend ADR-0019 §4). **Replace account** is the other intent — a different
 * account for every automation that uses this connection — so it is its own
 * control, confirmed first, and it names the exact connection it replaces
 * (backend 22.5.3, ADR-0026).
 */
export function ConnectionsPanel({
  connections,
  providers,
  canManage,
  callbackStatus,
  workspaceId,
}: {
  connections: Connection[];
  providers: ConnectionProvider[];
  canManage: boolean;
  callbackStatus: "connected" | "error" | null;
  /** The workspace this page shows; every action is refused once it is not active. */
  workspaceId: string;
}) {
  const router = useRouter();
  const [selectedProvider, setSelectedProvider] =
    useState<ConnectionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryWithSameIntent, setRetryWithSameIntent] = useState(false);
  const [connectionIntentKey, setConnectionIntentKey] = useState<string | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<Connection | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);

  const close = () => {
    setSelectedProvider(null);
    setError(null);
    setRetryWithSameIntent(false);
    setConnectionIntentKey(null);
  };

  const connect = (provider: ConnectionProvider) => {
    setError(null);
    setNotice(null);
    if (provider.authType === "api-key") {
      // This is intentionally browser-memory only: it identifies one explicit
      // connect intent, but neither it nor any credential is persisted.
      setConnectionIntentKey(`connection-${crypto.randomUUID()}`);
      setRetryWithSameIntent(false);
      setSelectedProvider(provider);
      return;
    }
    startTransition(async () => {
      const result = await beginConnectionAuthorization(
        workspaceId,
        provider.providerId,
      );
      if (result.ok && result.alreadyConnectedAs) {
        setNotice(
          `${provider.displayName} is already connected as ${result.alreadyConnectedAs}, with everything it needs — there is nothing to authorize.`,
        );
        router.refresh();
        return;
      }
      if (!result.ok || !result.authorizationUrl) {
        setError(result.ok ? "Could not start the connection" : result.error);
        return;
      }
      window.location.assign(result.authorizationUrl);
    });
  };

  const closeReplace = () => {
    if (pending) return;
    setReplacing(null);
    setReplaceError(null);
  };

  const confirmReplace = (connection: Connection) => {
    setReplaceError(null);
    startTransition(async () => {
      const result = await beginConnectionAuthorization(
        workspaceId,
        connection.providerId,
        connection.id,
      );
      // The contract's answer is a union; the platform does not reuse a grant
      // it was asked to replace, but a reused answer is still an answer.
      if (result.ok && result.alreadyConnectedAs) {
        setReplacing(null);
        setNotice(
          `${result.alreadyConnectedAs} is still connected — there was nothing to replace.`,
        );
        router.refresh();
        return;
      }
      if (!result.ok || !result.authorizationUrl) {
        setReplaceError(
          result.ok ? "Could not start the replacement" : result.error,
        );
        return;
      }
      window.location.assign(result.authorizationUrl);
    });
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

  const disconnect = async (connectionId: string) => {
    setError(null);
    setDisconnecting(connectionId);
    try {
      const result = await disconnectConnection(workspaceId, connectionId);
      if (!result.ok) setError(result.error);
      else router.refresh();
    } finally {
      setDisconnecting(null);
    }
  };

  // A live connection for a provider is one already `connected`. It changes both
  // what the callback-error banner should say and what the provider button offers.
  const connectedProviderIds = new Set(
    connections
      .filter((connection) => connection.status === "connected")
      .map((connection) => connection.providerId),
  );
  const hasConnected = connectedProviderIds.size > 0;
  // A connection that needs reauthorization is still this workspace's
  // connection: Reconnect is what repairs it (backend §12.1 #175).
  const reconnectableProviderIds = new Set(
    connections
      .filter(
        (connection) =>
          connection.status === "connected" ||
          connection.status === "reauthorization-required",
      )
      .map((connection) => connection.providerId),
  );
  // Only an OAuth connection has an account to replace through consent; a
  // pasted key is replaced by pasting another.
  const providerNamed = new Map(
    providers.map((provider) => [provider.providerId, provider]),
  );
  const replaceable = (connection: Connection) =>
    canManage &&
    connection.status !== "disconnected" &&
    providerNamed.get(connection.providerId)?.authType === "oauth2";

  return (
    <div className="py-5 first:pt-0">
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
      {callbackStatus === "error" ? (
        <p role="alert" className="mb-4 text-sm text-[var(--error-text)]">
          {hasConnected
            ? "The new authorization didn't complete, so nothing changed — your existing connection is still active. Try again or contact an owner."
            : "The connection could not be completed. Try again or contact an owner."}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {connections.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No external accounts are connected yet.
          </p>
        ) : (
          connections.map((connection) => (
            <div
              key={connection.id}
              className="flex flex-col gap-4 py-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-[var(--text)]">
                    {connection.externalAccount.displayName}
                  </p>
                  <StatusPill status={connection.status} />
                </div>
                {/* `usedByCount` is live subscriptions only — a draft is being
                    set up, not running — so the label says "live" to match. */}
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {connection.providerId} · Used by {connection.usedByCount}{" "}
                  live {connection.usedByCount === 1 ? "flow" : "flows"}
                </p>
                {connection.errorCode ? (
                  <p className="mt-1 text-xs text-[var(--warning-text)]">
                    This connection needs attention before it can be used.
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-2">
                  {replaceable(connection) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        setError(null);
                        setNotice(null);
                        setReplacing(connection);
                      }}
                    >
                      Replace account
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || disconnecting === connection.id}
                    onClick={() => disconnect(connection.id)}
                  >
                    {disconnecting === connection.id
                      ? "Disconnecting…"
                      : "Disconnect"}
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-5 border-t border-[var(--ring)] pt-5">
        <p className="text-sm font-medium text-[var(--text)]">
          Available connections
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Only providers configured for this deployment are shown.
        </p>
        {canManage ? null : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Only an owner or admin of this workspace can connect or disconnect
            an account.
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {providers.map((provider) => (
            <div
              key={provider.providerId}
              className="bubble flex flex-col gap-3 p-4"
            >
              <div>
                <p className="font-medium text-[var(--text)]">
                  {provider.displayName}
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {provider.description}
                </p>
              </div>
              {canManage ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => connect(provider)}
                >
                  {pending
                    ? "Connecting…"
                    : reconnectableProviderIds.has(provider.providerId)
                      ? "Reconnect"
                      : "Connect"}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        {providers.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No connection providers are available in this environment.
          </p>
        ) : null}
      </div>

      {/* One refusal, one alert (register F52): while a dialog is open its own
          alert carries the answer, so the panel's does not repeat it. */}
      {selectedProvider || replacing ? null : (
        <FormError message={error} className="mt-4" />
      )}

      {replacing ? (
        <Modal
          onClose={closeReplace}
          bubble
          ariaLabelledBy="replace-account-title"
          ariaDescribedBy="replace-account-description"
          zIndex={100}
        >
          <h2
            id="replace-account-title"
            className="text-xl font-semibold text-[var(--text)]"
          >
            Replace {replacing.externalAccount.displayName}?
          </h2>
          <p
            id="replace-account-description"
            className="mt-1 text-sm text-[var(--muted)]"
          >
            You will sign in to{" "}
            {providerNamed.get(replacing.providerId)?.displayName ??
              replacing.providerId}{" "}
            with the account every flow that uses this connection should act as
            from now on. {replacing.externalAccount.displayName} stays connected
            until that sign-in completes.
          </p>
          <FormError message={replaceError} className="mt-3" />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeReplace}
              disabled={pending}
            >
              Keep this account
            </Button>
            <Button
              type="button"
              onClick={() => confirmReplace(replacing)}
              disabled={pending}
            >
              {pending ? "Starting…" : "Replace account"}
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
            className="mt-1 text-sm text-[var(--muted)]"
          >
            Provide the connection details supplied by this provider.
          </p>
          <form onSubmit={submitKeyForm} className="mt-6 space-y-4">
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
            <div className="flex flex-wrap gap-2 pt-2">
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
    </div>
  );
}
