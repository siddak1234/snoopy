import type { ReactNode } from "react";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { CircleDashedIcon } from "@phosphor-icons/react/dist/ssr/CircleDashed";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/ssr/CircleNotch";
import { HandPalmIcon } from "@phosphor-icons/react/dist/ssr/HandPalm";
import { MinusCircleIcon } from "@phosphor-icons/react/dist/ssr/MinusCircle";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import type { TrackerState } from "@/lib/run-progress";

/** One step as a row draws it: its title, its state, and its state in words. */
export type TrackerItemRow = {
  key: string;
  title: string;
  state: TrackerState;
  sub?: string;
};

/** Each state's icon and colour token. */
export const STATE_LOOK: Record<
  TrackerState,
  { Icon: typeof CheckCircleIcon; tone: string; motion?: string }
> = {
  waiting: { Icon: CircleDashedIcon, tone: "text-[var(--muted)]" },
  // The running step's icon spins; with reduced motion it stays still (Build
  // 23's A4, the app's rule). Only this state moves.
  working: {
    Icon: CircleNotchIcon,
    tone: "text-[var(--link)]",
    motion: "motion-safe:animate-spin",
  },
  done: { Icon: CheckCircleIcon, tone: "text-[var(--success-text)]" },
  held: { Icon: HandPalmIcon, tone: "text-[var(--warning-text)]" },
  failed: { Icon: WarningCircleIcon, tone: "text-[var(--error-text)]" },
  skipped: { Icon: MinusCircleIcon, tone: "text-[var(--muted)]" },
  stopped: { Icon: MinusCircleIcon, tone: "text-[var(--muted)]" },
  // A platform step this build does not know: no state (backend ADR-0041).
  unknown: { Icon: CircleDashedIcon, tone: "text-[var(--muted)]" },
};

/**
 * One row of Steps: "3 · AI processing", its state's icon (24) and its state
 * in words — Waiting, Working… (its icon spinning), Done and when, Waiting for
 * approval and why, Denied, the run's failure, Skipped or Stopped; a setting
 * step's integration; step 5's Email sent and when, Sending email… or Done
 * (Build 23's A7, `lib/run-progress.ts`) — never a step's own summary
 * and never a step id (B6). A state this build does not know draws the
 * "unknown" look, with no line of its own. Under it, what the row offers,
 * when a page gives it. A run's details page and the timeline block
 * (`components/blocks`) draw it; it uses no hooks.
 */
export function TrackerItem({
  row,
  children,
}: {
  row: TrackerItemRow;
  children?: ReactNode;
}) {
  const state: TrackerState = Object.hasOwn(STATE_LOOK, row.state)
    ? row.state
    : "unknown";
  const { Icon, tone, motion } = STATE_LOOK[state];
  const quiet =
    state === "waiting" ||
    state === "skipped" ||
    state === "stopped" ||
    state === "unknown";
  return (
    <li
      data-testid={`run-step-${row.key}`}
      data-state={state}
      className="flex items-start gap-2"
    >
      <Icon
        size={24}
        aria-hidden
        className={`mt-0.5 shrink-0 ${tone}${motion ? ` ${motion}` : ""}`}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p
          className={`text-sm font-medium ${quiet ? "text-[var(--muted)]" : "text-[var(--text)]"}`}
        >
          {row.title}
        </p>
        {row.sub ? (
          <p
            className={`text-sm ${state === "waiting" || quiet ? "text-[var(--muted)]" : tone}`}
          >
            {row.sub}
          </p>
        ) : null}
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </li>
  );
}
