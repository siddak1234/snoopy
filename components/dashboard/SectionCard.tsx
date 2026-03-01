/**
 * Single main card for a dashboard section. Title row + body; use dividers between blocks.
 */
export default function SectionCard({
  title,
  greeting,
  subheader,
  primaryAction,
  secondaryAction,
  children,
}: {
  title: string;
  /** Override title with personalized greeting (e.g. "Welcome, Siddak!") */
  greeting?: string;
  /** Override subheader text */
  subheader?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const defaultSubheader: Record<string, string> = {
    Dashboard: "Your automation workspace",
    Projects: "Manage your projects",
    "Workflow Design": "Design and manage workflows",
    Billing: "Billing and subscription",
    Settings: "Account and workspace settings",
    Support: "Help and support",
  };
  const subheaderText = subheader ?? defaultSubheader[title] ?? "";

  return (
    <div className="bubble px-6 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">
            {greeting ?? title}
          </h1>
          {subheaderText ? (
            <p className="mt-1 text-sm text-[var(--muted)]">{subheaderText}</p>
          ) : null}
        </div>
        {(primaryAction ?? secondaryAction) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col divide-y divide-[var(--ring)]">
        {children}
      </div>
    </div>
  );
}
