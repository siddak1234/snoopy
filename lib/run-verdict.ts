/**
 * A run's verdict, as its page names and colours it (the owner's F1 and Q5,
 * 2026-10-26; backend ADR-0048 amendment 1, plan Open 5): the run carries
 * `verdict` (`positive` or `negative`), and the flow names them
 * (`Subscription.items`' words, "Advance" and "Decline"), read here alone —
 * the run pages read no flow's words themselves (`test/no-flow-code`). The
 * positive one is green, the negative red, with its word as a chip so the
 * colour is never the only sign; with no verdict, or no words for it, the
 * score is plain and there is no chip.
 *
 * Pure, and loaded by its unit test as it is: no React and no `@/` import.
 */

/** What a flow calls its two verdicts. */
export type VerdictNames = { positive: string; negative: string };

/** A verdict's chip: its word and its tone. */
export type VerdictChip = { text: string; tone: "success" | "error" };

/** The flow's names for its verdicts, when its items declare them. */
export function verdictNamesOf(
  subscription:
    { items?: { verdictWords?: VerdictNames } | undefined } | undefined,
): VerdictNames | undefined {
  const words = subscription?.items?.verdictWords;
  return words?.positive && words.negative
    ? { positive: words.positive, negative: words.negative }
    : undefined;
}

/** A run's chip: positive green, negative red; none without a verdict or its words. */
export function verdictChip(
  verdict: string | undefined,
  names: VerdictNames | undefined,
): VerdictChip | null {
  if (!names) return null;
  if (verdict === "positive") return { text: names.positive, tone: "success" };
  if (verdict === "negative") return { text: names.negative, tone: "error" };
  return null;
}
