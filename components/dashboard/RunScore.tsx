import { Chip } from "@/components/blocks/renderers";
import { textTone } from "@/components/blocks/look";
import type { VerdictChip } from "@/lib/run-verdict";
import { SPACING } from "@/lib/spacing";

/**
 * A run's score in its page's header (the owner's F1 and Q5): large, in its
 * verdict's colour — the positive one green, the negative red, the theme's
 * tones the item's tiles and rows use — with the verdict's word beside it as
 * a chip; with no verdict, plain and alone. Read as "Score 82".
 */
export function RunScore({
  score,
  chip,
}: {
  score: number;
  chip: VerdictChip | null;
}) {
  return (
    <span className={`inline-flex items-center ${SPACING.inner.gap}`}>
      <span
        data-testid="run-score"
        data-tone={chip?.tone ?? "neutral"}
        className={`text-3xl font-medium ${textTone(chip?.tone)}`}
      >
        <span className="sr-only">Score </span>
        {score}
      </span>
      {chip ? <Chip badge={chip} /> : null}
    </span>
  );
}
