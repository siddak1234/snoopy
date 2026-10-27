import { PAGE_CARD, SPACING } from "@/lib/spacing";

/**
 * Single main card for a dashboard section. Title row + body; use dividers
 * between blocks. Spaced by the table (`lib/spacing.ts`): `card` inside it,
 * `cardWide` on a wide screen; the title's line `title` above the subheader;
 * `group` between the header and the body, whose bands (`Group`) are
 * `group` apart, none above the first.
 */
export default function SectionCard({
  title,
  greeting,
  subheader,
  primaryAction,
  secondaryAction,
  back,
  children,
}: {
  title: string;
  /** Override title with personalized greeting (e.g. "Welcome, Siddak!") */
  greeting?: string;
  /** Override subheader text */
  subheader?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** The way back, before the title (a flow's own pages: `BackLink`). */
  back?: React.ReactNode;
  children: React.ReactNode;
}) {
  const defaultSubheader: Record<string, string> = {
    Dashboard: "Your workspace",
    Departments: "Your departments",
    "Workflow Design": "Design and manage workflows",
    Billing: "Billing and subscription",
    Settings: "Account and workspace settings",
    Support: "Help and support",
  };
  const subheaderText = subheader ?? defaultSubheader[title] ?? "";

  return (
    <div className={`bubble ${PAGE_CARD}`}>
      <div
        className={`flex flex-col ${SPACING.group.gap} sm:flex-row sm:items-start sm:justify-between`}
      >
        <div
          className={
            back ? `flex min-w-0 items-start ${SPACING.inner.gap}` : undefined
          }
        >
          {back}
          <div className="min-w-0">
            <h1 className="text-2xl font-medium text-[var(--text)]">
              {greeting ?? title}
            </h1>
            {subheaderText ? (
              <p className={`${SPACING.title.top} text-sm text-[var(--muted)]`}>
                {subheaderText}
              </p>
            ) : null}
          </div>
        </div>
        {(primaryAction ?? secondaryAction) ? (
          <div
            className={`flex shrink-0 flex-wrap items-center ${SPACING.inner.gap}`}
          >
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
      <div
        className={`${SPACING.group.top} flex flex-col divide-y divide-[var(--ring)]`}
      >
        {children}
      </div>
    </div>
  );
}
