import type { ReactNode } from "react";
import type { Block } from "@/lib/automations";
import { Fallback } from "./Fallback";
import {
  BadgeBlock,
  FileBlock,
  LinkBlock,
  ListBlock,
  MetricBlock,
  QuestionsBlock,
  SectionBlock,
  TableBlock,
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
 * The registry: one renderer for each of the contract's ten types, keyed by
 * the generated union, so a type the contract adds fails the build here until
 * it is drawn (backend ADR-0048 decisions 8 and 12; `test/blocks-render`).
 */
export const RENDERERS: { [K in Block["type"]]: Renderer<K> } = {
  text: (block) => <TextBlock block={block} />,
  metric: (block) => <MetricBlock block={block} />,
  badge: (block) => <BadgeBlock block={block} />,
  table: (block) => <TableBlock block={block} />,
  list: (block, context) => <ListBlock block={block} context={context} />,
  section: (block, _, inner) => <SectionBlock block={block} inner={inner} />,
  file: (block, context) => <FileBlock block={block} context={context} />,
  link: (block) => <LinkBlock block={block} />,
  timeline: (block) => <TimelineBlock block={block} />,
  questions: (block, context) => (
    <QuestionsBlock block={block} context={context} />
  ),
};

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
    <div data-testid={testId} className="flex flex-col gap-3">
      {blocks.map((block, index) => (
        <div key={index} className="contents">
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
