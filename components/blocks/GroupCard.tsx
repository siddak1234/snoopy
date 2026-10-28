import { SectionTitle } from "@/components/dashboard/SectionTitle";
import { LIST_CARD } from "@/components/dashboard/SectionRows";
import { SPACING } from "@/lib/spacing";
import { notDrawn } from "./drawable";
import { Fallback } from "./Fallback";
import {
  SectionDetails,
  type BlockOf,
  type DrawBlocks,
  type SectionShape,
} from "./renderers";

/**
 * group: its title (`SectionTitle`), `title` above one card, its sections
 * drop-downs inside it, divided (backend ADR-0048 amendment 1; the owner's
 * F6 and Q6: "Candidate details" as one card of drop-downs). Each opens on
 * its own — no shared `name`, so several may be open at once — and the one
 * the platform marks `open`, the first, starts open. A group holds sections
 * only; anything else in it is the fallback sentence, logged by `notDrawn` as
 * `sections[n].type` (`drawable` checks the contract's `const` first, so this
 * is the last guard). No hooks, so a server-drawn page draws it as a live one
 * does.
 */
/** A group entry that is not a section: the fallback, logged with its place. */
function notShownEntry(at: number) {
  notDrawn("group", `sections[${at}].type`);
  return <Fallback />;
}

export function GroupCard({
  block,
  inner,
}: {
  block: BlockOf<"group">;
  inner: DrawBlocks;
}) {
  // The group's own sections: a block's parts, not a run's (`test/no-flow-code`).
  const { title, sections } = block;
  return (
    <section data-testid="block-group">
      <SectionTitle testId="block-group-title">{title}</SectionTitle>
      <div className={`${SPACING.title.top} ${LIST_CARD}`}>
        {sections.map((section, at) =>
          section &&
          typeof section === "object" &&
          section.type === "section" ? (
            <SectionDetails
              key={at}
              block={section as SectionShape}
              inner={inner}
              boxed={false}
            />
          ) : (
            <div key={at} className={SPACING.card.all}>
              {notShownEntry(at)}
            </div>
          ),
        )}
      </div>
    </section>
  );
}
