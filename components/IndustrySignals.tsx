"use client";

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
    <article className="w-[85vw] max-w-[90vw] shrink-0 py-1 text-[var(--text)] md:w-[74vw] md:min-w-[70vw] md:max-w-[80vw]">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate overflow-hidden text-ellipsis whitespace-nowrap text-[15px] leading-5 tracking-[0.01em]">{quote}</p>
        <div className="flex min-w-0 items-center gap-2 text-[11px]">
          <p className="min-w-0 flex-1 truncate overflow-hidden text-ellipsis whitespace-nowrap text-[var(--muted)] opacity-70">
            {attribution}
          </p>
          <span aria-hidden className="text-[var(--muted)] opacity-70">•</span>
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
      </div>
    </article>
  );
}

function ItemSeparator() {
  return (
    <div aria-hidden className="mx-6 flex shrink-0 items-center justify-center md:mx-8">
      <div className="h-10 w-0.5 rounded-full bg-[#3f7fd3] opacity-40" />
    </div>
  );
}

export default function IndustrySignals() {
  const loopedSignals = [...signals, ...signals];

  return (
    <section aria-label="Industry signals from published research" className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">INDUSTRY SIGNALS</h2>

      <div className="hidden md:block">
        <div className="group relative overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--surface)] px-3 py-3 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-within:-translate-y-1 focus-within:shadow-xl">
          <ul
            aria-label="Industry research excerpts"
            className="hidden w-max items-center motion-safe:flex motion-safe:[animation:industry-signals-marquee_92s_linear_infinite] motion-safe:group-hover:[animation-play-state:paused] motion-safe:group-focus-within:[animation-play-state:paused]"
          >
            {loopedSignals.map((signal, index) => (
              <li key={`${signal.attribution}-${index}`} className="flex items-center">
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
                <ItemSeparator />
              </li>
            ))}
          </ul>

          <ul
            aria-label="Industry research excerpts"
            className="hidden items-center overflow-x-auto py-1 motion-reduce:flex [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {signals.map((signal, index) => (
              <li key={`reduced-${signal.attribution}`} className="flex items-center">
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
                {index < signals.length - 1 ? <ItemSeparator /> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="md:hidden overflow-x-auto rounded-2xl border border-[var(--ring)] bg-[var(--surface)] px-2 py-3 transition duration-200 hover:-translate-y-1 hover:shadow-xl focus-within:-translate-y-1 focus-within:shadow-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Swipeable industry signals feed"
      >
        <ul className="flex snap-x snap-mandatory gap-3">
          {signals.map((signal) => (
            <li key={`mobile-${signal.attribution}`} className="snap-center min-w-[85vw] shrink-0">
              <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
            </li>
          ))}
        </ul>
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
