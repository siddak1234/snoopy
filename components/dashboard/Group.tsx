import type { ReactNode } from "react";
import { GROUP_BAND, SPACING } from "@/lib/spacing";
import { SectionTitle } from "./SectionTitle";

/**
 * A group of a page card: one band between its dividers (`GROUP_BAND`:
 * `group` above and below, none above the first), its title
 * (`SectionTitle`), an action beside it, and what it heads `title` under it
 * (F3; `lib/spacing.ts`). Settings, a flow's page, an item's and a run's
 * draw their parts in it, so each sits the same distance from its title.
 */
export function Group({
  title,
  titleId,
  titleTabIndex,
  label,
  action,
  children,
  testId,
  className = "",
}: {
  title?: ReactNode;
  titleId?: string;
  /** -1: a title the page moves focus to. */
  titleTabIndex?: number;
  /** The band's name for a screen reader, when it has no title. */
  label?: string;
  /** Beside the title, at its end: Upload, a filter. */
  action?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  const heading =
    title === undefined ? null : action ? (
      <div className={`flex items-center justify-between ${SPACING.inner.gap}`}>
        <SectionTitle id={titleId} tabIndex={titleTabIndex}>
          {title}
        </SectionTitle>
        {action}
      </div>
    ) : (
      <SectionTitle id={titleId} tabIndex={titleTabIndex}>
        {title}
      </SectionTitle>
    );
  return (
    <section
      aria-labelledby={title === undefined ? undefined : titleId}
      aria-label={label}
      data-testid={testId}
      className={`${GROUP_BAND} ${className}`.trim()}
    >
      {heading}
      {heading ? <div className={SPACING.title.top}>{children}</div> : children}
    </section>
  );
}
