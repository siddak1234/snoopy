import type { ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { EmptyRow } from "@/components/dashboard/EmptyRow";
import { PageRow } from "@/components/dashboard/PageRow";
import { SectionTitle } from "@/components/dashboard/SectionTitle";
import {
  LIST_CARD,
  SECTION_BAR,
  SECTION_ROW,
} from "@/components/dashboard/SectionRows";
import { Tile } from "@/components/dashboard/Tile";
import { TrackerItem } from "@/components/dashboard/TrackerItem";
import type { Block } from "@/lib/automations";
import { fileViewHref } from "@/lib/run-files";
import { offeredDecisions } from "@/lib/run-progress";
import { CARD, ROW, SPACING } from "@/lib/spacing";
import { notDrawn } from "./drawable";
import { Fallback } from "./Fallback";
import {
  CHIP,
  chipTone,
  httpsLink,
  openHref,
  textTone,
  type BlockPlace,
} from "./look";
import { Picture } from "./Picture";

/**
 * One renderer per block type (backend ADR-0048 decision 8), each made from a
 * part this site already has, and none using a hook — so the server-drawn
 * file pages draw them as the live pages do. Every word is the block's, as
 * sent and in order; nothing here adds, drops or rewords one. Text nodes
 * only: no markup is ever made from a block's words. Spaced by the table
 * alone (`lib/spacing.ts`; the spacing check).
 */

export type BlockOf<K extends Block["type"]> = Extract<Block, { type: K }>;
/** A question form, as the generated contract names it: `approval`, `review` (Round 21's F2), `run`, `item` or `setup`. */
export type QuestionForm = BlockOf<"questions">["form"];
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

const KNOWN_FORMS: readonly string[] = [
  "approval",
  "run",
  "item",
  "setup",
  "review",
] satisfies readonly FormKind[];

/** A chip: a badge block, a section's, a list row's. */
export function Chip({ badge }: { badge: { text: string; tone?: unknown } }) {
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
    return <SectionTitle testId="block-label">{block.text}</SectionTitle>;
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
      className={`grid ${SPACING.inner.gap} ${columns[Math.min(block.items.length, 4) - 1] ?? "grid-cols-4"}`}
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
                className={`${SPACING.inner.pb} text-xs font-medium text-[var(--muted)] ${align(index)}`}
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
                className={`align-top break-words ${block.divided ? SPACING.inner.py : ""} ${index > 0 ? SPACING.rowX.left : ""} ${align(index)} ${muted(index)}`}
              >
                {row.cells[index] ?? ""}
              </td>
            ))}
          </tr>
          {row.note ? (
            <tr>
              <td
                colSpan={block.columns.length}
                className={`${SPACING.inner.pb} text-xs text-[var(--muted)]`}
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

/**
 * A row's score, read as its label ("Score") by a screen reader, in its
 * `valueTone`'s colour — the platform's, from the run's verdict: the
 * positive one green, the negative red, none the text's (Q5). The colour is
 * never the only sign: the row's chip says the verdict's word.
 */
function Value({ item }: { item: ListItem }) {
  return item.value ? (
    <span
      data-testid="block-list-value"
      data-tone={item.valueTone ?? "neutral"}
      className={`shrink-0 text-sm font-medium tabular-nums ${textTone(item.valueTone)}`}
    >
      {item.valueLabel ? (
        <span className="sr-only">{`${item.valueLabel} `}</span>
      ) : null}
      {item.value}
    </span>
  ) : null;
}

/**
 * A row that opens a page: `PageRow`, flat inside the list's card — its
 * rank, its title, its chip, its score; then its subtitle, its text and its
 * address, in that order, each under the title. The whole row is the press,
 * so its address is its words alone, never a second link.
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
      boxed={false}
      dim={item.muted === true}
      end={more ? undefined : <Value item={item} />}
    >
      {item.lead ? (
        <span className="w-6 shrink-0 text-[var(--muted)] tabular-nums">
          {item.lead}
        </span>
      ) : null}
      {more ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={`flex min-w-0 items-center ${SPACING.inner.gap}`}>
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
    <div data-testid="block-list-entry" className={`min-w-0 ${ROW}`}>
      <div className={`flex items-start ${SPACING.inner.gap}`}>
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
        <p
          className={`${SPACING.inner.top} text-sm break-words whitespace-pre-line text-[var(--text)]`}
        >
          {item.text}
        </p>
      ) : null}
      {item.url ? (
        link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${SPACING.inner.top} inline-block text-sm break-all text-[var(--link)] underline underline-offset-2`}
          >
            {item.url}
          </a>
        ) : (
          <p
            className={`${SPACING.inner.top} text-sm break-all text-[var(--text)]`}
          >
            {item.url}
          </p>
        )
      ) : null}
    </div>
  );
}

/**
 * list: one card, its rows divided (the table's rule: a group is one card),
 * each row that opens a page a `PageRow`, the rest entries; an empty list
 * its empty line (`EmptyRow`). A press to a target this build does not know
 * is drawn as an entry, with no press. Its search, sort and pages are
 * `Paged`'s, around it.
 */
export function ListBlock({
  block,
  context,
}: {
  block: BlockOf<"list">;
  context: BlockContext;
}) {
  if (block.items.length === 0)
    return block.empty ? <EmptyRow band={false} text={block.empty} /> : null;
  const rows = block.items.map((item) => ({
    item,
    href: openHref(item.open, context),
  }));
  return (
    <ol data-testid="block-list" className={LIST_CARD}>
      {rows.map(({ item, href }, index) => (
        <li key={`${item.title}-${index}`} className="min-w-0">
          {href ? <OpenRow item={item} href={href} /> : <Entry item={item} />}
        </li>
      ))}
    </ol>
  );
}

/** A section as a group card or its own box draws it: what its bar and its body hold. */
export type SectionShape = BlockOf<"section"> & { open?: boolean };

/**
 * A section's drop-down: its bar — its title, its subtitle muted under it,
 * its chip and the caret — closed unless `open`, opening on its own; in it,
 * its blocks. `boxed`, its own box (`SectionRows`' shell); else a row of a
 * group's card (`GroupCard`).
 */
export function SectionDetails({
  block,
  inner,
  boxed,
}: {
  block: SectionShape;
  inner: DrawBlocks;
  boxed: boolean;
}) {
  return (
    <details
      data-testid="block-section"
      open={block.open === true}
      className={boxed ? `group ${SECTION_ROW}` : "group"}
    >
      <summary
        className={`${SECTION_BAR} cursor-pointer list-none rounded-[var(--radius-md)] [&::-webkit-details-marker]:hidden`}
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium break-words text-[var(--text)]">
            {block.title}
          </span>
          {block.subtitle ? (
            <span className="text-xs break-words text-[var(--muted)]">
              {block.subtitle}
            </span>
          ) : null}
        </span>
        <span className={`flex shrink-0 items-center ${SPACING.inner.gap}`}>
          {block.badge ? <Chip badge={block.badge} /> : null}
          <CaretDownIcon
            size={20}
            aria-hidden
            className="text-[var(--muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </span>
      </summary>
      <div className={`border-t border-[var(--ring)] ${CARD}`}>
        {inner(block.blocks)}
      </div>
    </details>
  );
}

/** section: its own box, a drop-down (`SectionDetails`). */
export function SectionBlock({
  block,
  inner,
}: {
  block: BlockOf<"section">;
  inner: DrawBlocks;
}) {
  return <SectionDetails block={block} inner={inner} boxed />;
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
      <span
        className={`flex min-w-0 flex-1 items-center ${SPACING.inner.gap} text-sm`}
      >
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
      <span className="flex min-w-0 flex-col">
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
    <ol
      data-testid="block-timeline"
      className={`flex flex-col ${SPACING.group.gap}`}
    >
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
 * A review's changes where no form is drawn for them (backend ADR-0048
 * amendment 2): each one's label, then its detail, read by everyone (words.md
 * section 3), with no pills. The " · " between them is drawn, not a word, so
 * the label and the detail are each the flow's own words, as the block
 * fixtures read them.
 */
function ReviewRows({ form }: { form: QuestionForm }) {
  const changes = offeredDecisions(form);
  if (changes.length === 0) return null;
  return (
    <ul
      data-testid="block-review-rows"
      className={`flex flex-col ${SPACING.inner.gap}`}
    >
      {changes.map((change) => (
        <li key={change.id} className="min-w-0 text-sm text-[var(--text)]">
          <span>{change.label}</span>
          {change.detail ? (
            <span className="before:content-['_·_']">{change.detail}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * questions: the page's own form for it, with its gates (`BlockForms`) —
 * nothing where the page offers none, but a review's changes (`ReviewRows`);
 * a form this build does not know, the fallback, logged by `notDrawn` as
 * `form.kind`.
 */
export function QuestionsBlock({
  block,
  context,
}: {
  block: BlockOf<"questions">;
  context: BlockContext;
}) {
  const kind: unknown = block.form?.kind;
  if (typeof kind !== "string" || !KNOWN_FORMS.includes(kind)) {
    notDrawn("questions", "form.kind");
    return <Fallback />;
  }
  const form = context.forms?.[kind as FormKind];
  // Its title ("Add candidate") is drawn with the form, `title` above it: a
  // page that offers no form, or whose form draws nothing (a member, a flow
  // not live), draws neither.
  const drawn = form ? form(block.form) : null;
  if (drawn === null || drawn === undefined || drawn === false)
    return kind === "review" ? <ReviewRows form={block.form} /> : null;
  return (
    <div data-testid={`block-form-${kind}`} data-block-form={kind}>
      {block.title ? (
        <>
          <SectionTitle testId="block-label">{block.title}</SectionTitle>
          {/* The title gap, as a label block's over its list (F3). */}
          <div className={SPACING.title.top}>{drawn}</div>
        </>
      ) : (
        drawn
      )}
    </div>
  );
}

/** A file a picture draws: a PDF in a frame, a JPEG or a PNG as an image; any other, none. */
function pictureKind(file: BlockOf<"image">["file"]): "pdf" | "image" | null {
  const type = file.contentType.toLowerCase();
  if (type === "application/pdf") return "pdf";
  if (type === "image/jpeg" || type === "image/png") return "image";
  return null;
}

/**
 * image: one of the run's own files, drawn in the page (`Picture`, read
 * from its file page's own route; backend ADR-0048 amendment 1, decision 2).
 * Its address is its typed target's alone (`openHref`), never a word of the
 * block; a target this build does not know, or a file no browser draws in
 * place, is its file's row instead. Its `alt` is read aloud only.
 */
export function ImageBlock({
  block,
  context,
}: {
  block: BlockOf<"image">;
  context: BlockContext;
}) {
  const page = openHref(block.open, context);
  const kind = pictureKind(block.file);
  if (!page || !kind)
    return (
      <FileBlock
        block={{
          type: "file",
          title: block.file.filename,
          open: block.open,
          file: block.file,
        }}
        context={context}
      />
    );
  return (
    <Picture
      alt={block.alt}
      page={page}
      view={fileViewHref(page)}
      pdf={kind === "pdf"}
    />
  );
}

type ChartPoint = BlockOf<"chart">["points"][number];

/** The first point of the highest value, and of the lowest. */
function extremes(points: readonly ChartPoint[]) {
  let high = points[0]!;
  let low = points[0]!;
  for (const point of points) {
    if (point.value > high.value) high = point;
    if (point.value < low.value) low = point;
  }
  return { high, low };
}

/** The most dots a line draws: one at each point when there are this many or fewer. */
const LINE_DOTS = 24;

/**
 * chart: a bar or a line chart (backend ADR-0048 amendment 1, decision 3),
 * drawn here in SVG, with no library. Its box is an image read aloud as its
 * `alt` (the platform's words: its title, its kind and every value), and the
 * words inside it are text nodes a screen reader skips. A bar chart is a row
 * a point: its label, a bar its `value` over the highest (`<rect width>`),
 * then its `text`. A line chart is its points evenly spaced, the highest
 * and lowest `text` on the left, the first and last label under it, a dot at
 * each point when there are 24 or fewer. The colours are the theme's accent
 * and ring; nothing moves, and no size is a `style`.
 */
export function ChartBlock({ block }: { block: BlockOf<"chart"> }) {
  const points = block.points;
  // The contract's `minItems: 1`, which the field check does not read.
  if (points.length === 0) {
    notDrawn("chart", "points");
    return <Fallback />;
  }
  return (
    <div
      data-testid="block-chart"
      data-kind={block.kind}
      role="img"
      aria-label={block.alt}
      className={`flex flex-col ${SPACING.inner.gap} rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)] ${CARD}`}
    >
      <p
        aria-hidden
        className="text-sm font-medium break-words text-[var(--text)]"
      >
        {block.title}
      </p>
      {block.kind === "line" ? (
        <LineChart points={points} />
      ) : (
        <BarChart points={points} />
      )}
    </div>
  );
}

function BarChart({ points }: { points: readonly ChartPoint[] }) {
  const max = Math.max(...points.map((point) => point.value));
  return (
    <div
      aria-hidden
      className={`grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] items-center ${SPACING.inner.x} ${SPACING.inner.y} text-sm`}
    >
      {points.map((point, at) => (
        <div key={at} className="contents">
          <span className="truncate text-[var(--text)]">{point.label}</span>
          <svg
            viewBox="0 0 100 8"
            preserveAspectRatio="none"
            className="h-2 w-full"
          >
            <rect
              width="100"
              height="8"
              rx="4"
              className="fill-[var(--ring)]"
            />
            {max > 0 ? (
              <rect
                data-testid="block-chart-bar"
                width={String((point.value / max) * 100)}
                height="8"
                rx="4"
                className="fill-[var(--accent)]"
              />
            ) : null}
          </svg>
          <span className="text-right font-medium text-[var(--text)] tabular-nums">
            {point.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function LineChart({ points }: { points: readonly ChartPoint[] }) {
  const { high, low } = extremes(points);
  const span = high.value - low.value;
  // Evenly spaced, the highest at the top, a flat line through the middle.
  const at = (index: number) =>
    points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
  const level = (value: number) =>
    span === 0 ? 20 : 36 - ((value - low.value) / span) * 32;
  const line = points
    .map((point, index) => `${at(index)},${level(point.value)}`)
    .join(" ");
  return (
    <div aria-hidden className={`flex flex-col ${SPACING.inner.gap}`}>
      <div className={`flex ${SPACING.inner.gap}`}>
        <div className="flex shrink-0 flex-col justify-between text-xs text-[var(--muted)] tabular-nums">
          <span>{high.text}</span>
          <span>{low.text}</span>
        </div>
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-32 w-full"
        >
          <polyline
            points={line}
            fill="none"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-[var(--accent)]"
          />
          {points.length <= LINE_DOTS
            ? points.map((point, index) => (
                // A dot that stays round however the chart is stretched.
                <line
                  key={index}
                  data-testid="block-chart-dot"
                  x1={at(index)}
                  y1={level(point.value)}
                  x2={at(index)}
                  y2={level(point.value)}
                  strokeWidth="6"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  className="stroke-[var(--accent)]"
                />
              ))
            : null}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{points[0]!.label}</span>
        <span>{points[points.length - 1]!.label}</span>
      </div>
    </div>
  );
}
