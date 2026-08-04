"use client";

import { useEffect, useRef, useState } from "react";

export type MarqueeItem = {
  quote: string;
  attribution: string;
  href: string;
};

function MarqueeEntry({ quote, attribution, href }: MarqueeItem) {
  return (
    <div className="flex flex-none items-baseline gap-3 pl-11">
      <span className="text-sm whitespace-nowrap text-[var(--color-neutral-200)]">
        {quote}
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs whitespace-nowrap text-[var(--color-accent-300)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
        aria-label={`Open source: ${attribution}`}
      >
        {attribution} ↗
      </a>
      <span
        aria-hidden
        className="ml-8 inline-block h-px w-11 -translate-y-1 bg-[var(--color-accent)]"
      />
    </div>
  );
}

/**
 * The design's industry-signals ticker: quotes drifting through an
 * edge-faded band between hairline rules. Keeps the pre-revamp marquee's
 * accessibility: pauses on hover/focus/press, and renders a static list
 * under prefers-reduced-motion.
 */
export function Marquee({ items }: { items: readonly MarqueeItem[] }) {
  const looped = [...items, ...items];
  const [isPaused, setIsPaused] = useState(false);
  const resumeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current !== null) {
        window.clearTimeout(resumeTimeoutRef.current);
      }
    };
  }, []);

  const handlePointerDown = () => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setIsPaused(true);
  };

  const handlePointerEnd = () => {
    if (!isPaused) return;
    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimeoutRef.current = null;
    }, 700);
  };

  return (
    <section
      aria-label="Industry signals from published research"
      className="group overflow-hidden border-y border-[var(--color-divider)] py-4"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      {/* Animated track (duplicated list; -50% translate loops seamlessly). */}
      <div
        className={`edge-fade-mask hidden w-max items-center motion-safe:flex motion-safe:[animation:marquee-scroll_66s_linear_infinite] motion-safe:group-focus-within:[animation-play-state:paused] motion-safe:group-hover:[animation-play-state:paused] ${
          isPaused ? "motion-safe:[animation-play-state:paused]" : ""
        }`}
      >
        {looped.map((item, index) => (
          <MarqueeEntry key={`${item.attribution}-${index}`} {...item} />
        ))}
      </div>

      {/* Static fallback under reduced motion. */}
      <div className="mx-auto hidden max-w-6xl flex-col gap-2 px-4 motion-reduce:flex sm:px-6 lg:px-8">
        {items.map((item) => (
          <p
            key={item.attribution}
            className="m-0 text-sm text-[var(--color-neutral-200)]"
          >
            {item.quote}{" "}
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--color-accent-300)]"
            >
              {item.attribution} ↗
            </a>
          </p>
        ))}
      </div>
    </section>
  );
}
