/**
 * A flow's vendor (spec §3.B–§3.D; backend ADR-0037): its Connect vendor page,
 * the choice Set up shows, and what an unmet connection asks for. A connect
 * started on the vendor page comes back to it
 * (`app/account/connections/pending-connect.ts`).
 *
 * Only a flow whose PINNED version declares a `connection` setting has a vendor
 * to choose, and so a vendor page (`[subscriptionId]/vendor/page.tsx`): the
 * catalog describes the newest version, so a flow still on an older one — every
 * v1 flow of Invoice Processing — is judged by its own `setup`, never by the
 * catalog's.
 *
 * No React and no `@/` import here: the unit test loads this file as it is.
 */

/** A flow's Connect vendor page (spec §3.C). */
export function vendorPath(subscriptionId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}/vendor`;
}

/**
 * The flow's vendor choice — its `connection` setting (backend ADR-0037) — as
 * Set up's Connect row shows it (spec §3.B), with the way to the vendor page.
 */
export type VendorChoiceRow = {
  /** The setting's key. */
  key: string;
  /** `none`, or the chosen provider. */
  providerId: string;
  /** The flow's vendor page. */
  href: string;
  displayName?: string;
  /** The provider's published icon name, which may name its logo. */
  icon?: string | null;
  /** False while the chosen vendor is not connected. */
  connected?: boolean;
};

/** What an unmet connection asks for, and where it is done (spec §3.D). */
export type UnmetLine = { providerId: string; text: string; href: string };

type SetupField = {
  key: string;
  title: string;
  control: string;
  defaultValue?: unknown;
};

/** A subscription, as far as its vendor goes. */
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

type Provider = { providerId: string; displayName: string; icon?: string };

/** The flow's own vendor setting, or undefined when its pinned version has none. */
function vendorField(flow: Flow): SetupField | undefined {
  return (flow.setup ?? []).find(
    (candidate) => candidate.control === "connection",
  );
}

/**
 * The flow's vendor choice, as Set up's Connect row shows it (spec §3.B): the
 * flow's `connection` setting — `none` or an optional connection's provider —
 * with that vendor's name and mark, and whether it still needs connecting,
 * which the platform says by listing it in `unmetConnections` (backend
 * ADR-0037). Null for a flow with no vendor to choose.
 */
export function vendorChoice(
  flow: Flow,
  declared: readonly Declared[],
  providers: readonly Provider[],
): VendorChoiceRow | null {
  const field = vendorField(flow);
  if (!field) return null;
  const value = flow.config[field.key] ?? field.defaultValue ?? "none";
  const providerId = typeof value === "string" ? value : "none";
  if (providerId === "none") {
    return { key: field.key, providerId, href: vendorPath(flow.id) };
  }
  const provider = providers.find(
    (candidate) => candidate.providerId === providerId,
  );
  const connection = declared.find(
    (candidate) => candidate.providerId === providerId,
  );
  return {
    key: field.key,
    providerId,
    href: vendorPath(flow.id),
    displayName:
      connection?.displayName ?? provider?.displayName ?? field.title,
    icon: provider?.icon ?? null,
    connected: !flow.unmetConnections.includes(providerId),
  };
}

/**
 * What an unmet connection asks for, in words and with the way to it (spec
 * §3.D): a vendor the flow chose is connected, or None chosen instead, on the
 * flow's vendor page; a connection the flow cannot run without — and any
 * connection of a flow whose pinned version has no vendor to choose, such as a
 * v1 flow the catalog's newer version makes optional — is connected on
 * Connections. Never the provider's raw id.
 */
export function unmetLines(
  flow: Flow,
  declared: readonly Declared[],
  providers: readonly Provider[],
): UnmetLine[] {
  const choosable = vendorField(flow) !== undefined;
  return flow.unmetConnections.map((providerId) => {
    const connection = declared.find(
      (candidate) => candidate.providerId === providerId,
    );
    const displayName =
      connection?.displayName ??
      providers.find((provider) => provider.providerId === providerId)
        ?.displayName ??
      "its account";
    return choosable && connection?.optional
      ? {
          providerId,
          text: `Connect ${displayName} first, or choose None.`,
          href: vendorPath(flow.id),
        }
      : {
          providerId,
          text: `Connect ${displayName} first.`,
          href: "/account/connections",
        };
  });
}
