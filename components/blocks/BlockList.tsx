import type { ReactNode } from "react";
import type { Block } from "@/lib/automations";
import { SPACING } from "@/lib/spacing";
import { BlockBoundary } from "./BlockBoundary";
import { drawable, notDrawn } from "./drawable";
import { Fallback } from "./Fallback";
import { GroupCard } from "./GroupCard";
import { Paged } from "./Paged";
import {
  BadgeBlock,
  ChartBlock,
  FileBlock,
  ImageBlock,
  LinkBlock,
  MetricBlock,
  QuestionsBlock,
  SectionBlock,
  TextBlock,
  TimelineBlock,
  type BlockContext,
  type BlockOf,
  type DrawBlocks,
} from "./renderers";

export type { BlockContext, BlockForms } from "./renderers";

type Renderer<K extends Block["type"]> = (
  block: BlockOf<K>,
  context: BlockContext,
  inner: DrawBlocks,
) => ReactNode;

/**
 * The registry: one renderer for each of the contract's thirteen types, keyed
 * by the generated union, so a type the contract adds fails the build here
 * until it is drawn (backend ADR-0048 decisions 8 and 12, and its amendment
 * 1; `test/blocks-render`). A list or a table is drawn inside `Paged`, which
 * adds its search, sort and pages when it has more than 25 rows, or a
 * search when the platform marks the list `searchable`; it is handed the
 * place alone, never the page's forms.
 */
export const RENDERERS: { [K in Block["type"]]: Renderer<K> } = {
  text: (block) => <TextBlock block={block} />,
  metric: (block) => <MetricBlock block={block} />,
  badge: (block) => <BadgeBlock block={block} />,
  table: (block, context) => (
    <Paged block={block} place={{ subscriptionId: context.subscriptionId }} />
  ),
  list: (block, context) => (
    <Paged block={block} place={{ subscriptionId: context.subscriptionId }} />
  ),
  section: (block, _, inner) => <SectionBlock block={block} inner={inner} />,
  file: (block, context) => <FileBlock block={block} context={context} />,
  link: (block) => <LinkBlock block={block} />,
  timeline: (block) => <TimelineBlock block={block} />,
  questions: (block, context) => (
    <QuestionsBlock block={block} context={context} />
  ),
  image: (block, context) => <ImageBlock block={block} context={context} />,
  chart: (block) => <ChartBlock block={block} />,
  group: (block, _, inner) => <GroupCard block={block} inner={inner} />,
};

/** A label block: a title, so what follows it sits the `title` gap under it. */
const isLabel = (block: unknown): boolean =>
  typeof block === "object" &&
  block !== null &&
  (block as { type?: unknown }).type === "text" &&
  (block as { style?: unknown }).style === "label";

/**
 * The gap above a block (the spacing table's rules, F3): none above the
 * first; `title` under a label, which heads it; else `group`.
 */
function gapAbove(blocks: readonly unknown[], index: number): string {
  if (index === 0) return "";
  return isLabel(blocks[index - 1]) ? SPACING.title.top : SPACING.group.top;
}

/** A block's `type`, or `unknown` when it has none: what a fallback is logged with. */
const typeOf = (block: unknown): string => {
  const type =
    typeof block === "object" && block !== null
      ? (block as { type?: unknown }).type
      : undefined;
  return typeof type === "string" ? type : "unknown";
};

/** The fallback in a block's place, logged with its type and why (`notDrawn`). */
function notShown(type: string, error: string): ReactNode {
  notDrawn(type, error);
  return <Fallback />;
}

/**
 * One block by its type's renderer; a type this build does not know, or a
 * known one without a field its schema requires (`drawable`, Round 21), the
 * fallback — checked before drawing, so a server-drawn page is kept too.
 */
function drawBlock(
  block: unknown,
  context: BlockContext,
  inner: DrawBlocks,
): ReactNode {
  const type = typeOf(block);
  const render = Object.hasOwn(RENDERERS, type)
    ? (RENDERERS[type as Block["type"]] as Renderer<Block["type"]>)
    : undefined;
  if (!render) return notShown(type, "unknown type");
  const missing = drawable(type, block as object);
  if (missing) return notShown(type, missing);
  return render(block as Block, context, inner);
}

function Blocks({
  blocks,
  context,
  testId,
}: {
  blocks: readonly unknown[];
  context: BlockContext;
  testId?: string;
}) {
  const inner: DrawBlocks = (within) => (
    <Blocks blocks={within} context={context} />
  );
  return (
    <div data-testid={testId} className="flex flex-col">
      {blocks.map((block, index) => (
        // A block that draws nothing (a form the page does not offer) takes no gap.
        <div key={index} className={`${gapAbove(blocks, index)} empty:hidden`}>
          <BlockBoundary type={typeOf(block)}>
            {drawBlock(block, context, inner)}
          </BlockBoundary>
        </div>
      ))}
    </div>
  );
}

/**
 * A page body as the platform sent it (backend ADR-0048): every block drawn
 * as sent and in order, by its type's renderer; a block, form or target this
 * build does not know drawn as the decision says (`Fallback`, no press). A
 * block missing a required field, or whose renderer throws in the browser
 * (`BlockBoundary`), is the fallback too, and the next block still draws. An
 * answer with no blocks — a platform rolled back, or a flow it could not
 * read — draws the fallback alone, and a body that is not a list is the
 * fallback too, logged as `unknown`, `not a list`. Uses no hooks, so a server-drawn page
 * draws it as a live one does.
 */
export function BlockList({
  blocks,
  context = {},
  testId = "blocks",
}: {
  blocks: readonly unknown[] | undefined;
  context?: BlockContext;
  testId?: string;
}) {
  if (!Array.isArray(blocks)) {
    // Absent (`undefined`) is a platform rolled back, or a flow it could not
    // read, and is not logged; anything else is a body this build cannot read.
    if (blocks !== undefined) notDrawn("unknown", "not a list");
    return (
      <div data-testid={testId}>
        <Fallback />
      </div>
    );
  }
  return <Blocks blocks={blocks} context={context} testId={testId} />;
}
