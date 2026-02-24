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
    <div className="trigger-flip-shell">
      <button
        type="button"
        className="trigger-flip-button"
        onClick={onToggleFlip}
        aria-pressed={flipped}
        aria-label={flipped ? `Show ${title} overview` : `Show ${title} details`}
      >
        <span className={`trigger-flip-inner ${flipped ? "is-flipped" : ""}`}>
          <span className="trigger-face trigger-front bubble">
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

          <span className="trigger-face trigger-back bubble">
            <span className="trigger-back-title">{backTitle}</span>
            <span className="trigger-scene" key={backKey}>
              {backContent}
            </span>
          </span>
        </span>
      </button>

      <style jsx>{`
        .trigger-flip-shell {
          perspective: 1500px;
        }

        .trigger-flip-button {
          width: 100%;
          display: block;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .trigger-flip-button:focus-visible {
          outline: 2px solid var(--accent-strong);
          outline-offset: 5px;
          border-radius: 2rem;
        }

        .trigger-flip-inner {
          position: relative;
          display: block;
          min-height: clamp(15rem, 48vw, 17.4rem);
          transform-style: preserve-3d;
          transition: transform 760ms cubic-bezier(0.2, 0.68, 0.1, 1);
        }

        .trigger-flip-inner.is-flipped {
          transform: rotateX(180deg);
        }

        .trigger-face {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }

        .trigger-front {
          z-index: 2;
        }

        .trigger-back {
          transform: rotateX(180deg);
        }

        .trigger-back-title {
          font-size: clamp(1.15rem, 2.6vw, 1.6rem);
          line-height: 1.15;
          font-weight: 700;
          letter-spacing: 0.01em;
          text-transform: uppercase;
          color: var(--text);
          width: fit-content;
          border-bottom: 2px solid color-mix(in srgb, var(--accent-strong) 56%, transparent);
          padding-bottom: 0.3rem;
        }

        .trigger-scene {
          position: relative;
          margin-top: 1.15rem;
          flex: 1 1 auto;
          border-radius: 1.25rem;
          border: 1px solid color-mix(in srgb, var(--ring) 88%, transparent);
          background: linear-gradient(
            145deg,
            color-mix(in srgb, var(--surface) 92%, white 8%) 0%,
            color-mix(in srgb, var(--surface-strong) 90%, transparent) 100%
          );
          overflow: hidden;
          min-height: 10.6rem;
        }

        @media (min-width: 640px) {
          .trigger-face {
            padding: 1.5rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .trigger-flip-inner {
            transition-duration: 0.01ms;
          }
        }
      `}</style>
    </div>
  );
}
