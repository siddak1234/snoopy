"use client";

import { useRef, useState, useEffect, useCallback, Fragment } from "react";

type IndustrySignal = {
  quote: string;
  attribution: string;
  href: string;
};

const signals: IndustrySignal[] = [
  {
    quote:
      "\"Capturing this may depend less on new technological breakthroughs than on how organizations redesign workflows\"",
    attribution: "McKinsey — \"Agents, robots, and us: Skill partnerships in the age of AI\"",
    href: "https://www.mckinsey.com/mgi/our-research/agents-robots-and-us-skill-partnerships-in-the-age-of-ai",
  },
  {
    quote: "\"embed AI into how people think, work, and lead.\"",
    attribution: "BCG — \"To Unlock the Full Value of AI, Invest in Your People\"",
    href: "https://www.bcg.com/2025/to-unlock-the-full-value-of-ai-invest-in-your-people",
  },
  {
    quote:
      "\"Generative AI (gen AI) is more than a new technology—it represents a fundamentally different way of working.\"",
    attribution: "Accenture — \"Reinventing Enterprise Models in the Age of Generative AI\"",
    href: "https://www.accenture.com/us-en/insights/consulting/gen-ai-reinventing-enterprise-models",
  },
];

const AUTO_SCROLL_SPEED = 0.4;
const RESUME_DELAY_MS = 700;

function SignalItem({ quote, attribution, href }: IndustrySignal) {
  return (
    <article className="w-auto shrink-0 py-1 text-[var(--text)] min-w-0 max-w-[85vw] md:max-w-[70ch]">
      <div className="inline-flex flex-col gap-1">
        <div className="inline-flex items-baseline gap-3 min-w-0">
          <p className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-[15px] leading-5 tracking-[0.01em]">
            {quote}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-semibold text-[var(--link)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
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
    <div aria-hidden className="flex shrink-0 items-center justify-center">
      <div className="h-10 w-[2px] rounded-full bg-[var(--signal-divider)] opacity-40" />
    </div>
  );
}

function CopyContent({ signals: list }: { signals: IndustrySignal[] }) {
  return (
    <>
      {list.map((signal, index) => (
        <Fragment key={`${signal.attribution}-${index}`}>
          <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
          <ItemSeparator />
        </Fragment>
      ))}
    </>
  );
}

export default function IndustrySignals() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const copyWidthRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const resumeTimeoutRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Measure first copy width and set initial scroll
  useEffect(() => {
    const scrollEl = scrollRef.current;
    const copyEl = copyRef.current;
    if (!scrollEl || !copyEl) return;

    const measureAndInit = () => {
      const w = copyEl.offsetWidth;
      if (w > 0) {
        copyWidthRef.current = w;
        scrollEl.scrollLeft = w;
      }
    };

    measureAndInit();
    const ro = new ResizeObserver(measureAndInit);
    ro.observe(copyEl);
    return () => ro.disconnect();
  }, []);

  // prefers-reduced-motion
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const set = () => setPrefersReducedMotion(mq.matches);
    set();
    mq.addEventListener("change", set);
    return () => mq.removeEventListener("change", set);
  }, []);

  const applyWrap = useCallback(() => {
    const el = scrollRef.current;
    const copyWidth = copyWidthRef.current;
    if (!el || copyWidth <= 0) return;

    if (el.scrollLeft >= copyWidth * 2) {
      el.scrollLeft -= copyWidth;
    }
    if (el.scrollLeft <= 0) {
      el.scrollLeft += copyWidth;
    }
  }, []);

  const runAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    const copyWidth = copyWidthRef.current;
    if (!el || copyWidth <= 0 || isPaused || prefersReducedMotion) {
      rafIdRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }
    el.scrollLeft += AUTO_SCROLL_SPEED;
    applyWrap();
    rafIdRef.current = requestAnimationFrame(runAutoScroll);
  }, [isPaused, prefersReducedMotion, applyWrap]);

  useEffect(() => {
    rafIdRef.current = requestAnimationFrame(runAutoScroll);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [runAutoScroll]);

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current !== null) window.clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (resumeTimeoutRef.current !== null) {
      window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = null;
    }
    setIsPaused(true);
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = scrollRef.current?.scrollLeft ?? 0;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !scrollRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    const el = scrollRef.current;
    el.scrollLeft = startScrollLeftRef.current - deltaX;
    applyWrap();
    startScrollLeftRef.current = el.scrollLeft;
    startXRef.current = e.clientX;
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    isDraggingRef.current = false;
    if (!isPaused) return;
    resumeTimeoutRef.current = window.setTimeout(() => {
      setIsPaused(false);
      resumeTimeoutRef.current = null;
    }, RESUME_DELAY_MS);
  };

  const handleScroll = () => {
    applyWrap();
  };

  return (
    <section aria-label="Industry signals from published research" className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">INDUSTRY SIGNALS</h2>

      <div className="group relative overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--surface)] px-3 py-3 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-within:-translate-y-1 focus-within:shadow-xl">
        <div
          ref={scrollRef}
          className="relative flex items-center overflow-x-auto overflow-y-hidden py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          aria-label="Industry research excerpts"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerLeave={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onScroll={handleScroll}
        >
          <div className="inline-flex w-max items-center gap-x-6 shrink-0">
            <div ref={copyRef} className="inline-flex w-max items-center gap-x-6 shrink-0">
              <CopyContent signals={signals} />
            </div>
            <div className="inline-flex w-max items-center gap-x-6 shrink-0" aria-hidden="true">
              <CopyContent signals={signals} />
            </div>
          </div>
        </div>
      </div>

      <p className="px-1 text-xs text-[var(--muted)]">Quotes are excerpts from the linked sources.</p>
    </section>
  );
}
