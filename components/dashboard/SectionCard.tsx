/**
 * Single main card for a dashboard section. Title row + body; use dividers between blocks.
 */
export default function SectionCard({
  title,
  primaryAction,
  children,
}: {
  title: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--ring)] bg-[var(--surface)]/95 shadow-xl backdrop-blur px-6 py-6 sm:px-8 sm:py-8 [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">{title}</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {title === "Dashboard"
              ? "Your automation workspace"
              : title === "Projects"
                ? "Manage your projects"
                : title === "Workflow Design"
                  ? "Design and manage workflows"
                  : title === "Billing"
                    ? "Billing and subscription"
                    : title === "Settings"
                      ? "Account and workspace settings"
                      : title === "Support"
                        ? "Help and support"
                        : ""}
          </p>
        </div>
        {primaryAction ? (
          <div className="shrink-0">{primaryAction}</div>
        ) : null}
      </div>
      <div className="mt-6 flex flex-col divide-y divide-[var(--ring)]">
        {children}
      </div>
    </div>
  );
}
