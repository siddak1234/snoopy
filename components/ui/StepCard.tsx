type StepCardProps = {
  step: string;
  title: string;
  description: string;
};

export function StepCard({ step, title, description }: StepCardProps) {
  return (
    <article className="bubble flex flex-col p-5 sm:p-6">
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] text-sm font-semibold text-[var(--step-pill-text)]"
        aria-hidden
      >
        {step}
      </span>
      <h3 className="mt-4 text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-[var(--muted)]">{description}</p>
    </article>
  );
}
