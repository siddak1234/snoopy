/**
 * A flow page's STEPS and its vendor choices (Build 21, spec A6; Build 22,
 * P1–P4 — the owner's build 21 items 5–7: "1. Upooad Invoice / 2. Connect
 * integration … / 3. Then something about AI Processing / 4. Quickbooks
 * updated / 5. Email sent"), a run page's titles and setting lines (S23), and
 * the dashboard's Today (W1). The same rules as the app's (snoopy-mobile
 * `lib/view/pipeline.ts`, `lib/view/runs.ts`, `components/setup-field.tsx`).
 * ~~Home's Run a flow (A9)~~ until Build 22 (the owner's build 21 item 1:
 * "Remove run a flow section").
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
  field: { key: string; defaultValue?: unknown },
  config: Readonly<Record<string, unknown>> | undefined,
): string {
  const value = config?.[field.key] ?? field.defaultValue;
  return typeof value === "string" && value !== "" ? value : NONE;
}

type DeclaredStep = {
  id: string;
  kicker?: string;
  title: string;
  group?: string;
};

/** What a step's title is read from: its id and title, and since Build 22 its title by connection and its platform. */
export type StepHeading = {
  id: string;
  title: string;
  titleByConnection?: {
    field: string;
    titles: readonly { providerId: string; title: string }[];
  };
  platform?: string;
};

/** No integration chosen: the integration row's name, and a run's step 2 line then (the session's S23). */
export const NONE_LABEL = "None";

/**
 * A step's title (Build 22; backend ADR-0041): its `titleByConnection` entry
 * for the provider its connection setting holds now, else its own title —
 * Invoice Processing v4's step 4 is "QuickBooks updated" while QuickBooks is
 * chosen and "Details saved" with None (the session's D3, approved by the
 * owner 21:12Z). With the flow's settings unknown (`config` absent) it is the
 * step's own title.
 */
export function stepTitle(
  group: StepHeading,
  setup: readonly Pick<Field, "key" | "defaultValue">[],
  config: Readonly<Record<string, unknown>> | undefined,
): string {
  const byConnection = group.titleByConnection;
  if (!byConnection || !config) return group.title;
  const chosen = chosenVendor(
    setup.find((field) => field.key === byConnection.field) ?? {
      key: byConnection.field,
    },
    config,
  );
  return (
    byConnection.titles.find((entry) => entry.providerId === chosen)?.title ??
    group.title
  );
}

/**
 * What one row of a flow page's STEPS holds (Build 22, spec §4's generic
 * rules, the same in both clients; backend ADR-0041):
 *
 * - `steps` — a group pipeline steps name (or, without groups, one step):
 *   nothing under its title but Step 1's controls on the row that takes the
 *   run's input;
 * - `setting` — a group no pipeline step names and with no `platform`: the
 *   setup fields that name it (Invoice Processing v4's "Connect integration",
 *   its `vendor` field drawn as the integration row);
 * - `email` — the platform's own email step (`platform: email`): who gets it;
 * - `platform` — a `platform` this build does not know: its title only.
 */
export type FlowStepKind = "steps" | "setting" | "email" | "platform";

/** One row of a flow page's STEPS: "1 · Upload invoice" — titles only since Build 22 (the session's S20). */
export type FlowStepRow = {
  id: string;
  label: string;
  kind: FlowStepKind;
  /** The row that takes the run's input: Step 1's document and Start run. */
  input: boolean;
  /** A setting step's fields, by key, in the manifest's order. */
  fields: string[];
};

/**
 * A flow page's STEPS (Build 22, P1): numbered rows, one per visible group
 * where the manifest declares them, else one per step, each its title only.
 *
 * The input row is the trigger's group (the pipeline's TRIGGER step, else its
 * first), or without groups the first step. A setup field with no `group` is
 * not drawn here — it is on Set up (spec §4). ~~A field naming no step drawn
 * under the steps (`unplaced`), and each group's description under its
 * title~~ until Build 22.
 */
