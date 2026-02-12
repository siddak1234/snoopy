"use client";

import { useState } from "react";
import { TriggerIcon } from "@/components/icons/processIcons";

export default function TriggerFlipCard() {
  const [flipped, setFlipped] = useState(false);
  const [sceneRunId, setSceneRunId] = useState(0);

  const onToggleFlip = () => {
    setFlipped((previous) => {
      const next = !previous;
      if (next) {
        setSceneRunId((current) => current + 1);
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
        aria-label={flipped ? "Show trigger overview" : "Show trigger animation"}
      >
        <span className={`trigger-flip-inner ${flipped ? "is-flipped" : ""}`}>
          <span className="trigger-face trigger-front bubble">
            <span className="mb-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-3">
                <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full border border-[var(--step-pill-border)] bg-[var(--step-pill-bg)] px-3 text-base font-semibold text-[var(--step-pill-text)] sm:h-11 sm:min-w-11 sm:text-lg">
                  1
                </span>
                <span className="text-2xl font-semibold text-[var(--text)] sm:text-3xl">Trigger</span>
              </span>
              <TriggerIcon style={{ width: "3rem", height: "3rem" }} />
            </span>

            <span className="mt-3 text-base leading-7 text-[var(--muted)] sm:text-lg">
              A message arrives, a file is received, or a scheduled event.
            </span>
          </span>

          <span className="trigger-face trigger-back bubble">
            <span className="trigger-back-title">Work Starts Anywhere</span>

            <span className="trigger-scene" key={sceneRunId}>
              <span className="scene-envelope">
                <span className="scene-flap" />
                <span className="scene-fold-left" />
                <span className="scene-fold-right" />
              </span>

              <span className="scene-mailbox">
                <span className="scene-mailbox-post" />
                <span className="scene-mailbox-body" />
                <span className="scene-mailbox-slot" />
                <span className="scene-mailbox-mouth" />
                <span className="scene-mailbox-door" />
                <span className="scene-mailbox-flag" />
              </span>
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

        .scene-envelope {
          position: absolute;
          left: 1rem;
          top: 60%;
          width: 3.9rem;
          height: 2.55rem;
          border: 1.5px solid color-mix(in srgb, var(--icon-text) 70%, white 10%);
          border-radius: 0.32rem;
          background: linear-gradient(180deg, color-mix(in srgb, #ffffff 95%, var(--surface) 5%) 0%, color-mix(in srgb, var(--surface) 72%, #ffffff 28%) 100%);
          transform: translateY(-50%) rotate(-3deg);
          animation: envelope-travel 1900ms linear forwards;
          box-shadow: 0 6px 12px rgba(20, 40, 70, 0.1);
          overflow: hidden;
          z-index: 5;
        }

        .scene-flap {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 58%;
          clip-path: polygon(0 0, 50% 100%, 100% 0);
          background: color-mix(in srgb, #ffffff 82%, var(--surface-strong) 18%);
          border-bottom: 1.5px solid color-mix(in srgb, var(--icon-text) 48%, transparent);
          transform-origin: top center;
          animation: flap-close 1900ms linear forwards;
        }

        .scene-fold-left {
          position: absolute;
          position: absolute;
          left: 0.1rem;
          bottom: 0.14rem;
          width: 50%;
          height: 64%;
          border-right: 1.5px solid color-mix(in srgb, var(--icon-text) 52%, transparent);
          border-top: 1.5px solid color-mix(in srgb, var(--icon-text) 35%, transparent);
          clip-path: polygon(0 100%, 100% 0, 100% 100%);
          background: color-mix(in srgb, #ffffff 90%, var(--surface) 10%);
        }

        .scene-fold-right {
          position: absolute;
          right: 0.1rem;
          bottom: 0.14rem;
          width: 50%;
          height: 64%;
          border-left: 1.5px solid color-mix(in srgb, var(--icon-text) 52%, transparent);
          border-top: 1.5px solid color-mix(in srgb, var(--icon-text) 35%, transparent);
          clip-path: polygon(0 0, 100% 100%, 0 100%);
          background: color-mix(in srgb, #ffffff 90%, var(--surface) 10%);
        }

        .scene-mailbox {
          position: absolute;
          right: 0.85rem;
          bottom: 0.65rem;
          width: 6.7rem;
          height: 9.7rem;
        }

        .scene-mailbox-post {
          position: absolute;
          left: 2.9rem;
          bottom: 0;
          width: 0.8rem;
          height: 4.1rem;
          border-radius: 0.5rem;
          background: color-mix(in srgb, var(--muted) 50%, var(--surface-strong) 50%);
        }

        .scene-mailbox-body {
          position: absolute;
          left: 0;
          top: 1.45rem;
          width: 6.2rem;
          height: 3.95rem;
          border-radius: 1.35rem 1.35rem 0.65rem 0.65rem;
          border: 1.5px solid color-mix(in srgb, var(--icon-text) 68%, transparent);
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface-strong) 84%, white 16%) 0%, color-mix(in srgb, var(--surface) 95%, transparent) 100%);
          box-shadow: 0 8px 14px rgba(30, 54, 90, 0.16);
        }

        .scene-mailbox-slot {
          position: absolute;
          left: 1.2rem;
          top: 2.35rem;
          width: 4.2rem;
          height: 0.4rem;
          border-radius: 999px;
          background: color-mix(in srgb, #0f233f 65%, var(--surface-strong) 35%);
          z-index: 2;
        }

        .scene-mailbox-mouth {
          position: absolute;
          left: 0.12rem;
          top: 2.42rem;
          width: 0.62rem;
          height: 0.27rem;
          border-radius: 999px;
          background: color-mix(in srgb, #10253f 70%, var(--surface-strong) 30%);
          z-index: 2;
        }

        .scene-mailbox-door {
          position: absolute;
          left: 0.12rem;
          top: 2.1rem;
          width: 0.72rem;
          height: 0.92rem;
          border-radius: 0.24rem;
          border: 1.5px solid color-mix(in srgb, var(--icon-text) 65%, transparent);
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 88%, white 12%) 0%, color-mix(in srgb, var(--surface-strong) 92%, transparent) 100%);
          transform-origin: left center;
          transform: perspective(20rem) rotateY(-112deg);
          animation: door-close 1900ms ease forwards;
          z-index: 3;
        }

        .scene-mailbox-flag {
          position: absolute;
          right: -0.24rem;
          top: 1.78rem;
          width: 1.9rem;
          height: 0.36rem;
          border-radius: 999px;
          background: color-mix(in srgb, #ef4f4f 85%, white 15%);
          transform-origin: left center;
          transform: rotate(4deg);
          animation: flag-raise 1900ms ease forwards;
        }

        @keyframes flap-close {
          0% {
            transform: rotateX(0deg);
          }
          100% {
            transform: rotateX(0deg);
          }
        }

        @keyframes envelope-travel {
          0% {
            left: 1rem;
            transform: translateY(-50%) rotate(-3deg) scale(1);
            opacity: 1;
          }
          78% {
            left: calc(100% - 8.15rem);
            transform: translateY(-50%) rotate(1deg) scale(1);
            opacity: 1;
          }
          92% {
            left: calc(100% - 7.4rem);
            transform: translateY(-50%) rotate(2deg) scale(0.8);
            opacity: 0.8;
          }
          100% {
            left: calc(100% - 7.3rem);
            transform: translateY(-50%) rotate(2deg) scale(0.72);
            opacity: 0;
          }
        }

        @keyframes door-close {
          0%,
          74% {
            transform: perspective(20rem) rotateY(-112deg);
          }
          100% {
            transform: perspective(20rem) rotateY(0deg);
          }
        }

        @keyframes flag-raise {
          0%,
          76% {
            transform: rotate(4deg);
          }
          100% {
            transform: rotate(-68deg);
          }
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

          .scene-envelope,
          .scene-letter,
          .scene-flap,
          .scene-mailbox-door,
          .scene-mailbox-flag {
            animation: none;
          }

          .scene-envelope {
            opacity: 0;
            left: calc(100% - 7.3rem);
            transform: translateY(-50%) rotate(2deg) scale(0.72);
          }

          .scene-mailbox-door {
            transform: perspective(20rem) rotateY(0deg);
          }

          .scene-mailbox-flag {
            transform: rotate(-68deg);
          }
        }
      `}</style>
    </div>
  );
}
