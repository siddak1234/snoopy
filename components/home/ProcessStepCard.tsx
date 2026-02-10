import type { ReactNode } from "react";

type ProcessStepCardProps = {
  stepNumber: number;
  title: string;
  tagline: string;
  description: string;
  bullets?: string[];
  icon: ReactNode;
};

export default function ProcessStepCard({
  stepNumber,
  title,
  tagline,
  description,
  bullets,
  icon,
}: ProcessStepCardProps) {
  return (
    <article className={`bubble flex h-full flex-col p-5 sm:p-6 ${bullets && bullets.length > 0 ? "min-h-[24rem]" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-[var(--step-pill-border)] bg-[var(--step-pill-bg)] px-2 text-sm font-semibold text-[var(--step-pill-text)]">
            {stepNumber}
          </span>
          <h3 className="text-xl font-semibold text-[var(--text)]">{title}</h3>
        </div>
        {icon}
      </div>

      <p className="mt-2 text-sm font-medium text-[var(--tagline)]">{tagline}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>

      {bullets && bullets.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm text-[var(--muted)] sm:text-base">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--bullet)]" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
