import type { BlockOpen } from "@/lib/automations";
import { itemFilePath, runFilePath } from "@/lib/run-files";

/**
 * How the blocks look and where they go (backend ADR-0048 decisions 8–10):
 * a tone is a theme token, never a colour of its own; a link is https only,
 * checked again here; a press is a typed target this site maps to its route.
 * Anything this build does not know draws neutral, or without a press.
 */

type Tone = "neutral" | "success" | "warning" | "error";

/** A tone's text colour: the result line's (`RunLive`), neutral the text's. */
const TEXT_TONE: Record<Tone, string> = {
  neutral: "text-[var(--text)]",
  success: "text-[var(--success-text)]",
  warning: "text-[var(--warning-text)]",
  error: "text-[var(--error-text)]",
};

/** A chip's ground and text: the document chip's, plus an error tone. */
const CHIP_TONE: Record<Tone, string> = {
  neutral: "bg-[var(--surface-strong)] text-[var(--muted)]",
  success: "bg-[var(--success-bg)] text-[var(--success-text)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning-text)]",
  error: "bg-[var(--error-bg)] text-[var(--error-text)]",
};

/** A tone this build knows, else neutral. */
export function toneOf(tone: unknown): Tone {
  return typeof tone === "string" && Object.hasOwn(TEXT_TONE, tone)
    ? (tone as Tone)
    : "neutral";
}

export const textTone = (tone: unknown): string => TEXT_TONE[toneOf(tone)];
export const chipTone = (tone: unknown): string => CHIP_TONE[toneOf(tone)];

/** A chip: the document chip's shape. */
export const CHIP =
  "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium";

/**
 * An address to open outside the site: `https:` only, with a host and no
 * user or password — as the platform checks it, checked again when drawn.
 * Anything else is null and is not drawn as a link.
 */
export function httpsLink(url: unknown): { href: string; host: string } | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !parsed.host ||
      parsed.username ||
      parsed.password
    )
      return null;
    return { href: parsed.href, host: parsed.host };
  } catch {
    return null;
  }
}

/** Where the blocks are drawn: what an item's file opens is under its flow. */
export type BlockPlace = { subscriptionId?: string };

const id = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * A press's page on this site: a run, a run's file, an item's file. A target
 * this build does not know, or one missing its ids, is null: drawn without
 * a press.
 */
export function openHref(
  open: BlockOpen | undefined,
  place: BlockPlace,
): string | null {
  if (!open || typeof open !== "object") return null;
  const { runId, fileId, itemId } = open as Record<string, unknown>;
  switch (open.target) {
    case "run":
      return id(runId) ? `/account/runs/${encodeURIComponent(runId)}` : null;
    case "run-file":
      return id(runId) && id(fileId) ? runFilePath(runId, fileId) : null;
    case "item-file":
      return id(itemId) && id(place.subscriptionId)
        ? itemFilePath(place.subscriptionId, itemId)
        : null;
    default:
      return null;
  }
}

/**
 * A page's parts in the order its flow's manifest gives them
 * (`Subscription.pages`, backend ADR-0048 decision 5), else `fallback`,
 * today's order. A part this build does not know is `null`: the page draws
 * the fallback sentence in its place.
 */
export function pageParts<T extends string>(
  declared: readonly string[] | undefined,
  known: readonly T[],
  fallback: readonly T[],
): (T | null)[] {
  return (declared ?? fallback).map((part) =>
    (known as readonly string[]).includes(part) ? (part as T) : null,
  );
}
