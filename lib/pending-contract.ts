import type { components } from "./generated/platform-contracts/automations";

/**
 * PENDING CONTRACT: the platform round for a setup dropdown and a review of
 * each change (Round 21; the round's platform spec, F1 and F2). The backend
 * adds these shapes to its contracts in the same round, and this build runs
 * ahead of them. Until `npm run generate:platform-contracts` reads the
 * backend's merged documents, this module is the narrowest local type each
 * screen needs, and the one place they live. At that regeneration this file
 * is deleted and its importers read the generated names
 * (`AutomationSetupField`'s `select`, `options` and `multiple`;
 * `Approval.decisions`; the decision body's `decisions`; the `review`
 * question form). A field name that differs is then a typecheck failure, not
 * a guess on screen. A form kind is not: `BlockForms` is a Partial record, so
 * the regeneration checks `PENDING_FORM_KINDS` by hand. Never hand-edit a
 * generated file to match this one. The app's twin:
 * `snoopy-mobile/lib/platform/pending-contract.ts`.
 *
 * No React and no `@/` import: the unit tests load this file as it is.
 */

type Schemas = components["schemas"];

/** The new setup control (F1): a list of choices, one or several. */
export type PendingSetupControl = "select";

/**
 * A setup field as this build reads it: the generated field, with `select`
 * among its controls and the select's own keys, `options` (1 to 32, unique,
 * 1 to 80 characters each) and `multiple` (default false). Its saved value
 * and its `defaultValue` are one option, or a list of them.
 */
export type PendingSetupField = Omit<
  Schemas["AutomationSetupField"],
  "control"
> & {
  control: Schemas["AutomationSetupField"]["control"] | PendingSetupControl;
  options?: string[];
  multiple?: boolean;
};

/** One change a held run offers for review (F2): `id` as a step id, `label` 1–120, `detail` 1–200. */
export type OfferedDecision = { id: string; label: string; detail?: string };

/** A person's answer to one offered change. */
export type DecisionAnswer = "accepted" | "denied";

/** One answer, as the decision route takes it and the approval keeps it. */
export type AnsweredDecision = { id: string; decision: DecisionAnswer };

/**
 * An approval that may offer changes (`decisions`) and, once the review is
 * saved, keep each one's answer on its row. A saved review reads `approved`.
 */
export type PendingApproval = Schemas["Approval"] & {
  decisions?: (OfferedDecision & { decision?: DecisionAnswer })[];
};

/** The decision route's body for an approval that offers changes: every offered id answered once. */
export type ReviewBody = { decisions: AnsweredDecision[] };

/**
 * The question forms this build draws that the generated contract does not
 * name yet: the backend's draft sends a held run's review as its own form,
 * `kind: "review"` (an older build draws the fallback), with `decisions`.
 */
export const PENDING_FORM_KINDS = ["review"] as const;
export type PendingFormKind = (typeof PENDING_FORM_KINDS)[number];

/** A question form as this build reads it: the generated one, its kind widened, with the changes a review offers. */
export type PendingQuestionForm = Omit<
  Extract<Schemas["Block"], { type: "questions" }>["form"],
  "kind"
> & {
  kind:
    | Extract<Schemas["Block"], { type: "questions" }>["form"]["kind"]
    | PendingFormKind;
  decisions?: unknown;
};

/** The changes an approval or a form offers, or none (a plain approval: Approve / Deny). */
export function offeredDecisions(
  holder: object | undefined | null,
): OfferedDecision[] {
  const list = (holder as { decisions?: unknown } | undefined | null)
    ?.decisions;
  if (!Array.isArray(list)) return [];
  return list.flatMap((row: unknown) => {
    if (typeof row !== "object" || row === null) return [];
    const { id, label, detail } = row as Record<string, unknown>;
    if (typeof id !== "string" || typeof label !== "string") return [];
    return [
      typeof detail === "string" && detail !== ""
        ? { id, label, detail }
        : { id, label },
    ];
  });
}

/** A saved review's count: how many changes were accepted and denied. */
export type ReviewTally = { accepted: number; denied: number };

/**
 * A saved review's count, "{a} accepted · {d} denied" (words.md section 3):
 * an approval decided `approved` whose offered rows carry their answers.
 * `null` for any other approval.
 */
export function reviewTally(
  approval: { status: string; decisions?: unknown } | undefined | null,
): ReviewTally | null {
  if (!approval || approval.status !== "approved") return null;
  const list = approval.decisions;
  if (!Array.isArray(list) || list.length === 0) return null;
  const answers = list.map((row: unknown) =>
    typeof row === "object" && row !== null
      ? (row as { decision?: unknown }).decision
      : undefined,
  );
  if (!answers.every((answer) => answer === "accepted" || answer === "denied"))
    return null;
  const accepted = answers.filter((answer) => answer === "accepted").length;
  return { accepted, denied: answers.length - accepted };
}
