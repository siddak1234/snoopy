"use client";

import { useRef, useState, useEffect } from "react";

type IndustrySignal = {
  quote: string;
  attribution: string;
  href: string;
};

const signals: IndustrySignal[] = [
  {
    quote:
      "“Capturing this may depend less on new technological breakthroughs than on how organizations redesign workflows”",
    attribution: "McKinsey — “Agents, robots, and us: Skill partnerships in the age of AI”",
    href: "https://www.mckinsey.com/mgi/our-research/agents-robots-and-us-skill-partnerships-in-the-age-of-ai",
  },
  {
    quote: "“embed AI into how people think, work, and lead.”",
    attribution: "BCG — “To Unlock the Full Value of AI, Invest in Your People”",
    href: "https://www.bcg.com/2025/to-unlock-the-full-value-of-ai-invest-in-your-people",
  },
  {
    quote:
      "“Generative AI (gen AI) is more than a new technology—it represents a fundamentally different way of working.”",
    attribution: "Accenture — “Reinventing Enterprise Models in the Age of Generative AI”",
    href: "https://www.accenture.com/us-en/insights/consulting/gen-ai-reinventing-enterprise-models",
  },
];

function SignalItem({ quote, attribution, href }: IndustrySignal) {
  return (
    <article className="w-[85vw] max-w-[85vw] shrink-0 py-1 text-[var(--text)] md:inline-flex md:w-fit md:max-w-[70ch]">
      <div className="inline-flex min-w-0 w-full flex-col gap-1 md:w-fit">
        <div className="inline-flex min-w-0 w-full items-baseline gap-3 md:w-fit md:max-w-[70ch]">
          <p className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-[15px] leading-5 tracking-[0.01em]">
            {quote}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 shrink-0 font-semibold text-[var(--link)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            aria-label={`Open source for ${attribution}`}
          >
            Source
          </a>
        </div>
        <p className="max-w-[70ch] truncate overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--muted)] opacity-70">
          {attribution}
        </p>
      </div>
    </article>
  );
}

function ItemSeparator() {
  return (
    <div aria-hidden className="mx-6 flex shrink-0 items-center justify-center md:mx-8">
      <div className="h-10 w-[2px] rounded-full bg-[var(--signal-divider)] opacity-40" />
    </div>
  );
}

export default function IndustrySignals() {
  const loopedSignals = [...signals, ...signals];

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
    <section aria-label="Industry signals from published research" className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">INDUSTRY SIGNALS</h2>

      <div className="group relative overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--surface)] px-3 py-3 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-within:-translate-y-1 focus-within:shadow-xl">
        <div
          className="relative flex items-center overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
          aria-label="Industry research excerpts"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
        >
          {/* Animated marquee when motion is allowed (all breakpoints) */}
          <ul
            className={`industry-signals-track hidden w-max items-center motion-safe:flex motion-safe:[animation:industry-signals-marquee_92s_linear_infinite] motion-safe:group-hover:[animation-play-state:paused] motion-safe:group-focus-within:[animation-play-state:paused]${
              isPaused ? " motion-safe:[animation-play-state:paused]" : ""
            }`}
          >
            {loopedSignals.map((signal, index) => (
              <li key={`${signal.attribution}-${index}`} className="flex items-center">
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
                <ItemSeparator />
              </li>
            ))}
          </ul>

          {/* Static list when user prefers reduced motion */}
          <ul className="hidden w-max items-center motion-reduce:flex">
            {signals.map((signal, index) => (
              <li key={`reduced-${signal.attribution}`} className="flex items-center">
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
                {index < signals.length - 1 ? <ItemSeparator /> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="px-1 text-xs text-[var(--muted)]">Quotes are excerpts from the linked sources.</p>

      <style jsx>{`
        @keyframes industry-signals-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </section>
  );
}