export function flowStepPlan(
  steps: readonly DeclaredStep[] | undefined,
  groups: readonly StepHeading[] | undefined,
  setup: readonly Pick<Field, "key" | "defaultValue" | "group">[],
  config: Readonly<Record<string, unknown>> | undefined,
): FlowStepRow[] {
  if (!groups || groups.length === 0) {
    return (steps ?? []).map((step, index) => ({
      id: step.id,
      label: `${index + 1} · ${step.title}`,
      kind: "steps",
      input: index === 0,
      fields: [],
    }));
  }
  const named = new Set(
    (steps ?? []).flatMap((step) => (step.group ? [step.group] : [])),
  );
  const trigger =
    (steps ?? []).find((step) => step.kicker === "TRIGGER") ?? steps?.[0];
  const inputId =
    groups.find((group) => group.id === trigger?.group)?.id ?? groups[0]!.id;
  return groups.map((group, index) => {
    const kind: FlowStepKind =
      group.platform !== undefined
        ? group.platform === "email"
          ? "email"
          : "platform"
        : named.has(group.id)
          ? "steps"
          : "setting";
    return {
      id: group.id,
      label: `${index + 1} · ${stepTitle(group, setup, config)}`,
      kind,
      input: group.id === inputId,
      fields:
        kind === "setting"
          ? setup
              .filter((field) => field.group === group.id)
              .map((field) => field.key)
          : [],
    };
  });
}

/**
 * A setting step's line on a run's page (Build 22; the session's S23): the
 * integration each of its connection fields holds now — its name, or "None" —
 * a run's own choice not being recorded (backend §12.1 #290). `null` for a
 * setting step with no connection field, which then says "Done".
 */
export function settingLine(
  groupId: string,
  setup: readonly Pick<Field, "key" | "control" | "defaultValue" | "group">[],
  config: Readonly<Record<string, unknown>>,
  providerName: (providerId: string) => string,
): string | null {
  const names = setup
    .filter(
      (field) => field.group === groupId && field.control === "connection",
    )
    .map((field) => {
      const chosen = chosenVendor(field, config);
      return chosen === NONE ? NONE_LABEL : providerName(chosen);
    });
  return names.length > 0 ? names.join(", ") : null;
}

/** Step 1's line for a vendor chosen and not connected (spec A6). */
export function connectFirstOrNone(displayName: string): string {
  return `Connect ${displayName} first, or choose None.`;
}

/** Step 1's line for accounts the flow cannot run without. */
export function connectFirst(displayNames: string): string {
  return `Connect ${displayNames} first.`;
}

/**
 * The first instant of today where the browser is (Build 22, W1; the session's
 * S27): the dashboard's Today tiles count from it, as the app's TODAY counts
 * from its own `localMidnight()` — "today" is a local idea.
 */
export function localMidnight(now: Date): string {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return midnight.toISOString();
}

/** Where a Today tile goes: Activity from that instant, for its outcome (Runs: every outcome). */
export function todayHref(
  since: string,
  outcome?: "succeeded" | "failed",
): string {
  return `/account/runs?${outcome ? `status=${outcome}&` : ""}since=${encodeURIComponent(since)}`;
}

const FLOW_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** An instant as the platform writes one: an ISO 8601 date and time, with its zone. */
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

/**
 * What Activity is filtered by, from its address (spec A6; the session's W2;
 * Build 22's W1): a flow's Dashboard opens it for that flow (`?flow=`) and an
 * outcome (`&status=succeeded` or `failed`), and the dashboard's Today tiles
 * from the browser's midnight (`&since=`). Only a flow id shaped as one — a
 * UUID, as the platform's `subscriptionId` is — is sent on to the platform,
 * which refuses any other (400) and would take the page with it; only a
 * `since` that is an instant is kept; anything else in the address is read as
 * no filter at all.
 */
export function activityFilter(
  flow: unknown,
  status: unknown,
  since?: unknown,
): {
  flowId?: string;
  outcome?: "succeeded" | "failed";
  since?: string;
} {
  return {
    ...(typeof flow === "string" && FLOW_ID.test(flow) ? { flowId: flow } : {}),
    ...(status === "succeeded" || status === "failed"
      ? { outcome: status }
      : {}),
    ...(typeof since === "string" &&
    INSTANT.test(since) &&
    !Number.isNaN(Date.parse(since))
      ? { since }
      : {}),
  };
}
