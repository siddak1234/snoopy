const blocks = [
  { name: "Trigger", icon: "⚡" },
  { name: "AI Agent", icon: "🧠" },
  { name: "Data Source", icon: "🗄" },
  { name: "Condition", icon: "🔀" },
  { name: "Action", icon: "▶" },
];

export default function AutomationBuilderPage() {
  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col gap-2">
      {/* Workspace title */}
      <div className="shrink-0 px-1">
        <h1 className="text-base font-semibold text-[var(--text)]">
          Automa8ion Builder
        </h1>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Sketch automation workflows visually using modular blocks.
        </p>
      </div>

      {/* Unified canvas */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)] shadow-[inset_0_0_60px_rgba(100,140,200,0.04)]">
        {/* Dot grid background — spans entire canvas */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.4,
          }}
        />

        {/* Canvas glow accent */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[var(--accent)]/10" />

        {/* Docked block palette */}
        <aside className="relative z-10 flex w-48 shrink-0 flex-col border-r border-[var(--ring)]/50 bg-[var(--surface)]/60 px-3 py-3 backdrop-blur-sm">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Blocks
          </h2>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {blocks.map((block) => (
              <div
                key={block.name}
                className="flex cursor-default items-center gap-2 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--icon-border)] bg-[var(--icon-bg)] text-[0.7rem] leading-none">
                  {block.icon}
                </span>
                <span>{block.name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Workflow workspace */}
        <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-10 w-10 text-[var(--accent)]"
              aria-hidden
            >
              <rect x="6" y="6" width="36" height="36" rx="8" />
              <path d="M24 16v16M16 24h16" />
            </svg>
            <p className="text-base font-semibold text-[var(--text)]">
              Your workflow canvas
            </p>
            <p className="max-w-xs text-xs text-[var(--muted)]">
              Drag blocks here to sketch your automation idea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
