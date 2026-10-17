/**
 * The one connection row (Build 21, spec A4; the owner's build 20 items 6 and
 * 7: "We need one standard format for all connections. Logo then to the right
 * name then below the account email", "Standard format and size for each
 * connection component on the list not random buttons and such"; and his
 * ~04:15Z: "we will list on apples app store not intuits. so we do not need
 * that"): the vendor's mark at 24 · its name · under it the account's email,
 * else its state · on the right one button of ours. The same rules and words
 * as the app's (snoopy-mobile `lib/view/catalog.ts`, `lib/content/screen-states.ts`).
 *
 * Used by Connections, a flow page's Connections and vendor row, Set up and
 * the vendor page. Pure, and loaded by its unit test as it is: no React and no
 * `@/` import.
 */

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
 * A connection's state, as the row says it: connected; needing attention —
 * the platform asks for a new sign-in (`reauthorization-required`, backend
 * §12.1 #175) or holds an `errorCode`; or not connected — no connection, one
 * disconnected, or one still authorizing.
 */
export type ConnectionRowState = "connected" | "attention" | "not-connected";

export function connectionState(
  connection: RowConnection | undefined,
): ConnectionRowState {
  if (!connection) return "not-connected";
  if (connection.status === "reauthorization-required") return "attention";
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
 * "Needs attention" in the warning colour.
 */
export function connectionLine(connection: RowConnection | undefined): {
  text: string;
  tone: "muted" | "warn";
} {
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
