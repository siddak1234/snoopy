/**
 * A run's STEPS (Build 21, spec A7; the session's S14; the owner's build 20
 * item 10: "It shoukd show all the steps and a live tracker of which ones are
 * done. Not random like this where it adds to the list. We have pre
 * determined steps and it should ahow where we are"): every declared row from
 * the start, each with where the run is — "1 · Upload invoice  Done · 2:32
 * PM", "3 · AI processing  Working…", "4 · QuickBooks updated  Waiting". One
 * row per declared group, in the groups' order (backend ADR-0037), or one per
 * declared step for a version without groups; since Build 22 (backend
 * ADR-0041) a group no pipeline step names is a setting step or the
 * platform's email. **Never a step's own summary and never a step id**
 * (B6; item 11's "What is the checked issue?" over "34 accounts read" under
 * Received). The same rules, words and tests as the app's `toTracker`
 * (`snoopy-mobile/lib/view/runs.ts`), so both clients say the same thing.
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

/** A visible step: its id, its title and, for the platform's own step, its `platform` (backend ADR-0041). */
export type ProgressGroup = { id: string; title: string; platform?: string };

/** Whether a run's email went out (`RunDetail.email`, backend ADR-0041). */
export type RunEmailState = {
  status: "waiting" | "sent" | "not_sent";
  sentAt: string | null;
};

type RunStatus =
  "pending" | "running" | "held" | "succeeded" | "failed" | "cancelled";

/** What the tracker needs of the run — a job's, read whole (backend ADR-0044). */
export type RunState = {
  status: RunStatus;
  failureReason?: string;
};

/**
 * A step's, or a group's, place in the run (the session's S14). `unknown` is a
 * platform step this build does not know (backend ADR-0041: "a client draws a
 * value it does not know as a step with no state").
 */
export type TrackerState =
  | "waiting"
  | "working"
  | "done"
  | "held"
  | "failed"
  | "skipped"
  | "stopped"
  | "unknown";

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
/** A held step whose approval was denied (Build 24, P6; the session's S6). */
export const STEP_DENIED = "Denied";

export function stepHeld(reason: string | undefined): string {
  return reason ? `Waiting for approval: ${reason}` : "Waiting for approval";
}

/**
 * A run's step 5, the platform's email (Build 22; Build 23's A7, "Run
 * completed"): its line once the run succeeded, the app's words. A run that
 * succeeded without sending says Done (S12). ~~"Sending…", "Sent · {time}",
 * "Not sent"~~ until Build 23.
 */
