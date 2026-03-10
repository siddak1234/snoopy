function BlockIcon({ type }: { type: string }) {
  const shared = "h-4 w-4 text-[var(--icon-text)]";

  switch (type) {
    case "Trigger":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M9.5 1.5 4 9h4l-1.5 5.5L13 7H9z" />
        </svg>
      );
    case "AI Agent":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
        </svg>
      );
    case "Data Source":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <ellipse cx="8" cy="4" rx="5" ry="2" />
          <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" />
          <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" />
        </svg>
      );
    case "Condition":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M8 2v4M8 6l4 4M8 6l-4 4M4 10v4M12 10v4" />
        </svg>
      );
    case "Action":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M5 2.5v11l8-5.5z" />
        </svg>
      );
    default:
      return null;
  }
}

const blocks = [
  "Trigger",
  "AI Agent",
  "Data Source",
  "Condition",
  "Action",
];

export default function AutomationBuilderPage() {
  return (
    <>
      {/* Lock viewport — no scroll on this page */}
      <style>{`html,body{overflow:hidden!important}`}</style>

      {/* Workspace title — fixed to top-left, same row as navbar */}
      <div className="fixed left-4 top-4 z-50 inline-flex items-center rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] px-6 py-2.5 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          Builder
        </h1>
      </div>

      {/* Canvas — fills from below navbar to bottom of viewport */}
      <div
        className="relative -mt-8 flex overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)] shadow-[inset_0_0_60px_rgba(100,140,200,0.04)] sm:-mt-10"
        style={{
          width: "calc(100vw - 2rem)",
          height: "calc(100dvh - 6rem)",
          marginLeft: "calc(-50vw + 50% + 1rem)",
        }}
      >
          {/* Dot grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              opacity: 0.4,
            }}
          />

          {/* Glow ring */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[var(--accent)]/10" />

          {/* Docked block palette */}
          <aside className="relative z-10 flex w-44 shrink-0 flex-col border-r border-[var(--ring)]/50 bg-[var(--surface)]/60 px-2.5 py-3 backdrop-blur-sm">
            <h2 className="px-1 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Blocks
            </h2>
            <div className="mt-2 flex flex-col gap-1">
              {blocks.map((name) => (
                <div
                  key={name}
                  className="flex cursor-default items-center gap-2 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <BlockIcon type={name} />
                  </span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Workflow workspace */}
          <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <svg
                viewBox="0 0 48 48"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-9 w-9 text-[var(--accent)]/60"
                aria-hidden
              >
                <rect x="8" y="8" width="32" height="32" rx="8" />
                <path d="M24 18v12M18 24h12" />
              </svg>
              <p className="text-sm font-medium text-[var(--muted)]">
                Your workflow canvas
              </p>
              <p className="max-w-[14rem] text-[0.7rem] leading-relaxed text-[var(--muted)]/70">
                Drag blocks here to sketch your automation idea.
              </p>
            </div>
          </div>
        </div>
    </>
  );
}
