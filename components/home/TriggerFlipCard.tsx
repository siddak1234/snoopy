"use client";

import { useState } from "react";
import { TriggerIcon } from "@/components/icons/processIcons";
import ProcessStepFlipCard from "@/components/home/ProcessStepFlipCard";

function TriggerBackScene() {
  return (
    <>
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
    </>
  );
}

export default function TriggerFlipCard() {
  const [sceneRunId, setSceneRunId] = useState(0);

  return (
    <>
      <ProcessStepFlipCard
        stepNumber={1}
        title="Trigger"
        description="A message arrives, a file is received, or a scheduled event."
        icon={<TriggerIcon style={{ width: "3rem", height: "3rem" }} />}
        backTitle="Work Starts Anywhere"
        backContent={<TriggerBackScene />}
        backKey={sceneRunId}
        onFlipToBack={() => setSceneRunId((current) => current + 1)}
      />

      <style jsx>{`
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

        @media (prefers-reduced-motion: reduce) {
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
    </>
  );
}