export const EMAIL_OWED = "Sending email…";
export function emailSentLine(time: string): string {
  return `Email sent · ${time}`;
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
 * - reported `ok`, or `failed` without failing the run → done; `held` → held
 *   while the job is held, done once it went on (approved);
 *   `failed`, the run failed, and it is the step reported last → failed;
 * - not reported, before the furthest step reported → skipped (it was not
 *   needed: None's QuickBooks lookups, a second read nobody needed);
 * - not reported, after it: the first is working while the run goes on, the
 *   rest waiting; waiting while the run is held; skipped once it succeeded;
 *   stopped once it failed or was cancelled.
 *
 * A job is its first run (Build 24, P9; backend ADR-0044): its steps come in
 * one list, the held run's and the ones after its approval alike, all under
 * the job's id. ~~A continuation's steps before its first reported one
 * done~~ until Build 24: no continuation is read on its own any more.
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
  const lastId = ordered[ordered.length - 1]?.stepId;
  const going = run.status === "pending" || run.status === "running";
  return pipeline.map((declared, index) => {
    const step = latest.get(declared.id);
    if (step) {
      if (step.outcome === "held")
        return { state: run.status === "held" ? "held" : "done", step };
      if (
        step.outcome === "failed" &&
        run.status === "failed" &&
        declared.id === lastId
      )
        return { state: "failed", step };
      return { state: "done", step };
    }
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

/**
 * What a row says of its state — never a step's own summary, never a step id.
 * A held step says why it waits until its approval is denied, then "Denied"
 * (Build 24, P6).
 */
function trackerSub(
  state: TrackerState,
  steps: readonly ProgressStep[],
  run: RunState,
  clock: (iso: string) => string,
  decision?: HeldDecision | null,
): string {
  if (state === "working") return WORKING;
  if (state === "waiting") return STEP_WAITING;
  if (state === "skipped") return STEP_SKIPPED;
  if (state === "stopped") return STEP_STOPPED;
  if (state === "failed") return run.failureReason ?? STEP_FAILED;
  if (state === "held")
    return decision === "rejected"
      ? STEP_DENIED
      : stepHeld(steps.find((step) => step.outcome === "held")?.heldReason);
  const last = steps.reduce<ProgressStep | undefined>(
    (latest, step) =>
      !latest || at(step.occurredAt) >= at(latest.occurredAt) ? step : latest,
    undefined,
  );
  return last ? `${STEP_DONE} · ${clock(last.occurredAt)}` : STEP_DONE;
}

/**
 * What a run's page knows of its flow, beside the run (Build 22; the session's
 * S23), as its server read it: each step's title as the flow's connection
 * choice names it NOW (`stepTitle`, "QuickBooks updated"), and each setting
 * step's line — the integration chosen, or "None" (`settingLine`) — a run's
 * own choice not being recorded (backend §12.1 #290). Absent when the flow
 * could not be read: each step its own title, a setting step "Done" (the app's
 * M6).
 */
export type TrackerFlow = {
  titles: Readonly<Record<string, string>>;
  settings: Readonly<Record<string, string>>;
};

const doneRow = (key: string, title: string, sub: string): TrackerRow => ({
  key,
  title,
  state: "done",
  sub,
});

/**
 * The platform's email step (Build 22; backend ADR-0041), titled "Email sent"
 * (v4) or "Run completed" (v5), from the run's status and its `email` (Build
 * 23's A7): Waiting while the run goes on or is held (an approval email never
 * checks it); Failed; Stopped for a cancelled run; once it succeeded, done:
 * "Email sent · {time}", "Sending email…" while the email is owed (and with no
 * `email` from the platform), or Done when none was sent.
 */
function emailRow(
  key: string,
  title: string,
  run: RunState,
  email: RunEmailState | undefined,
  clock: (iso: string) => string,
): TrackerRow {
  const at = (state: TrackerState, sub: string): TrackerRow => ({
    key,
    title,
    state,
    sub,
  });
  if (run.status === "cancelled") return at("stopped", STEP_STOPPED);
  if (run.status === "failed") return at("failed", STEP_FAILED);
  if (run.status !== "succeeded") return at("waiting", STEP_WAITING);
  if (email?.status === "sent")
    return at(
      "done",
      email.sentAt ? emailSentLine(clock(email.sentAt)) : STEP_DONE,
    );
  if (email?.status === "not_sent") return at("done", STEP_DONE);
  return at("done", EMAIL_OWED);
}

/**
 * The rows. `declared` and `groups` are the catalog's — the newest version's
 * — passed for any run (Build 22, the session's S25): a run whose every
 * reported step they still declare is drawn by them (a v3 run by v4's five
 * steps). A run that reported a step they no longer declare is drawn as the
 * steps it reported, each titled from the catalog where it still names it
 * (`titles`), else "Step {n}", and "Working…" while it goes on. ~~Only a run
 * of the catalog's own version drawn by its groups~~ until Build 22.
 *
 * Since Build 22 a group no pipeline step names is a setting step — done from
 * the start, its line the integration chosen — or, with `platform: email`, the
 * run's email (`emailRow`); an unknown `platform` is its title and no state.
 */
export function trackerRows(
  steps: readonly ProgressStep[],
  declared: readonly DeclaredStep[] | undefined,
  groups: readonly ProgressGroup[] | undefined,
  run: RunState,
  clock: (iso: string) => string = timeOfDay,
  titles: readonly { id: string; title: string }[] | undefined = declared,
  /**
   * The flow as read now, the run's email (Build 22), and what became of a
   * held job's approval (`heldDecision`, Build 24).
   */
  context: {
    flow?: TrackerFlow;
    email?: RunEmailState;
    decision?: HeldDecision | null;
  } = {},
): TrackerRow[] {
  const known = new Set((declared ?? []).map((step) => step.id));
  const covered =
    declared !== undefined &&
    declared.length > 0 &&
    steps.every((step) => known.has(step.stepId));
  if (!covered)
    return reportedRows(steps, titles, run, clock, context.decision);
  const pipeline = declared;
  const states = stepStates(pipeline, steps, run);
  const row = (key: string, title: string, members: number[]): TrackerRow => {
    const state = groupState(members.map((index) => states[index]!.state));
    const reported = members.flatMap((index) =>
      states[index]!.step ? [states[index]!.step!] : [],
    );
    return {
      key,
      title,
      state,
      sub: trackerSub(state, reported, run, clock, context.decision),
    };
  };
  if (groups && groups.length > 0) {
    const named = new Set(
      pipeline.flatMap((step) => (step.group ? [step.group] : [])),
    );
    return groups.map((group, position) => {
      const key = `group:${group.id}`;
      const title = `${position + 1} · ${context.flow?.titles[group.id] ?? group.title}`;
      if (group.platform === "email")
        return emailRow(key, title, run, context.email, clock);
      if (group.platform !== undefined)
        return { key, title, state: "unknown", sub: "" };
      if (!named.has(group.id))
        return doneRow(
          key,
          title,
          context.flow?.settings[group.id] ?? STEP_DONE,
        );
      return row(
        key,
        title,
        pipeline.flatMap((step, index) =>
          step.group === group.id ? [index] : [],
        ),
      );
    });
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
  decision?: HeldDecision | null,
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
      step.outcome === "held" && run.status === "held"
        ? "held"
        : failedRun
          ? "failed"
          : "done";
    return {
      key: `reported:${index}:${step.stepId}`,
      title: `${index + 1} · ${titles.get(step.stepId) ?? `Step ${index + 1}`}`,
      state,
      sub: trackerSub(state, [step], run, clock, decision),
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
 * at its start reads "0 / 5" and never "1 / 1" (the owner's build 20 item 10).
 * A step with no state (a platform step this build does not know) is not
 * counted (the app's M7).
 */
export function stepsDone(rows: readonly TrackerRow[]): string {
  const counted = rows.filter(
    (row) => row.key !== "working" && row.state !== "unknown",
  );
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

/** What a client needs of an approval to know which is a job's newest. */
type ApprovalOf = { runId: string; status: string; createdAt?: string };

/**
 * A job's newest approval, by when it was asked (Build 24, P9): a job is its
 * first run (backend ADR-0044), so every approval it ever asked names that
 * one id, and the one asked last is the one that counts. Of two asked at the
 * same moment, the one listed first — the platform lists newest first — as the
 * app's `jobApproval` picks.
 */
export function newestApproval<T extends ApprovalOf>(
  runId: string,
  approvals: readonly T[],
): T | undefined {
  const asked = (approval: T) =>
    approval.createdAt ? at(approval.createdAt) : Number.NEGATIVE_INFINITY;
  return approvals
    .filter((candidate) => candidate.runId === runId)
    .reduce<T | undefined>(
      (newest, candidate) =>
        !newest || asked(candidate) > asked(newest) ? candidate : newest,
      undefined,
    );
}

export function heldDecision(
  run: { id: string; status: RunStatus },
  approvals: readonly ApprovalOf[],
): HeldDecision | null {
  if (run.status !== "held") return null;
  const approval = newestApproval(run.id, approvals);
  if (!approval) return "unknown";
  if (approval.status === "pending") return "pending";
  if (approval.status === "approved") return "approved";
  if (approval.status === "rejected") return "rejected";
  return "closed";
}

/**
 * A held job's approval while it waits, and whether this person may decide it
 * (Build 24, P6): the job's newest approval when it is pending, and its
 * eligible roles against their role, as Approvals reads it. The server checks
 * it again and refuses with 403. `null` when nothing of the job waits. The run
 * page works it out in the browser, so an approval its re-reads list (R5c 1)
 * offers Approve and Deny with no reload.
 */
export function waitingDecision<
  T extends ApprovalOf & { eligibleRoles: readonly string[] },
>(
  runId: string,
  approvals: readonly T[],
  role: string | undefined,
): { approval: T; canDecide: boolean } | null {
  const waiting = newestApproval(runId, approvals);
  return waiting?.status === "pending"
    ? {
        approval: waiting,
        canDecide: Boolean(role && waiting.eligibleRoles.includes(role)),
      }
    : null;
}

/**
 * How many times a held run's page reads it again for its approval: 10, each
 * `RUN_REREAD_MS` after the last one settled, about 20 s. Then it stops, so a
 * job whose approval is never listed is not read for ever. The app's
 * `HELD_APPROVAL_REREADS`.
 */
export const HELD_APPROVAL_REREADS = 10;

/**
 * Whether a held run's page reads it again for its approval (Build 25, the
 * review's R5c 1): the run is held, no approval of the job is listed yet, and
 * fewer than `HELD_APPROVAL_REREADS` such reads were made. That is a run that
 * turned held while its page was open, or one read before its approval was.
 * Once the approval is listed, step 4 offers Approve and Deny with no reload. A
 * job whose newest approval is listed, waiting or decided, is not read again
 * for it, and neither is a run that left held. The app's `rereadForApproval`,
 * rule for rule.
 */
export function rereadForApproval(
  run: { id: string; status: RunStatus },
  approvals: readonly ApprovalOf[],
  reads: number,
): boolean {
  return (
    heldDecision(run, approvals) === "unknown" && reads < HELD_APPROVAL_REREADS
  );
}

/**
 * An approval's headline on Approvals (Build 25, the review's R5c 6):
 * "{flow} · {step title}". The approval names its flow (`subscriptionId`) and
 * the step it waits at, so its template is found among the workspace's flows
 * and the step's title in the catalog's entry. A hop that misses never blanks
 * the row: the step gone, the flow's name alone; the entry gone, its template
 * id; the flow gone, `EMPTY`. Never the step id. The app's `approvalTitle`, rule
 * for rule. ~~Held at “{stepId}”~~ until Build 25.
 */
export function approvalTitle(
  approval: { subscriptionId: string; stepId: string },
  flows: readonly { id: string; templateId: string }[],
  catalog: readonly {
    templateId: string;
    name: string;
    pipeline?: readonly { id: string; title: string }[];
  }[],
): string {
  const templateId = flows.find(
    (flow) => flow.id === approval.subscriptionId,
  )?.templateId;
  if (!templateId) return EMPTY;
  const entry = catalog.find(
    (candidate) => candidate.templateId === templateId,
  );
  if (!entry) return templateId;
  const step = entry.pipeline?.find(
    (candidate) => candidate.id === approval.stepId,
  );
  return step ? `${entry.name} · ${step.title}` : entry.name;
}

const HELD_DECISION_LINE: Record<HeldDecision, string> = {
  pending: "Waiting for approval",
  // The job goes on under its own id (ADR-0044): ~~"Approved — continued in
  // a new run"~~ until Build 24.
  approved: "Approved",
  rejected: "Denied",
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
  approvals: readonly ApprovalOf[],
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
