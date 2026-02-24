"use client";

import type { ReactNode } from "react";
import { useState } from "react";

type ProcessStepFlipCardProps = {
  stepNumber: number;
  title: string;
  description: string;
  icon: ReactNode;
  backTitle: string;
  backContent: ReactNode;
  backKey?: string | number;
  onFlipToBack?: () => void;
};

export default function ProcessStepFlipCard({
  stepNumber,
  title,
  description,
  icon,
  backTitle,
  backContent,
  backKey,
  onFlipToBack,
}: ProcessStepFlipCardProps) {
  const [flipped, setFlipped] = useState(false);

  const onToggleFlip = () => {
    setFlipped((previous) => {
      const next = !previous;
      if (next) {
        onFlipToBack?.();
      }
      return next;
    });
  };

  return (
    <div className="process-step-flip-shell">
      <button
        type="button"
        className="process-step-flip-button"
        onClick={onToggleFlip}
        aria-pressed={flipped}
        aria-label={flipped ? `Show ${title} overview` : `Show ${title} details`}
      >
        <span className={`process-step-flip-inner ${flipped ? "is-flipped" : ""}`}>
          <span className="process-step-flip-face process-step-flip-face-front bubble">
            <span className="mb-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[var(--step-pill-border)] bg-[var(--step-pill-bg)] px-3 text-base font-semibold text-[var(--step-pill-text)] sm:h-11 sm:min-w-11 sm:text-lg">
                  {stepNumber}
                </span>
                <span className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">{title}</span>
              </span>
              {icon}
            </span>

            <span className="mt-3 text-base leading-7 text-[var(--muted)] sm:text-lg">{description}</span>
          </span>

          <span className="process-step-flip-face process-step-flip-face-back bubble">
            <span className="process-step-flip-back-title">{backTitle}</span>
            <span className="process-step-flip-scene" key={backKey}>
              {backContent}
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}
