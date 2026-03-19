"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const FLOW_STEPS = [
  {
    title: "Email Received",
    detail: "New invoice reaches your shared inbox",
  },
  {
    title: "AI Extraction",
    detail: "Autom8x captures vendor, amount, and dates",
  },
  {
    title: "Classification",
    detail: "Rules and AI assign cost center and GL code",
  },
  {
    title: "System Update",
    detail: "Approved data syncs to your accounting stack",
  },
] as const;

export default function AutomationFlowDiagram() {
  const reduceMotion = useReducedMotion();
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(hover: none)");
    setIsCoarsePointer(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const shouldAnimate = !reduceMotion && !isCoarsePointer;

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:items-center">
      {FLOW_STEPS.map((step, index) => (
        <div key={step.title} className="contents">
          <article className="flow-node rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Step {index + 1}
            </p>
            <h3 className="mt-1 text-base font-semibold text-[var(--text)]">
              {step.title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              {step.detail}
            </p>
          </article>

          {index < FLOW_STEPS.length - 1 ? (
            <div className="relative mx-auto hidden h-[2px] w-12 md:block" aria-hidden>
              <div className="flow-line absolute inset-0" />
              {shouldAnimate ? (
                <>
                  {/* Soft traveling signal */}
                  <motion.span
                    className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--accent-strong)] shadow-[0_0_14px_rgba(95,158,255,0.65)]"
                    initial={{ x: "-15%" }}
                    animate={{ x: "115%" }}
                    transition={{
                      duration: 2.2,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      delay: index * 0.15,
                    }}
                  />
                  {/* Secondary faint pulse for depth */}
                  <motion.span
                    className="absolute top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]/70"
                    initial={{ x: "-10%", opacity: 0 }}
                    animate={{ x: "110%", opacity: [0, 1, 0] }}
                    transition={{
                      duration: 2.2,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 0.4,
                      delay: 0.25 + index * 0.15,
                    }}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
