const FLOW_STEPS = [
  {
    title: "Email Received",
    detail: "New invoice reaches your shared inbox",
  },
  {
    title: "AI Extraction",
    detail: "Autom8x captures vendor, amount, and dates",
  },
  {
    title: "Classification",
    detail: "Rules and AI assign cost center and GL code",
  },
  {
    title: "System Update",
    detail: "Approved data syncs to your accounting stack",
  },
] as const;

export default function AutomationFlowDiagram() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
      {FLOW_STEPS.map((step, index) => (
        <div key={step.title} className="contents">
          <article className="flow-node rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Step {index + 1}
            </p>
            <h3 className="mt-1 text-base font-semibold text-[var(--text)]">
              {step.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {step.detail}
            </p>
          </article>

          {index < FLOW_STEPS.length - 1 ? (
            <div
              className="flow-line mx-auto hidden h-[2px] w-12 md:block"
              aria-hidden
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
