import type { ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { PageRow } from "@/components/dashboard/PageRow";
import { SECTION_BAR, SECTION_ROW } from "@/components/dashboard/SectionRows";
import { Tile } from "@/components/dashboard/Tile";
import { TrackerItem } from "@/components/dashboard/TrackerItem";
import type { Block } from "@/lib/automations";
import { Fallback } from "./Fallback";
import {
  CHIP,
  LABEL,
  chipTone,
  httpsLink,
  openHref,
  textTone,
  type BlockPlace,
} from "./look";

/**
 * One renderer per block type (backend ADR-0048 decision 8), each made from a
 * part this site already has, and none using a hook — so the server-drawn
 * file pages draw them as the live pages do. Every word is the block's, as
 * sent and in order; nothing here adds, drops or rewords one. Text nodes
 * only: no markup is ever made from a block's words.
 */

export type BlockOf<K extends Block["type"]> = Extract<Block, { type: K }>;
type QuestionForm = BlockOf<"questions">["form"];
export type FormKind = QuestionForm["kind"];

/**
 * The page's own forms, each drawn by the component that draws it today, with
 * the page's context and gates (decision 2). A form the page does not offer
 * draws nothing; a form this build does not know draws the fallback.
 */
export type BlockForms = Partial<
  Record<FormKind, (form: QuestionForm) => ReactNode>
>;

export type BlockContext = BlockPlace & { forms?: BlockForms };

/** Draws a section's blocks: `BlockList`'s, handed down. */
export type DrawBlocks = (blocks: readonly unknown[]) => ReactNode;

const KNOWN_FORMS: readonly string[] = ["approval", "run", "item", "setup"];

/** A chip: a badge block, a section's, a list row's. */
function Chip({ badge }: { badge: { text: string; tone?: unknown } }) {
  return (
    <span
      data-testid="block-badge"
      data-tone={badge.tone ?? "neutral"}
      className={`${CHIP} shrink-0 ${chipTone(badge.tone)}`}
    >
      {badge.text}
    </span>
  );
}

/**
 * text: a line in the result line's look, toned by its tone (an error one an
 * alert); a `label` the small capitals over a page's parts, a heading; a
 * `strong` one in the medium weight; a `muted` one small and muted.
 */
export function TextBlock({ block }: { block: BlockOf<"text"> }) {
  if (block.style === "label")
    return (
      <h2 data-testid="block-label" className={`${LABEL} pt-2 first:pt-0`}>
        {block.text}
      </h2>
    );
  if (block.style === "muted")
    return (
      <p
        data-testid="block-text"
        className="text-xs break-words whitespace-pre-line text-[var(--muted)]"
      >
        {block.text}
      </p>
    );
  return (
    <p
      data-testid="block-text"
      data-tone={block.tone ?? "neutral"}
      {...(block.tone === "error" ? { role: "alert" } : {})}
      className={`text-sm break-words whitespace-pre-line ${textTone(block.tone)} ${block.style === "strong" ? "font-medium" : ""}`}
    >
      {block.text}
    </p>
  );
}

/** metric: the tiles, side by side — each value large over its label. */
export function MetricBlock({ block }: { block: BlockOf<"metric"> }) {
  const columns = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"];
  return (
    <dl
      data-testid="block-metric"
      className={`grid gap-3 ${columns[Math.min(block.items.length, 4) - 1] ?? "grid-cols-4"}`}
    >
      {block.items.map((item, index) => (
        <Tile
          key={`${item.label}-${index}`}
          label={item.label}
          value={item.value}
          testId={`block-metric-${index + 1}`}
          tone={textTone(item.tone)}
        />
      ))}
    </dl>
  );
}

/** badge: the document chip, on a line of its own. */
export function BadgeBlock({ block }: { block: BlockOf<"badge"> }) {
  return (
    <div className="flex">
      <Chip badge={block} />
    </div>
  );
}

/**
 * table: the document's pairs — two or three columns, each to its side, a
 * muted one in the muted token; a strong row in the medium weight; a row's
 * note small under it; lines between the rows when it is divided.
 */
export function TableBlock({ block }: { block: BlockOf<"table"> }) {
  const align = (index: number) =>
    block.columns[index]?.align === "end" ? "text-right" : "text-left";
  const muted = (index: number) =>
    block.columns[index]?.muted ? "text-[var(--muted)]" : "text-[var(--text)]";
  const titled = block.columns.some((column) => column.title);
  return (
    <table data-testid="block-table" className="w-full border-collapse text-sm">
      {titled ? (
        <thead>
          <tr>
            {block.columns.map((column, index) => (
              <th
                key={index}
                scope="col"
                className={`pb-1.5 text-xs font-medium text-[var(--muted)] ${align(index)}`}
              >
                {column.title ?? ""}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      {block.rows.map((row, at) => (
        <tbody
          key={at}
          className={
            block.divided
              ? "border-t border-[var(--ring)] first-of-type:border-t-0"
              : undefined
          }
        >
          <tr className={row.strong ? "font-medium" : undefined}>
            {block.columns.map((_, index) => (
              <td
                key={index}
                className={`py-0.5 align-top break-words ${index > 0 ? "pl-4" : ""} ${align(index)} ${muted(index)}`}
              >
                {row.cells[index] ?? ""}
              </td>
            ))}
          </tr>
          {row.note ? (
            <tr>
              <td
                colSpan={block.columns.length}
                className="pb-1 text-xs text-[var(--muted)]"
              >
                {row.note}
              </td>
            </tr>
          ) : null}
        </tbody>
      ))}
    </table>
  );
}

type ListItem = BlockOf<"list">["items"][number];

/** A row's score, read as its label ("Score") by a screen reader. */
function Value({ item }: { item: ListItem }) {
  return item.value ? (
    <span className="shrink-0 text-sm font-medium text-[var(--text)] tabular-nums">
      {item.valueLabel ? (
        <span className="sr-only">{`${item.valueLabel} `}</span>
      ) : null}
      {item.value}
    </span>
  ) : null;
}

/**
 * A row that opens a page: `PageRow` — its rank, its title, its chip, its
 * score; then its subtitle, its text and its address, in that order, each
 * under the title. The whole row is the press, so its address is its words
 * alone, never a second link.
 */
function OpenRow({ item, href }: { item: ListItem; href: string }) {
  const more = Boolean(item.subtitle || item.text || item.url);
  const title = (
    // Dimmed in the muted token, never by opacity: its text keeps AA contrast.
    <span
      className={`min-w-0 truncate font-medium ${item.muted ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
    >
      {item.title}
    </span>
  );
  return (
    <PageRow
      href={href}
      testId="block-list-row"
      dim={item.muted === true}
      end={more ? undefined : <Value item={item} />}
    >
      {item.lead ? (
        <span className="w-6 shrink-0 text-[var(--muted)] tabular-nums">
          {item.lead}
        </span>
      ) : null}
      {more ? (
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex min-w-0 flex-1">{title}</span>
            {item.badge ? <Chip badge={item.badge} /> : null}
            <Value item={item} />
          </span>
          {item.subtitle ? (
            <span className="text-xs break-words text-[var(--muted)]">
              {item.subtitle}
            </span>
          ) : null}
          {item.text ? (
            <span className="break-words whitespace-pre-line text-[var(--text)]">
              {item.text}
            </span>
          ) : null}
          {item.url ? (
            <span className="break-all text-[var(--text)]">{item.url}</span>
          ) : null}
        </span>
      ) : (
        <>
          {title}
          {item.badge ? <Chip badge={item.badge} /> : null}
        </>
      )}
    </PageRow>
  );
}

/**
 * An entry (`SectionRows`' entries): its title, strong; its chip and score;
 * its subtitle, muted; its text; and its address, a link only when https,
 * opening outside the site — else its words alone.
 */
function Entry({ item }: { item: ListItem }) {
  const link = httpsLink(item.url);
  return (
    <div data-testid="block-list-entry" className="min-w-0">
      <div className="flex items-start gap-3">
        {item.lead ? (
          <span className="w-6 shrink-0 text-sm text-[var(--muted)] tabular-nums">
            {item.lead}
          </span>
        ) : null}
        <p
          className={`min-w-0 flex-1 text-sm font-medium break-words ${item.muted ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
        >
          {item.title}
        </p>
        {item.badge ? <Chip badge={item.badge} /> : null}
        <Value item={item} />
      </div>
      {item.subtitle ? (
        <p className="text-xs break-words text-[var(--muted)]">
          {item.subtitle}
        </p>
      ) : null}
      {item.text ? (
        <p className="mt-1 text-sm break-words whitespace-pre-line text-[var(--text)]">
          {item.text}
        </p>
      ) : null}
      {item.url ? (
        link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm break-all text-[var(--link)] underline underline-offset-2"
          >
            {item.url}
          </a>
        ) : (
          <p className="mt-1 text-sm break-all text-[var(--text)]">
            {item.url}
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * list: each row that opens a page a `PageRow`, the rest entries; an empty
 * list its empty line (`EmptyRow`). A press to a target this build does not
 * know is drawn as an entry, with no press.
 */
export function ListBlock({
  block,
  context,
}: {
  block: BlockOf<"list">;
  context: BlockContext;
}) {
  if (block.items.length === 0)
    return block.empty ? <EmptyRow text={block.empty} /> : null;
  const rows = block.items.map((item) => ({
    item,
    href: openHref(item.open, context),
  }));
  return (
    <ol
      data-testid="block-list"
      className={`flex flex-col ${rows.some((row) => row.href) ? "gap-2" : "gap-3"}`}
    >
      {rows.map(({ item, href }, index) => (
        <li key={`${item.title}-${index}`} className="min-w-0">
          {href ? <OpenRow item={item} href={href} /> : <Entry item={item} />}
        </li>
      ))}
    </ol>
  );
}

/**
 * section: its own box (`SectionRows`' shell), closed unless `open`, that
 * opens on its own — its title, its subtitle muted under it, its chip and
 * the caret on its bar; in it, its blocks.
 */
export function SectionBlock({
  block,
  inner,
}: {
  block: BlockOf<"section">;
  inner: DrawBlocks;
}) {
  return (
    <details
      data-testid="block-section"
      open={block.open === true}
      className={`group ${SECTION_ROW}`}
    >
      <summary
        className={`${SECTION_BAR} cursor-pointer list-none rounded-[var(--radius-md)] [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium break-words text-[var(--text)]">
            {block.title}
          </span>
          {block.subtitle ? (
            <span className="text-xs break-words text-[var(--muted)]">
              {block.subtitle}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {block.badge ? <Chip badge={block.badge} /> : null}
          <CaretDownIcon
            size={20}
            aria-hidden
            className="text-[var(--muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className="border-t border-[var(--ring)] px-4 pt-3 pb-4">
        {inner(block.blocks)}
      </div>
    </details>
  );
}

/** file: its row (`PageRow`), its title alone; a target this build does not know, no press. */
export function FileBlock({
  block,
  context,
}: {
  block: BlockOf<"file">;
  context: BlockContext;
}) {
  const href = openHref(block.open, context);
  const title = (
    <span className="min-w-0 truncate font-medium text-[var(--text)]">
      {block.title}
    </span>
  );
  return href ? (
    <PageRow href={href} testId="block-file">
      {title}
    </PageRow>
  ) : (
    <div data-testid="block-file" className={`${SECTION_ROW} ${SECTION_BAR}`}>
      <span className="flex min-w-0 flex-1 items-center gap-3 text-sm">
        {title}
      </span>
    </div>
  );
}

/**
 * link: its title, then its host muted under it, opening outside the site
 * (`SectionRows`' anchor) — https only, checked again here; any other address
 * is its title alone, with no press.
 */
export function LinkBlock({ block }: { block: BlockOf<"link"> }) {
  const link = httpsLink(block.url);
  if (!link)
    return (
      <p data-testid="block-link" className="text-sm text-[var(--text)]">
        {block.title}
      </p>
    );
  return (
    <a
      data-testid="block-link"
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${SECTION_ROW} ${SECTION_BAR} transition hover:bg-[var(--surface-hover)]`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium break-words text-[var(--link)] underline underline-offset-2">
          {block.title}
        </span>
        <span className="text-xs break-all text-[var(--muted)]">
          {link.host}
        </span>
      </span>
      <CaretRightIcon
        size={20}
        aria-hidden
        className="shrink-0 text-[var(--muted)]"
      />
    </a>
  );
}

/** timeline: the steps (`TrackerItem`), each its state's look; one this build does not know, "unknown"'s. */
export function TimelineBlock({ block }: { block: BlockOf<"timeline"> }) {
  return (
    <ol data-testid="block-timeline" className="flex flex-col gap-4">
      {block.items.map((item, index) => (
        <TrackerItem
          key={`${item.title}-${index}`}
          row={{
            key: `block-${index + 1}`,
            title: item.title,
            state: item.state,
            ...(item.sub ? { sub: item.sub } : {}),
          }}
        />
      ))}
    </ol>
  );
}

/**
 * questions: the page's own form for it, with its gates (`BlockForms`) —
 * nothing where the page offers none; a form this build does not know, the
 * fallback.
 */
export function QuestionsBlock({
  block,
  context,
}: {
  block: BlockOf<"questions">;
  context: BlockContext;
}) {
  const kind: unknown = block.form?.kind;
  if (typeof kind !== "string" || !KNOWN_FORMS.includes(kind))
    return <Fallback />;
  const form = context.forms?.[kind as FormKind];
  return form ? (
    <div data-testid={`block-form-${kind}`} data-block-form={kind}>
      {form(block.form)}
    </div>
  ) : null;
}
