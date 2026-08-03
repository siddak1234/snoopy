"use client";

import { useRef, useState } from "react";
import {
  m,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";

export type StoryPhase = {
  kicker: string;
  title: string;
  sub: string;
  /** Placeholder description until photography is chosen; becomes alt text. */
  imageAlt: string;
  /** The one-line swap: set to a photo path when imagery is ready. */
  imageSrc?: string;
};

/**
 * The design's 260vh scroll story: a sticky full-viewport stage where three
 * full-bleed scenes crossfade as the visitor scrolls, with a giant phase
 * number, crossfading copy and progress dashes. Driven by framer-motion
 * MotionValues (no re-render per frame); the DCLogic handler in the design
 * is the behavior spec — phases switch at thirds of the scroll distance.
 *
 * Under reduced motion the three phases render as static stacked sections.
 */

/**
 * Sample the design's layer formulas (opacity = 1.4 − 1.6·|3p − i − 0.5|,
 * scale = 1.06 − 0.06·max(0, 1 − |3p − i − 0.5|)) at monotonic points
 * clamped to [0, 1] — WAAPI rejects keyframe offsets outside that range.
 */
function layerSamples(index: number) {
  const center = (index + 0.5) / 3;
  const start = Math.max(0, center - 0.292);
  const end = Math.min(1, center + 0.292);
  const points = [
    start,
    (start + center) / 2,
    center,
    (center + end) / 2,
    end,
  ];
  const distance = (p: number) => Math.abs(3 * p - index - 0.5);
  return {
    points,
    opacity: points.map((p) =>
      Math.min(1, Math.max(0, 1.4 - 1.6 * distance(p))),
    ),
    scale: points.map(
      (p) => 1.06 - Math.min(1, Math.max(0, 1 - distance(p))) * 0.06,
    ),
  };
}

function StoryLayer({
  index,
  progress,
  phase,
}: {
  index: number;
  progress: MotionValue<number>;
  phase: StoryPhase;
}) {
  const samples = layerSamples(index);
  const opacity = useTransform(progress, samples.points, samples.opacity);
  const scale = useTransform(progress, samples.points, samples.scale);

  return (
    <m.div
      style={{ opacity, scale }}
      className="lighten absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0">
        <ImagePlaceholder
          fill
          alt={phase.imageAlt}
          src={phase.imageSrc}
          rounded={false}
        />
      </div>
    </m.div>
  );
}

export function ScrollStory({ phases }: { phases: readonly StoryPhase[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const [phaseIndex, setPhaseIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const next = Math.min(phases.length - 1, Math.floor(value * phases.length));
    setPhaseIndex((prev) => (prev === next ? prev : next));
  });

  const active = phases[phaseIndex];

  if (reduceMotion) {
    return (
      <section aria-label="How work changes with Autom8x">
        {phases.map((phase, index) => (
          <div key={phase.title} className="relative overflow-hidden py-20">
            <div className="lighten absolute inset-0 opacity-40">
              <ImagePlaceholder
                fill
                alt={phase.imageAlt}
                src={phase.imageSrc}
                rounded={false}
              />
            </div>
            <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
              <p className="m-0 mb-4 text-[13px] tracking-[0.2em] text-[var(--color-accent)] uppercase">
                {phase.kicker}
              </p>
              <h2 className="m-0 max-w-[15ch] text-[clamp(32px,5vw,64px)] leading-[1.08] font-medium tracking-[-0.018em]">
                {phase.title}
              </h2>
              <p className="mt-5 max-w-[52ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
                {phase.sub}
              </p>
              <p
                aria-hidden
                className="mt-6 text-5xl font-[var(--font-heading)] text-[color-mix(in_srgb,var(--color-accent-700)_42%,transparent)] [font-feature-settings:'tnum'_1]"
              >
                {String(index + 1).padStart(2, "0")}
              </p>
            </div>
          </div>
        ))}
      </section>
    );
  }

  return (
    <section
      ref={ref}
      className="relative h-[260vh]"
      aria-label="Scroll story: repetitive work becomes automated work"
    >
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Dot grid + accent wash behind the scenes. */}
        <div
          aria-hidden
          className="absolute inset-0 [background-image:radial-gradient(circle,var(--art-grid-dot)_1.2px,transparent_1.6px)] [background-size:30px_30px]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(900px_560px_at_78%_8%,color-mix(in_srgb,var(--color-accent-900)_70%,transparent),transparent_62%)]"
        />

        {/* Giant phase number. */}
        <div
          aria-hidden
          className="absolute top-[14vh] right-[clamp(16px,4vw,64px)] text-[clamp(120px,18vw,260px)] leading-none font-[var(--font-heading)] font-medium text-[color-mix(in_srgb,var(--color-accent-700)_42%,transparent)] [font-feature-settings:'tnum'_1]"
        >
          {String(phaseIndex + 1).padStart(2, "0")}
        </div>

        {/* Crossfading full-bleed scenes. */}
        {phases.map((phase, index) => (
          <StoryLayer
            key={phase.title}
            index={index}
            progress={scrollYProgress}
            phase={phase}
          />
        ))}

        {/* Scrims for copy legibility. */}
        <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-bg)_42%,transparent)] backdrop-blur-[1.5px]" />
        <div className="absolute inset-0 bg-[radial-gradient(1000px_600px_at_50%_110%,color-mix(in_srgb,black_55%,transparent),transparent_70%),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-bg)_65%,transparent),transparent_35%,transparent_60%,color-mix(in_srgb,var(--color-bg)_88%,transparent))]" />

        {/* Copy. */}
        <div className="absolute inset-0 flex items-end px-[clamp(20px,5vw,72px)] pb-[14vh]">
          <div className="mx-auto w-full max-w-6xl">
            <m.div
              key={phaseIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <p className="m-0 mb-4 text-[13px] tracking-[0.2em] text-[var(--color-accent)] uppercase">
                {active.kicker}
              </p>
              <h2 className="m-0 max-w-[15ch] text-[clamp(40px,5.6vw,80px)] leading-[1.08] font-medium tracking-[-0.018em]">
                {active.title}
              </h2>
              <p className="mt-5 max-w-[52ch] text-base leading-7 text-[color-mix(in_srgb,var(--color-text)_75%,transparent)]">
                {active.sub}
              </p>
            </m.div>
          </div>
        </div>

        {/* Progress dashes. */}
        <div
          aria-hidden
          className="absolute bottom-[6vh] left-[clamp(20px,5vw,72px)] flex gap-2"
        >
          {phases.map((phase, index) => (
            <span
              key={phase.title}
              className={`h-0.5 w-[26px] transition-colors ${
                index === phaseIndex
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-neutral-700)]"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
