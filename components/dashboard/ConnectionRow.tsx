import Image from "next/image";
import type { ReactNode } from "react";
import { PlugsConnectedIcon } from "@phosphor-icons/react/dist/ssr/PlugsConnected";
import { ProhibitIcon } from "@phosphor-icons/react/dist/ssr/Prohibit";
import { ProviderGlyph } from "@/components/ui/ProviderGlyph";
import { brandMark } from "@/lib/brand-logos";

/**
 * The one connection row (Build 21, spec A4; the owner's build 20 items 6 and
 * 7: "Logo then to the right name then below the account email", "Standard
 * format and size for each connection component on the list not random
 * buttons and such"): the vendor's mark at 24 × 24 · its name · under it one
 * short line — the account's email, or its state — and on the right one
 * thing: our own button, a check, a caret, or nothing. At least 64 tall for
 * every provider (`CONNECTION_ROW`). The app's `snoopy-mobile/components/connection-row.tsx`
 * on the website.
 *
 * Used on Connections, on a flow page's integration and email rows, on Set up,
 * on Connect integration — where the whole row is the control, so its body
 * (`ConnectionRowBody`) sits inside the caller's own label or link — and on a
 * flow's email page (Build 22). ~~A flow page's Connections~~ until Build 22.
 */

/** The row's box: the same least height, gap and padding for every provider. */
export const CONNECTION_ROW =
  "flex min-h-16 w-full items-center gap-2 py-3 text-left";

/**
 * A vendor's mark at 24 × 24 (the session's S12): QuickBooks' round symbol,
 * the design's Google glyph, or the icon set's plug for any other name —
 * never a wordmark, so every row lines up.
 */
export function ConnectionMark({ icon }: { icon: string | null | undefined }) {
  const mark = brandMark(icon);
  if (mark?.kind === "image") {
    // The vendor's file as bundled — `unoptimized`, so no re-encoding stands
    // between its bytes and the page.
    return (
      <Image
        src={mark.src}
        alt={mark.alt}
        width={24}
        height={24}
        unoptimized
        data-mark="image"
        className="size-6 shrink-0"
      />
    );
  }
  if (mark?.kind === "glyph") {
    return (
      <span
        role="img"
        aria-label={mark.alt}
        data-mark="glyph"
        className="inline-flex size-6 shrink-0 items-center justify-center text-[var(--text)]"
      >
        <ProviderGlyph provider={mark.provider} size={24} />
      </span>
    );
  }
  return (
    <PlugsConnectedIcon
      aria-hidden
      size={24}
      data-mark="icon"
      className="shrink-0 text-[var(--link)]"
    />
  );
}

/**
 * A glyph in the mark's 24 × 24 place, in the link colour: None's Prohibit,
 * and since Build 22 the flow page's email row (EnvelopeSimple) and the email
 * page's people (UserCircle) — so those rows line up with every connection
 * row (the app's `GlyphMark`).
 */
export function GlyphMark({ icon: Glyph }: { icon: typeof ProhibitIcon }) {
  return (
    <Glyph aria-hidden size={24} className="shrink-0 text-[var(--link)]" />
  );
}

/** None (no vendor): its mark, the Prohibit glyph at 24. */
export function NoneMark() {
  return <GlyphMark icon={ProhibitIcon} />;
}

export type ConnectionLineTone = "muted" | "ok" | "warn" | "err";

const LINE_TONE: Record<ConnectionLineTone, string> = {
  muted: "text-[var(--muted)]",
  ok: "text-[var(--success-text)]",
  warn: "text-[var(--warning-text)]",
  err: "text-[var(--error-text)]",
};

/**
 * What a row holds: the mark, the name and its line, then the right side.
 * `lineId` names the line, for a row that is a control named by the vendor
 * alone (`aria-label`) to describe itself by it (`aria-describedby`) — so a
 * screen reader hears "Connected", "Not connected" or "Ask an owner or admin
 * to connect it." as a sighted person reads it.
 */
export function ConnectionRowBody({
  mark,
  name,
  line,
  lineTone = "muted",
  lineId,
  right,
}: {
  mark: ReactNode;
  name: string;
  line?: string | null;
  lineTone?: ConnectionLineTone;
  lineId?: string;
  right?: ReactNode;
}) {
  return (
    <>
      {mark}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-[var(--text)]">
          {name}
        </span>
        {line ? (
          <span
            id={lineId}
            data-line
            className={`truncate text-xs ${LINE_TONE[lineTone]}`}
          >
            {line}
          </span>
        ) : null}
      </span>
      {right ?? null}
    </>
  );
}

/** A row that is no control itself: its right side may hold one. */
export function ConnectionRow({
  testId,
  ...body
}: Parameters<typeof ConnectionRowBody>[0] & { testId?: string }) {
  return (
    <div data-testid={testId} data-connection-row className={CONNECTION_ROW}>
      <ConnectionRowBody {...body} />
    </div>
  );
}
