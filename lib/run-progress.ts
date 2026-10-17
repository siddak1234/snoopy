/**
 * A run's STEPS (Build 21, spec A7; the session's S14; the owner's build 20
 * item 10: "It shoukd show all the steps and a live tracker of which ones are
 * done. Not random like this where it adds to the list. We have pre
 * determined steps and it should ahow where we are"): every declared row from
 * the start, each with where the run is — "1 · Received  Done · 2:32 PM",
 * "2 · Read  Working…", "3 · Checked  Waiting". One row per declared group, in
 * the groups' order (backend ADR-0037), or one per declared step for a
 * version without groups. **Never a step's own summary and never a step id**
 * (B6; item 11's "What is the checked issue?" over "34 accounts read" under
 * Received). The same rules, words and tests as the app's `toTracker`
 * (snoopy-mobile `lib/view/runs.ts`), so both clients say the same thing.
 * ~~One row per group that had a reported step, under it that step's
 * summary~~ until Build 21.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export type ProgressStep = {
  stepId: string;
  outcome: "ok" | "held" | "failed";
  summary: string;
  heldReason?: string;
  occurredAt: string;
};

export type DeclaredStep = { id: string; title: string; group?: string };

export type ProgressManifest = {
  version: number;
  pipeline: readonly DeclaredStep[];
  groups?: readonly { id: string; title: string }[];
};

type RunStatus =
  "pending" | "running" | "held" | "succeeded" | "failed" | "cancelled";

/** What the tracker needs of the run. */
export type RunState = {
  status: RunStatus;
  origin?: string;
  failureReason?: string;
};

/** A step's, or a group's, place in the run (the session's S14). */
export type TrackerState =
  "waiting" | "working" | "done" | "held" | "failed" | "skipped" | "stopped";

/** One row of a run's STEPS: "2 · Read" and its state in words. */
export type TrackerRow = {
  key: string;
  title: string;
  state: TrackerState;
  sub: string;
};

/** The words of each state (the app's, byte for byte). */
export const WORKING = "Working…";
export const STEP_WAITING = "Waiting";
export const STEP_DONE = "Done";
export const STEP_SKIPPED = "Skipped";
export const STEP_STOPPED = "Stopped";
export const STEP_FAILED = "Failed";
export const WAITING_FOR_APPROVAL = "Waiting for approval.";

export function stepHeld(reason: string | undefined): string {
  return reason ? `Waiting for approval: ${reason}` : "Waiting for approval";
}

/** How long a run's page waits, while the run has not ended, before it reads the run again (spec A7). */
export const RUN_REREAD_MS = 2_000;

/**
 * How long a flow page waits, while a run of the flow is pending or running,
 * before it reads its Dashboard again (spec A6; the session's S30).
 */
export const FLOW_STATS_REREAD_MS = 5_000;

const at = (iso: string) => Date.parse(iso);

/**
 * Each declared step's state, from what the run reported (spec A7; S14). Per
 * step, in the pipeline's order:
 *
 * - reported `ok`, or `failed` without failing the run → done; `held` → held;
 *   `failed`, the run failed, and it is the step reported last → failed;
 * - not reported, before the furthest step reported → skipped (it was not
 *   needed: None's QuickBooks lookups, a second read nobody needed);
 * - not reported, after it: the first is working while the run goes on, the
 *   rest waiting; waiting while the run is held; skipped once it succeeded;
 *   stopped once it failed or was cancelled.
 *
 * A continuation (`approval-continuation`) did its first steps in the run it
 * continues: every step before its first reported one is done.
 */
