/**
 * A flow's vendor (spec A2, A3, A6; backend ADR-0037, ADR-0040): its Connect
 * vendor page — one per step's connection choice (`?field=`) — and what Step 1
 * says the flow is owed. A connect started on the flow's pages comes back to
 * them (`app/account/connections/pending-connect.ts`).
 *
 * Only a flow whose PINNED version declares a `connection` setting has a
 * vendor to choose, and so a vendor page (`[subscriptionId]/vendor/page.tsx`):
 * the catalog describes the newest version, so a flow still on an older one —
 * every v1 flow of Invoice Processing — is judged by its own `setup`, never by
 * the catalog's.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

/** A flow's Connect vendor page for one step's choice (spec A2). */
export function vendorPath(subscriptionId: string, field?: string): string {
  const path = `/account/flows/${encodeURIComponent(subscriptionId)}/vendor`;
  return field ? `${path}?field=${encodeURIComponent(field)}` : path;
}

/** What Step 1 says the flow is owed, and where it is done (spec A6). */
export type OwedLine = { key: string; text: string; href: string };

type SetupField = {
  key: string;
  control: string;
  defaultValue?: unknown;
};

/** A subscription, as far as what it is owed goes. */
type Flow = {
  id: string;
  config: Record<string, unknown>;
  /** The PINNED version's settings (backend §12.1 #185); absent when it declares none. */
  setup?: readonly SetupField[];
  unmetConnections: readonly string[];
};

/** A connection the catalog's entry declares. */
type Declared = {
  providerId: string;
  displayName: string;
  optional: boolean;
};

type Provider = { providerId: string; displayName: string };

/**
 * What the flow is owed, in words and with the way to it (spec A6, the app's
 * Step 1): first each vendor a step chose that is not connected — "Connect
 * QuickBooks Online first, or choose None." — on that step's vendor page; then,
 * in one line, every account it cannot run without — and any account of a flow
 * whose pinned version has no vendor to choose, such as a v1 flow the
 * catalog's newer version makes optional — "Connect {names} first.", on
 * Connections. `connected` says whether the workspace's connection to a
 * provider is live. Never the provider's raw id.
 */
export function owedLines(
  flow: Flow,
  declared: readonly Declared[],
  providers: readonly Provider[],
  connected: (providerId: string) => boolean,
): OwedLine[] {
  const fields = (flow.setup ?? []).filter(
    (field) => field.control === "connection",
  );
  const nameOf = (providerId: string) =>
    declared.find((candidate) => candidate.providerId === providerId)
      ?.displayName ??
    providers.find((provider) => provider.providerId === providerId)
      ?.displayName ??
    "its account";
  const lines: OwedLine[] = [];
  const chosen = new Set<string>();
  for (const field of fields) {
    const value = flow.config[field.key] ?? field.defaultValue;
    const providerId =
      typeof value === "string" && value !== "" ? value : "none";
    if (providerId === "none" || connected(providerId)) continue;
    chosen.add(providerId);
    lines.push({
      key: `vendor:${field.key}`,
      text: `Connect ${nameOf(providerId)} first, or choose None.`,
      href: vendorPath(flow.id, field.key),
    });
  }
  // An optional account is a step's to choose only where the version has the
  // choice; otherwise the flow cannot run without it.
  const optional = new Set(
    fields.length > 0
      ? declared
          .filter((connection) => connection.optional)
          .map((connection) => connection.providerId)
      : [],
  );
  const owed = flow.unmetConnections.filter(
    (providerId) => !optional.has(providerId) && !chosen.has(providerId),
  );
  if (owed.length > 0) {
    lines.push({
      key: "accounts",
      text: `Connect ${[...new Set(owed)].map(nameOf).join(", ")} first.`,
      href: "/account/connections",
    });
  }
  return lines;
}
