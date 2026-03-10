const blocks = [
  { name: "Trigger", icon: "⚡" },
  { name: "AI Agent", icon: "🧠" },
  { name: "Data Source", icon: "🗄" },
  { name: "Condition", icon: "🔀" },
  { name: "Action", icon: "▶" },
];

export default function AutomationBuilderPage() {
  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
      {/* Header card */}
      <section className="bubble shrink-0 px-6 py-5 sm:px-8 sm:py-6">
        <h1 className="text-2xl font-semibold sm:text-3xl">Autom8 Builder</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base sm:leading-7">
          Design automation workflows using modular building blocks. Sketch out
          operational ideas visually and share them with the Autom8x team for
          implementation.
        </p>
      </section>

      {/* Builder area */}
      <div className="flex min-h-0 flex-1 gap-4">
        {/* Left sidebar — block palette */}
        <aside className="bubble flex w-[260px] shrink-0 flex-col overflow-y-auto px-5 py-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Blocks
          </h2>
          <div className="mt-4 flex flex-col gap-2.5">
            {blocks.map((block) => (
              <div
                key={block.name}
                className="flex cursor-default items-center gap-3 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-3 text-sm font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--icon-border)] bg-[var(--icon-bg)] text-base leading-none">
                  {block.icon}
                </span>
                <span>{block.name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Workflow canvas */}
        <div className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[2rem] border border-[var(--ring)] bg-[var(--card)] shadow-[inset_0_0_40px_rgba(100,140,200,0.04)]">
          {/* Subtle dot grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              opacity: 0.45,
            }}
          />

          {/* Canvas glow accent on border */}
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-[var(--accent)]/10" />

          {/* Placeholder content */}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center">
            <svg
              viewBox="0 0 48 48"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-[var(--accent)]"
              aria-hidden
            >
              <rect x="6" y="6" width="36" height="36" rx="8" />
              <path d="M24 16v16M16 24h16" />
            </svg>
            <p className="text-lg font-semibold text-[var(--text)]">
              Your workflow canvas
            </p>
            <p className="max-w-xs text-sm text-[var(--muted)]">
              Drag blocks here to sketch your automation idea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
