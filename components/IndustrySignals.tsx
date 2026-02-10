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
    attribution: "Accenture — “Gen AI: Reinventing enterprise models”",
    href: "https://www.accenture.com/us-en/insights/consulting/gen-ai-reinventing-enterprise-models",
  },
];

function SignalItem({ quote, attribution, href }: IndustrySignal) {
  return (
    <article className="flex max-w-[34rem] shrink-0 items-center gap-3 rounded-xl border border-[#cddded] bg-[#eef5fc] px-3 py-2 text-sm text-[#1f3a57] shadow-[0_2px_12px_rgba(29,67,107,0.08)]">
      <p className="line-clamp-2 leading-5">{quote}</p>
      <div className="shrink-0 text-right">
        <p className="max-w-[15rem] truncate text-[11px] font-medium uppercase tracking-wide text-[#31557b]">{attribution}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-0.5 inline-block text-xs font-semibold text-[#204f86] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70a2da] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef5fc]"
          aria-label={`Open source for ${attribution}`}
        >
          Source
        </a>
      </div>
    </article>
  );
}

export default function IndustrySignals() {
  const loopedSignals = [...signals, ...signals];

  return (
    <section aria-label="Industry signals from published research" className="space-y-2">
      <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#365b82]">INDUSTRY SIGNALS</h2>

      <div className="hidden md:block">
        <div className="relative overflow-hidden rounded-2xl border border-[#d5e2f0] bg-[#f3f8fd] p-2 shadow-[0_4px_18px_rgba(37,73,112,0.08)]">
          <ul
            aria-label="Industry research excerpts"
            className="hidden w-max items-center gap-3 signal-marquee motion-safe:flex motion-safe:[animation:industry-signals-marquee_52s_linear_infinite] motion-safe:hover:[animation-play-state:paused] motion-safe:focus-within:[animation-play-state:paused]"
          >
            {loopedSignals.map((signal, index) => (
              <li key={`${signal.attribution}-${index}`}>
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
              </li>
            ))}
          </ul>

          <ul
            aria-label="Industry research excerpts"
            className="hidden items-center gap-3 overflow-x-auto py-0.5 motion-reduce:flex [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {signals.map((signal) => (
              <li key={`reduced-${signal.attribution}`}>
                <SignalItem quote={signal.quote} attribution={signal.attribution} href={signal.href} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div
        className="md:hidden overflow-x-auto rounded-2xl border border-[#d5e2f0] bg-[#f3f8fd] px-2 py-2 shadow-[0_4px_16px_rgba(37,73,112,0.08)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Swipeable industry signals feed"
      >
        <ul className="flex snap-x snap-mandatory gap-3">
          {signals.map((signal) => (
            <li key={`mobile-${signal.attribution}`} className="snap-center">
              <article className="flex w-[86vw] max-w-[22rem] shrink-0 flex-col gap-2 rounded-xl border border-[#cddded] bg-[#eef5fc] p-3 text-[#1f3a57]">
                <p className="text-[14px] leading-5">{signal.quote}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#31557b]">{signal.attribution}</p>
                <a
                  href={signal.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-fit text-xs font-semibold text-[#204f86] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#70a2da] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eef5fc]"
                  aria-label={`Open source for ${signal.attribution}`}
                >
                  Source
                </a>
              </article>
            </li>
          ))}
        </ul>
      </div>

      <p className="px-1 text-xs text-[#47678a]">Quotes are excerpts from the linked sources.</p>

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
