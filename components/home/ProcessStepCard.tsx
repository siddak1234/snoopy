import type { ReactNode } from "react";

type ProcessStepCardProps = {
  stepNumber: number;
  title: string;
  tagline: string;
  description: string;
  bullets?: string[];
  visualTiles?: ReactNode[];
  icon: ReactNode;
};

export default function ProcessStepCard({
  stepNumber,
  title,
  tagline,
  description,
  bullets,
  visualTiles,
  icon,
}: ProcessStepCardProps) {
  return (
    <article className="bubble flex h-full min-h-[24rem] flex-col p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-[var(--step-pill-border)] bg-[var(--step-pill-bg)] px-2 text-xs font-semibold text-[var(--step-pill-text)]">
          {stepNumber}
        </span>
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 text-sm font-medium text-[var(--tagline)]">{tagline}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>

      {visualTiles && visualTiles.length > 0 ? (
        <div className="mt-4 grid w-full grid-cols-3 gap-3">
          {visualTiles.map((tile, index) => (
            <div
              key={`step-tile-${index + 1}`}
              className="bubble-soft flex min-h-16 items-center justify-center rounded-2xl p-3"
            >
              {tile}
            </div>
          ))}
        </div>
      ) : null}

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
