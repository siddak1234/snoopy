import type { ReactNode } from "react";
import type { Block } from "@/lib/automations";
import { SPACING } from "@/lib/spacing";
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

/** One block by its type's renderer; a type this build does not know, the fallback. */
function drawBlock(
  block: unknown,
  context: BlockContext,
  inner: DrawBlocks,
): ReactNode {
  const type =
    typeof block === "object" && block !== null
      ? (block as { type?: unknown }).type
      : undefined;
  const render =
    typeof type === "string" && Object.hasOwn(RENDERERS, type)
      ? (RENDERERS[type as Block["type"]] as Renderer<Block["type"]>)
      : undefined;
  if (!render) return <Fallback />;
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
          {drawBlock(block, context, inner)}
        </div>
      ))}
    </div>
  );
}

/**
 * A page body as the platform sent it (backend ADR-0048): every block drawn
 * as sent and in order, by its type's renderer; a block, form or target this
 * build does not know drawn as the decision says (`Fallback`, no press). An
 * answer with no blocks — a platform rolled back, or a flow it could not
 * read — draws the fallback alone. Uses no hooks, so a server-drawn page
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
  if (!Array.isArray(blocks))
    return (
      <div data-testid={testId}>
        <Fallback />
      </div>
    );
  return <Blocks blocks={blocks} context={context} testId={testId} />;
}
