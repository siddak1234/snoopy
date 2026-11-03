/**
 * The one connection row (Build 21, spec A4; the owner's build 20 items 6 and
 * 7: "We need one standard format for all connections. Logo then to the right
 * name then below the account email", "Standard format and size for each
 * connection component on the list not random buttons and such"; and his
 * ~04:15Z: "we will list on apples app store not intuits. so we do not need
 * that"): the vendor's mark at 24 · its name · under it the account's email,
 * else its state · on the right one button of ours. The same rules and words
 * as the app's (`snoopy-mobile/lib/view/catalog.ts`,
 * `snoopy-mobile/lib/content/screen-states.ts`).
 *
 * Used by Connections, a flow page's Connections and vendor row, Set up and
 * the vendor page. Pure, and loaded by its unit test as it is: no React and no
 * `@/` import; its contract types arrive by a type-only import.
 */

import type { components } from "./generated/platform-contracts/connections";

export const CONNECTION_CONNECTED = "Connected";
export const CONNECTION_NOT_CONNECTED = "Not connected";
export const CONNECTION_ATTENTION = "Needs attention";
export const CONNECT_LABEL = "Connect";
export const RECONNECT_LABEL = "Reconnect";
export const DISCONNECT_LABEL = "Disconnect";
export const DISCONNECTING_LABEL = "Disconnecting…";

/** Only an owner or admin connects or disconnects (the platform's rule). */
export const CONNECTIONS_MANAGED_BY =
  "Only an owner or admin of this workspace can connect or disconnect an account.";

/**
 * Under a member's vendor list, and the words for the platform's 403
 * `integration_requires_admin` on a vendor save: a member sees the
 * integration, never changes it (Build 23's B3; byte-equal to the app's).
 */
export const VENDOR_MEMBER_NOTE =
  "Only an owner or admin can change the integration.";

/** A connection as far as the row reads it (`Connection`, `lib/connections.ts`). */
export type RowConnection = {
  id: string;
  providerId: string;
  status:
    "authorizing" | "connected" | "reauthorization-required" | "disconnected";
  externalAccount: { displayName: string };
  usedByCount: number;
  errorCode?: string;
};

/**
 * A connection the platform retired because the provider would not renew it
 * (backend §12.1 #252): `disconnected`, with the `errorCode` the refresh loop
 * sets when it retires one. One disconnected here carries no `errorCode`.
 */
export function disconnectedAtProvider(
  connection: RowConnection | undefined,
): boolean {
  return connection?.status === "disconnected" && Boolean(connection.errorCode);
}

/** Line 2 of a connection disconnected at the provider. */
export function disconnectedIn(provider: string): string {
  return `Disconnected in ${provider}`;
}

/**
 * A connection's state, as the row says it: connected; needing attention —
 * the platform asks for a new sign-in (`reauthorization-required`, backend
 * §12.1 #175), holds an `errorCode`, or was disconnected at the provider
 * (`disconnectedAtProvider`); or not connected — no connection, one
 * disconnected here, or one still authorizing.
 */
export type ConnectionRowState = "connected" | "attention" | "not-connected";

/**
 * A provider's `authType` as the client reads it: the contract's `oauth2` or
 * `api-key`, or `none` — a public service (platform round 2's B5), which the
 * platform lists in `publicProviders`, never in `providers` (the
 * backend's connections contract), and `keylessProviders` gives `none`.
 */
export type ProviderAuthType =
  components["schemas"]["ConnectionProvider"]["authType"] | "none";

/** A public service as the platform lists it in `publicProviders`. */
export type PublicProvider = components["schemas"]["PublicConnectionProvider"];

/**
 * The platform's `publicProviders` as rows of the one provider list, each
 * `authType` `none` with no scopes, so Connections, Set up, a flow page and
 * its vendor page read a public service through `isKeyless` as connected.
 */
export function keylessProviders(
  publicProviders: readonly PublicProvider[] | undefined,
): (PublicProvider & { scopes: string[]; authType: "none" })[] {
  return (publicProviders ?? []).map(
    ({ providerId, displayName, description, icon }) => ({
      providerId,
      displayName,
      description,
      icon,
      scopes: [],
      authType: "none",
    }),
  );
}

/**
 * A public service (`authType` `none`, platform round 2's B5): it has no
 * connect step, and counts as connected for every workspace — no Connect, no
 * Disconnect, its line "Connected".
 */
export function isKeyless(
  authType: ProviderAuthType | undefined | null,
): boolean {
  return authType === "none";
}

export function connectionState(
  connection: RowConnection | undefined,
  authType?: ProviderAuthType | null,
): ConnectionRowState {
  if (isKeyless(authType)) return "connected";
  if (!connection) return "not-connected";
  if (
    connection.status === "reauthorization-required" ||
    disconnectedAtProvider(connection)
  )
    return "attention";
  if (connection.status === "connected")
    return connection.errorCode ? "attention" : "connected";
  return "not-connected";
}

/**
 * The workspace's connection to a provider, when it holds more than one row
 * for it: a live one first, then one needing a new sign-in, then any.
 */
export function connectionFor<C extends RowConnection>(
  connections: readonly C[],
  providerId: string,
): C | undefined {
  const mine = connections.filter(
    (connection) => connection.providerId === providerId,
  );
  return (
    mine.find((connection) => connection.status === "connected") ??
    mine.find(
      (connection) => connection.status === "reauthorization-required",
    ) ??
    mine[0]
  );
}

/**
 * Line 2 of the row: the account's email when the platform holds one —
 * `externalAccount.displayName` carrying an `@` — else the state in a word;
 * "Needs attention" in the warning colour; a public service (`isKeyless`),
 * "Connected"; one disconnected at the provider, "Disconnected in
 * {provider}" in the warning colour, its button Reconnect.
 */
export function connectionLine(
  connection: RowConnection | undefined,
  authType?: ProviderAuthType | null,
  provider = "",
): {
  text: string;
  tone: "muted" | "warn";
} {
  if (isKeyless(authType)) return { text: CONNECTION_CONNECTED, tone: "muted" };
  if (disconnectedAtProvider(connection) && provider)
    return { text: disconnectedIn(provider), tone: "warn" };
  const state = connectionState(connection);
  const name = connection?.externalAccount.displayName ?? "";
  if (state !== "not-connected" && name.includes("@"))
    return { text: name, tone: "muted" };
  if (state === "connected")
    return { text: CONNECTION_CONNECTED, tone: "muted" };
  if (state === "attention")
    return { text: CONNECTION_ATTENTION, tone: "warn" };
  return { text: CONNECTION_NOT_CONNECTED, tone: "muted" };
}

/** The row's one button, for an owner or admin: Connect, Reconnect, or Disconnect. */
export function connectionAction(
  state: ConnectionRowState,
): "Connect" | "Reconnect" | "Disconnect" {
  if (state === "connected") return DISCONNECT_LABEL;
  if (state === "attention") return RECONNECT_LABEL;
  return CONNECT_LABEL;
}

/** Disconnect's question (spec A4). */
export function disconnectTitle(name: string): string {
  return `Disconnect ${name}?`;
}

/** What Disconnect stops, by the live flows the platform counts (`usedByCount`). */
export function disconnectBody(liveFlows: number): string {
  if (liveFlows === 1)
    return "1 live flow uses it. It stops until you connect it again.";
  if (liveFlows > 1)
    return `${liveFlows} live flows use it. They stop until you connect it again.`;
  return "You can connect it again any time.";
}
