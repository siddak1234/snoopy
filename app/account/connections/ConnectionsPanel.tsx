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

export function ConnectionsPanel({
  connections,
  providers,
  callbackStatus,
}: {
  connections: Connection[];
  providers: ConnectionProvider[];
  callbackStatus: "connected" | "error" | null;
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

  const close = () => {
    setSelectedProvider(null);
    setError(null);
    setRetryWithSameIntent(false);
    setConnectionIntentKey(null);
  };

  const connect = (provider: ConnectionProvider) => {
    setError(null);
    if (provider.authType === "api-key") {
      // This is intentionally browser-memory only: it identifies one explicit
      // connect intent, but neither it nor any credential is persisted.
      setConnectionIntentKey(`connection-${crypto.randomUUID()}`);
      setRetryWithSameIntent(false);
      setSelectedProvider(provider);
      return;
    }
    startTransition(async () => {
      const result = await beginConnectionAuthorization(provider.providerId);
      if (!result.ok || !result.authorizationUrl) {
        setError(result.ok ? "Could not start the connection" : result.error);
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
    submitKey(new FormData(event.currentTarget));
  };

  const disconnect = async (connectionId: string) => {
    setError(null);
    setDisconnecting(connectionId);
    try {
      const result = await disconnectConnection(connectionId);
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

  return (
    <div className="py-5 first:pt-0">
      {callbackStatus === "connected" ? (
        <p role="status" className="mb-4 text-sm text-[var(--success-text)]">
          Connection completed successfully.
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
                  live{" "}
                  {connection.usedByCount === 1 ? "automation" : "automations"}
                </p>
                {connection.errorCode ? (
                  <p className="mt-1 text-xs text-[var(--warning-text)]">
                    This connection needs attention before it can be used.
                  </p>
                ) : null}
              </div>
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
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => connect(provider)}
              >
                {pending
                  ? "Connecting…"
                  : connectedProviderIds.has(provider.providerId)
                    ? "Reconnect"
                    : "Connect"}
              </Button>
            </div>
          ))}
        </div>
        {providers.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No connection providers are available in this environment.
          </p>
        ) : null}
      </div>

      <FormError message={error} className="mt-4" />

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
