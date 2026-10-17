/**
 * A flow page's STEPS and its vendor choices (Build 21, spec A6 — the TEST
 * VERSION of the owner's order, D3: "lets test this flow page order first then
 * we can agree if it should be the standard. it should be easy for a user to
 * run something"; his build 20 item 12: "steps, then in there we have upload
 * photo. Then show the rest of the steps. Then in one of the steps where data
 * is uploaded to quickbooks it shows connected to quickbooks"), and Home's
 * Run a flow (A9). The same rules as the app's (snoopy-mobile
 * `lib/view/pipeline.ts`, `components/setup-field.tsx`, `lib/view/home.ts`).
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** The choice that saves the details only: no vendor (backend `CONNECTION_NONE`). */
export const NONE = "none";

/** A flow page's paths. */
export function flowPath(subscriptionId: string): string {
  return `/account/flows/${encodeURIComponent(subscriptionId)}`;
}
export function setupPath(subscriptionId: string): string {
  return `${flowPath(subscriptionId)}/setup`;
}

type Field = {
  key: string;
  control: string;
  defaultValue?: unknown;
  providers?: readonly string[];
  group?: string;
};

/**
 * Every connection choice a version declares — one per step that uses a
 * connection (backend ADR-0040, BUILD-PLAN 25.4.30). Invoice Processing
 * declares one; v2's has no `providers` and covers every optional connection.
 */
export function connectionFields<T extends { control: string }>(
  setup: readonly T[],
): T[] {
  return setup.filter((field) => field.control === "connection");
}

/** Every setting a form draws as a row: all but the vendor choices, drawn as their vendors. */
export function rowFields<T extends { control: string }>(
  setup: readonly T[],
): T[] {
  return setup.filter((field) => field.control !== "connection");
}

/**
 * The vendors one connection field chooses among, in the manifest's order:
 * the optional connections it names (`providers`), or — a field without
 * `providers`, the one of a version that declares only one (ADR-0040; the
 * spec's S8) — every optional connection.
 */
export function fieldProviders<
  C extends { providerId: string; optional?: boolean },
>(
  field: { providers?: readonly string[] } | undefined,
  connections: readonly C[],
): C[] {
  const optional = connections.filter((connection) => connection.optional);
  if (!field?.providers) return optional;
  const named = new Set(field.providers);
  return optional.filter((connection) => named.has(connection.providerId));
}

/** The vendor a connection field holds: its value, else its default, else None. */
export function chosenVendor(
  field: Field,
  config: Record<string, unknown> | undefined,
): string {
  const value = config?.[field.key] ?? field.defaultValue;
  return typeof value === "string" && value !== "" ? value : NONE;
}

type DeclaredStep = {
  id: string;
  kicker?: string;
  title: string;
  description: string;
  group?: string;
};
type StepGroup = { id: string; title: string; description: string };

/** One row of a flow page's STEPS: "1 · Received", and what happens in it. */
export type FlowStepRow = { id: string; label: string; sub: string };

/**
 * STEPS' rows: numbered, the number in the label — one per group where the
 * manifest declares them, else one per step — each with what it does under
 * it. No kickers, no step cards.
 */
export function flowStepRows(
  steps: readonly DeclaredStep[] | undefined,
  groups: readonly StepGroup[] | undefined,
): FlowStepRow[] {
  if (groups && groups.length > 0) {
    return groups.map((group, index) => ({
      id: group.id,
      label: `${index + 1} · ${group.title}`,
      sub: group.description,
    }));
  }
  return (steps ?? []).map((step, index) => ({
    id: step.id,
    label: `${index + 1} · ${step.title}`,
    sub: step.description,
  }));
}

/**
 * STEPS with what each holds:
 *
 * - `input` — the row that receives the run's input: the trigger's group (the
 *   pipeline's TRIGGER step, else its first), or, without groups, the first
 *   step. Step 1 holds the document and Start run.
 * - `vendorFields` — each step's vendor choice, by the `group` its connection
 *   field names (backend ADR-0040; Invoice Processing v3's `vendor` names
 *   "done"). A field that names no row here — a version from before `group`
 *   (v2) — is `unplaced`: the page draws it under the steps.
 */