export function stepStates(
  pipeline: readonly { id: string }[],
  steps: readonly ProgressStep[],
  run: RunState,
): { state: TrackerState; step?: ProgressStep }[] {
  const order = new Map(pipeline.map((step, index) => [step.id, index]));
  const ordered = steps
    .map((step, index) => ({ step, index }))
    .sort(
      (a, b) =>
        at(a.step.occurredAt) - at(b.step.occurredAt) || a.index - b.index,
    )
    .map(({ step }) => step);
  const latest = new Map<string, ProgressStep>();
  for (const step of ordered) latest.set(step.stepId, step);
  const reported = [...latest.keys()].flatMap((id) =>
    order.has(id) ? [order.get(id)!] : [],
  );
  const furthest = reported.length > 0 ? Math.max(...reported) : -1;
  const first = reported.length > 0 ? Math.min(...reported) : -1;
  const lastId = ordered[ordered.length - 1]?.stepId;
  const going = run.status === "pending" || run.status === "running";
  const continued = run.origin === "approval-continuation";
  return pipeline.map((declared, index) => {
    const step = latest.get(declared.id);
    if (step) {
      if (step.outcome === "held") return { state: "held", step };
      if (
        step.outcome === "failed" &&
        run.status === "failed" &&
        declared.id === lastId
      )
        return { state: "failed", step };
      return { state: "done", step };
    }
    if (continued && index < first) return { state: "done" };
    if (index < furthest) return { state: "skipped" };
    if (going) return { state: index === furthest + 1 ? "working" : "waiting" };
    if (run.status === "held") return { state: "waiting" };
    if (run.status === "succeeded") return { state: "skipped" };
    return { state: "stopped" };
  });
}

/** A group's state from its steps' (S14): working > held > failed > waiting (all) > done (any) > stopped > waiting > skipped. */
export function groupState(states: readonly TrackerState[]): TrackerState {
  if (states.includes("working")) return "working";
  if (states.includes("held")) return "held";
  if (states.includes("failed")) return "failed";
  if (states.length > 0 && states.every((state) => state === "waiting"))
    return "waiting";
  if (states.includes("done")) return "done";
  if (states.includes("stopped")) return "stopped";
  if (states.includes("waiting")) return "waiting";
  return "skipped";
}

/**
 * The time of day a step was done, as these pages say a time — UTC, like every
 * date on them, so the server and the browser draw the same words: "2:32 PM".
 */
