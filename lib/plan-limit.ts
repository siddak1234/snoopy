/**
 * Over the plan's flow allowance — the owner's build 13 decision 7a3: while a
 * workspace holds more flows than its plan allows, no flow starts a run until it
 * archives down. The words are the app's (`snoopy-mobile/lib/content/refusals.ts`,
 * `overPlanSentence`), so a refusal reads the same in a browser as on a phone.
 * Paused and draft flows count — the platform counts every flow not archived —
 * so the sentence says archive, never pause.
 */
export function overPlanSentence(allowed: number, live: number): string {
  const flows = allowed === 1 ? "flow" : "flows";
  return `Your plan allows ${allowed} ${flows}; this workspace has ${live}. No flow can start a run until you archive ${live - allowed}. Paused and draft flows count.`;
}

/** The plan's ceiling beside the flows held, as the subscription list states it. */
export type FlowAllowance = { allowed: number | null; live: number };

/**
 * Over only when a ceiling is known and passed. A plan without one
 * (`allowed: null`) is never over, and a list without an allowance — the
 * platform could not say — is unknown, not over.
 */
export function flowsOverPlan(
  allowance: FlowAllowance | undefined,
): { allowed: number; live: number } | null {
  if (!allowance || allowance.allowed === null) return null;
  if (allowance.live <= allowance.allowed) return null;
  return { allowed: allowance.allowed, live: allowance.live };
}

export const PLAN_LIMIT_LINE =
  "This workspace has reached its current plan limit.";

/**
 * A run start refused over the plan, in words: the sentence with the
 * platform's numbers when they are usable, else the plan-limit line — never a
 * made-up count.
 */
export function overPlanRefusal(
  details: Record<string, unknown> | undefined,
): string {
  const limit = details?.limit;
  const live = details?.live;
  return Number.isSafeInteger(limit) &&
    Number.isSafeInteger(live) &&
    (live as number) > (limit as number)
    ? overPlanSentence(limit as number, live as number)
    : PLAN_LIMIT_LINE;
}