export type FlowStepPlan = FlowStepRow & {
  input: boolean;
  vendorFields: string[];
};

export function flowStepPlan(
  steps: readonly DeclaredStep[] | undefined,
  groups: readonly StepGroup[] | undefined,
  vendorFields: readonly { key: string; group?: string }[],
): { rows: FlowStepPlan[]; unplaced: string[] } {
  const rows = flowStepRows(steps, groups);
  const grouped = Boolean(groups && groups.length > 0);
  const trigger =
    (steps ?? []).find((step) => step.kicker === "TRIGGER") ?? steps?.[0];
  const inputId = grouped
    ? (groups!.find((group) => group.id === trigger?.group)?.id ??
      groups![0]?.id)
    : rows[0]?.id;
  const ids = new Set(grouped ? rows.map((row) => row.id) : []);
  const placed = new Map<string, string[]>();
  const unplaced: string[] = [];
  for (const field of vendorFields) {
    if (field.group && ids.has(field.group))
      placed.set(field.group, [...(placed.get(field.group) ?? []), field.key]);
    else unplaced.push(field.key);
  }
  return {
    rows: rows.map((row) => ({
      ...row,
      input: row.id === inputId,
      vendorFields: placed.get(row.id) ?? [],
    })),
    unplaced,
  };
}

/** Step 1's line for a vendor chosen and not connected (spec A6). */
export function connectFirstOrNone(displayName: string): string {
  return `Connect ${displayName} first, or choose None.`;
}

/** Step 1's line for accounts the flow cannot run without. */
export function connectFirst(displayNames: string): string {
  return `Connect ${displayNames} first.`;
}

/** One row of Home's Run a flow: a live flow, its name, its icon name and its team. */
export type QuickRunRow = {
  id: string;
  name: string;
  icon: string | null;
  team: string;
};

/**
 * Home's Run a flow (Build 21, spec A9; the owner's "when a user wants to run a
 * random flow. they shouldnt have to do a bunch of work in the app"; the
 * session's S16): every live flow, each opening its flow page at Step 1, which
 * holds the document and Start run — three presses from Home to a started
 * run. Empty, the section is not drawn.
 */
export function quickRunRows(
  subscriptions:
    | readonly {
        id: string;
        templateId: string;
        name?: string | null;
        status: string;
        projectId?: string | null;
      }[]
    | null,
  catalog: readonly { templateId: string; name: string; icon?: string }[],
  team: (subscription: {
    templateId: string;
    projectId?: string | null;
  }) => string,
): QuickRunRow[] {
  if (subscriptions === null) return [];
  const entries = new Map(catalog.map((entry) => [entry.templateId, entry]));
  return subscriptions
    .filter((subscription) => subscription.status === "live")
    .map((subscription) => {
      const entry = entries.get(subscription.templateId);
      return {
        id: subscription.id,
        name: subscription.name ?? entry?.name ?? subscription.templateId,
        icon: entry?.icon ?? null,
        team: team(subscription),
      };
    });
}

const FLOW_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * What Activity is filtered by, from its address (spec A6; the session's W2):
 * a flow's Dashboard opens it for that flow (`?flow=`) and an outcome
 * (`&status=succeeded` or `failed`). Only a flow id shaped as one — a UUID,
 * as the platform's `subscriptionId` is — is sent on to the platform, which
 * refuses any other (400) and would take the page with it; anything else in
 * the address is read as no filter at all.
 */
export function activityFilter(
  flow: unknown,
  status: unknown,
): { flowId?: string; outcome?: "succeeded" | "failed" } {
  return {
    ...(typeof flow === "string" && FLOW_ID.test(flow) ? { flowId: flow } : {}),
    ...(status === "succeeded" || status === "failed"
      ? { outcome: status }
      : {}),
  };
}