export function timeOfDay(iso: string): string {
  const instant = at(iso);
  if (Number.isNaN(instant)) return "";
  const date = new Date(instant);
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "AM" : "PM"}`;
}

/** What a row says of its state — never a step's own summary, never a step id. */
function trackerSub(
  state: TrackerState,
  steps: readonly ProgressStep[],
  run: RunState,
  clock: (iso: string) => string,
): string {
  if (state === "working") return WORKING;
  if (state === "waiting") return STEP_WAITING;
  if (state === "skipped") return STEP_SKIPPED;
  if (state === "stopped") return STEP_STOPPED;
  if (state === "failed") return run.failureReason ?? STEP_FAILED;
  if (state === "held")
    return stepHeld(steps.find((step) => step.outcome === "held")?.heldReason);
  const last = steps.reduce<ProgressStep | undefined>(
    (latest, step) =>
      !latest || at(step.occurredAt) >= at(latest.occurredAt) ? step : latest,
    undefined,
  );
  return last ? `${STEP_DONE} · ${clock(last.occurredAt)}` : STEP_DONE;
}

/**
 * The rows. `declared` and `groups` are the catalog's, passed only for a run
 * of the version they were declared for; a run of another version — whose
 * steps the catalog no longer declares — is drawn as the steps it reported,
 * each titled from the catalog where it still names it (`titles`), else
 * "Step {n}", and "Working…" while it goes on.
 */
export function trackerRows(
  steps: readonly ProgressStep[],
  declared: readonly DeclaredStep[] | undefined,
  groups: readonly { id: string; title: string }[] | undefined,
  run: RunState,
  clock: (iso: string) => string = timeOfDay,
  titles: readonly { id: string; title: string }[] | undefined = declared,
): TrackerRow[] {
  const known = new Set((declared ?? []).map((step) => step.id));
  const covered =
    declared !== undefined &&
    declared.length > 0 &&
    steps.every((step) => known.has(step.stepId));
  if (!covered) return reportedRows(steps, titles, run, clock);
  const pipeline = declared;
  const states = stepStates(pipeline, steps, run);
  const row = (key: string, title: string, members: number[]): TrackerRow => {
    const state = groupState(members.map((index) => states[index]!.state));
    const reported = members.flatMap((index) =>
      states[index]!.step ? [states[index]!.step!] : [],
    );
    return { key, title, state, sub: trackerSub(state, reported, run, clock) };
  };
  if (groups && groups.length > 0) {
    return groups.map((group, position) =>
      row(
        `group:${group.id}`,
        `${position + 1} · ${group.title}`,
        pipeline.flatMap((step, index) =>
          step.group === group.id ? [index] : [],
        ),
      ),
    );
  }
  return pipeline.map((step, index) =>
    row(`step:${step.id}`, `${index + 1} · ${step.title}`, [index]),
  );
}

/** The fallback: the steps a run of another version reported, in order, by state. */
function reportedRows(
  steps: readonly ProgressStep[],
  declared: readonly { id: string; title: string }[] | undefined,
  run: RunState,
  clock: (iso: string) => string,
): TrackerRow[] {
  const titles = new Map((declared ?? []).map((step) => [step.id, step.title]));
  const ordered = [...steps].sort(
    (a, b) => at(a.occurredAt) - at(b.occurredAt),
  );
  const rows = ordered.map((step, index): TrackerRow => {
    const failedRun =
      step.outcome === "failed" &&
      run.status === "failed" &&
      index === ordered.length - 1;
    const state: TrackerState =
      step.outcome === "held" ? "held" : failedRun ? "failed" : "done";
    return {
      key: `reported:${index}:${step.stepId}`,
      title: `${index + 1} · ${titles.get(step.stepId) ?? `Step ${index + 1}`}`,
      state,
      sub: trackerSub(state, [step], run, clock),
    };
  });
  if (run.status === "pending" || run.status === "running") {
    rows.push({
      key: "working",
      title: `${rows.length + 1} · Step ${rows.length + 1}`,
      state: "working",
      sub: WORKING,
    });
  }
  return rows;
}

/** The em dash a value not reached yet reads as. */
export const EMPTY = "—";

/**
 * Steps done: the rows done or skipped over every row (spec A7; S14), so a run
 * at its start reads "0 / 4" and never "1 / 1" (the owner's build 20 item 10).
 */
export function stepsDone(rows: readonly TrackerRow[]): string {
  const counted = rows.filter((row) => row.key !== "working");
  const done = counted.filter(
    (row) => row.state === "done" || row.state === "skipped",
  ).length;
  return counted.length > 0 ? `${done} / ${counted.length}` : EMPTY;
}

/** How long a run took — the app's words: "9s", "4m", "2h"; the em dash until it ends. */
export function runDuration(
  startedAt: string | null | undefined,
  endedAt: string | null | undefined,
): string {
  const from = startedAt ? at(startedAt) : Number.NaN;
  const to = endedAt ? at(endedAt) : Number.NaN;
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return EMPTY;
  const seconds = Math.floor((to - from) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

/**
 * A run's name: "Run" and its FULL id (spec A8; the owner's D4 of 2026-10-15:
 * "run number is the run ID. each id is unique … like a case number or uuid",
 * and his AM2: "runs should have the full ID"). Never the request id.
 */
export function runLabel(id: string): string {
  return `Run ${id}`;
}

/** What became of a held run's approval, as the run's page says it (the app's `heldDecision`). */
export type HeldDecision =
  "pending" | "approved" | "rejected" | "closed" | "unknown";

export function heldDecision(
  run: { id: string; status: RunStatus },
  approvals: readonly { runId: string; status: string }[],
): HeldDecision | null {
  if (run.status !== "held") return null;
  const approval = approvals.find((candidate) => candidate.runId === run.id);
  if (!approval) return "unknown";
  if (approval.status === "pending") return "pending";
  if (approval.status === "approved") return "approved";
  if (approval.status === "rejected") return "rejected";
  return "closed";
}

const HELD_DECISION_LINE: Record<HeldDecision, string> = {
  pending: "Waiting for approval",
  approved: "Approved — continued in a new run",
  rejected: "Rejected",
  closed: "No longer awaiting approval",
  unknown: "Held for review",
};

/**
 * The run's result line (spec A7): a succeeded run's summary, a failed run's
 * reason; a held one "Waiting for approval." while nobody has decided, else
 * the decided line in the app's words.
 */
export function runResultLine(
  run: {
    id: string;
    status: RunStatus;
    resultSummary?: string;
    failureReason?: string;
  },
  approvals: readonly { runId: string; status: string }[],
): string | null {
  if (run.status === "succeeded") return run.resultSummary ?? null;
  if (run.status === "failed") return run.failureReason ?? null;
  if (run.status === "held") {
    const decision = heldDecision(run, approvals) ?? "unknown";
    return decision === "pending" || decision === "unknown"
      ? WAITING_FOR_APPROVAL
      : HELD_DECISION_LINE[decision];
  }
  return null;
}
