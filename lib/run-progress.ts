/**
 * A run's progress, as its page draws it (spec §3.E; backend ADR-0037): one
 * row per visible group of the flow's steps that has a reported step, in the
 * groups' order — never one per step, never a step's id, and no row for a step
 * that did not run. A manifest that declares no groups gets one row per
 * reported step, titled from its pipeline. A run still going ends with a
 * "Working…" row.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

export type ProgressStep = {
  id: string;
  stepId: string;
  outcome: "ok" | "held" | "failed";
  summary: string;
  heldReason?: string;
  occurredAt: string;
};

export type ProgressManifest = {
  version: number;
  pipeline: readonly { id: string; title: string; group?: string }[];
  groups?: readonly { id: string; title: string; description: string }[];
};

export type ProgressRow = {
  key: string;
  outcome: "ok" | "held" | "failed" | "working";
  title: string;
  /** The latest reported step's line; absent when it is the title. */
  sub?: string;
  heldReason?: string;
  occurredAt?: string;
};

export const WORKING = "Working…";

/**
 * The rows for a run's reported steps. The manifest is the catalog's entry
 * for the run's flow, which lists one version: its groups are used only for a
 * run of that version — a step's group is that version's — while a step's
 * title is taken from it for any version, as the app takes it.
 */
export function progressRows({
  steps,
  manifest,
  runVersion,
  running,
}: {
  steps: readonly ProgressStep[];
  manifest: ProgressManifest | undefined;
  runVersion: number;
  /** A run still pending or running: the last row says it is working. */
  running: boolean;
}): ProgressRow[] {
  const declared = new Map(
    (manifest?.pipeline ?? []).map((step) => [step.id, step]),
  );
  const groups =
    manifest && manifest.version === runVersion ? manifest.groups : undefined;
  const rows: ProgressRow[] = [];

  if (groups && groups.length > 0) {
    // The latest reported step of each group, in the order steps arrived.
    const latest = new Map<string, ProgressStep>();
    const ungrouped: ProgressStep[] = [];
    for (const step of steps) {
      const group = declared.get(step.stepId)?.group;
      if (group && groups.some((candidate) => candidate.id === group)) {
        latest.set(group, step);
      } else {
        ungrouped.push(step);
      }
    }
    for (const group of groups) {
      const step = latest.get(group.id);
      if (!step) continue;
      rows.push(row(`group:${group.id}`, group.title, step));
    }
    // A step the manifest gives no group cannot happen while it declares
    // groups; one that did is still shown, never dropped.
    for (const step of ungrouped) rows.push(stepRow(step, declared));
  } else {
    for (const step of steps) rows.push(stepRow(step, declared));
  }

  if (running)
    rows.push({ key: "working", outcome: "working", title: WORKING });
  return rows;
}

function stepRow(
  step: ProgressStep,
  declared: Map<string, { title: string }>,
): ProgressRow {
  const title = declared.get(step.stepId)?.title;
  // Never the step's id: a step its manifest does not title is its line.
  return title
    ? row(`step:${step.id}`, title, step)
    : { ...row(`step:${step.id}`, step.summary, step), sub: undefined };
}

function row(key: string, title: string, step: ProgressStep): ProgressRow {
  return {
    key,
    outcome: step.outcome,
    title,
    sub: step.summary,
    ...(step.heldReason ? { heldReason: step.heldReason } : {}),
    occurredAt: step.occurredAt,
  };
}
