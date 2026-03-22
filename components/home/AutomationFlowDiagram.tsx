"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

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

const MOBILE_BREAKPOINT = 768;
const LAYOUT_EPSILON = 0.5;

type CardBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutMetrics = {
  width: number;
  height: number;
  isDesktop: boolean;
  cards: CardBox[];
};

type CardVisualState = {
  tx: number;
  ty: number;
  scale: number;
  opacity: number;
  zIndex: number;
  cx: number;
  cy: number;
  width: number;
  height: number;
};

type ConnectorPath = {
  d: string;
  opacity: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function almostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) <= LAYOUT_EPSILON;
}

function sameLayout(a: LayoutMetrics | null, b: LayoutMetrics): boolean {
  if (!a) return false;
  if (!almostEqual(a.width, b.width) || !almostEqual(a.height, b.height)) return false;
  if (a.isDesktop !== b.isDesktop) return false;
  if (a.cards.length !== b.cards.length) return false;
  for (let i = 0; i < a.cards.length; i += 1) {
    const x = a.cards[i];
    const y = b.cards[i];
    if (
      !almostEqual(x.x, y.x) ||
      !almostEqual(x.y, y.y) ||
      !almostEqual(x.width, y.width) ||
      !almostEqual(x.height, y.height)
    ) {
      return false;
    }
  }
  return true;
}

export default function AutomationFlowDiagram() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [layout, setLayout] = useState<LayoutMetrics | null>(null);
  const [sectionProgress, setSectionProgress] = useState(0.5);

  const measureLayout = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const cards: CardBox[] = [];

    for (let i = 0; i < FLOW_STEPS.length; i += 1) {
      const card = cardRefs.current[i];
      if (!card) return;
      const rect = card.getBoundingClientRect();
      cards.push({
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      });
    }

    const next: LayoutMetrics = {
      width: containerRect.width,
      height: containerRect.height,
      isDesktop: containerRect.width >= MOBILE_BREAKPOINT,
      cards,
    };

    setLayout((prev) => (sameLayout(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId = 0;
    const scheduleMeasure = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        measureLayout();
      });
    };

    scheduleMeasure();

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [measureLayout]);

  useEffect(() => {
    if (reduceMotion) return;

    let rafId = 0;
    const update = () => {
      rafId = 0;
      const section = sectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const travel = viewportHeight + rect.height;
      if (travel <= 0) return;

      const next = clamp((viewportHeight - rect.top) / travel, 0, 1);
      setSectionProgress((prev) => (Math.abs(prev - next) < 0.002 ? prev : next));
    };

    const queue = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };

    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [reduceMotion]);

  const progress = reduceMotion ? 0.5 : sectionProgress;

  const cardStates = useMemo<CardVisualState[]>(() => {
    const fallback = FLOW_STEPS.map((_, index) => ({
      tx: 0,
      ty: 0,
      scale: 1,
      opacity: 1,
      zIndex: 10 + index,
      cx: 0,
      cy: 0,
      width: 0,
      height: 0,
    }));
    if (!layout || layout.cards.length !== FLOW_STEPS.length) return fallback;

    const count = FLOW_STEPS.length;
    const last = count - 1;
    const p = clamp(progress, 0, 1);
    const phase = p <= 0.5 ? p / 0.5 : (p - 0.5) / 0.5;
    const start = layout.cards[0];
    const end = layout.cards[last];
    const startCx = start.x + start.width / 2;
    const startCy = start.y + start.height / 2;
    const endCx = end.x + end.width / 2;
    const endCy = end.y + end.height / 2;

    return layout.cards.map((card, index) => {
      const depth = last > 0 ? index / last : 0;
      const reverseDepth = last > 0 ? (last - index) / last : 0;
      const cx = card.x + card.width / 2;
      const cy = card.y + card.height / 2;

      let entryTx = 0;
      let entryTy = 0;
      let exitTx = 0;
      let exitTy = 0;

      if (layout.isDesktop) {
        entryTx = startCx - cx + index * card.width * 0.18;
        entryTy = index * card.height * 0.12;
        exitTx = endCx - cx - (last - index) * card.width * 0.18;
        exitTy = -(last - index) * card.height * 0.12;
      } else {
        entryTx = startCx - cx + index * card.width * 0.04;
        entryTy = startCy - cy + index * card.height * 0.22;
        exitTx = endCx - cx - (last - index) * card.width * 0.04;
        exitTy = endCy - cy - (last - index) * card.height * 0.22;
      }

      const entryScale = 1 - depth * 0.15;
      const exitScale = 1 - reverseDepth * 0.15;
      const entryOpacity = 1 - depth * 0.42;
      const exitOpacity = 1 - reverseDepth * 0.42;
      const entryZ = count - index;
      const exitZ = index + 1;
      const spreadZ = 10 + index;

      if (p <= 0.5) {
        return {
          tx: lerp(entryTx, 0, phase),
          ty: lerp(entryTy, 0, phase),
          scale: lerp(entryScale, 1, phase),
          opacity: clamp(lerp(entryOpacity, 1, phase), 0.3, 1),
          zIndex: Math.round(lerp(entryZ, spreadZ, phase)),
          cx,
          cy,
          width: card.width,
          height: card.height,
        };
      }

      return {
        tx: lerp(0, exitTx, phase),
        ty: lerp(0, exitTy, phase),
        scale: lerp(1, exitScale, phase),
        opacity: clamp(lerp(1, exitOpacity, phase), 0.3, 1),
        zIndex: Math.round(lerp(spreadZ, exitZ, phase)),
        cx,
        cy,
        width: card.width,
        height: card.height,
      };
    });
  }, [layout, progress]);

  const connectors = useMemo<ConnectorPath[]>(() => {
    if (!layout || cardStates.length !== FLOW_STEPS.length || FLOW_STEPS.length < 2) return [];

    const spread = clamp(1 - Math.abs(progress - 0.5) * 2, 0, 1);
    const activeStep = progress * (FLOW_STEPS.length - 1);

    return cardStates.slice(0, -1).map((from, index) => {
      const to = cardStates[index + 1];
      const fromWidth = from.width * from.scale;
      const fromHeight = from.height * from.scale;
      const toWidth = to.width * to.scale;
      const toHeight = to.height * to.scale;

      let sx = 0;
      let sy = 0;
      let ex = 0;
      let ey = 0;
      let d = "";

      if (layout.isDesktop) {
        sx = from.cx + from.tx + fromWidth / 2 - 8;
        sy = from.cy + from.ty;
        ex = to.cx + to.tx - toWidth / 2 + 8;
        ey = to.cy + to.ty;
        const bend = Math.max(24, Math.abs(ex - sx) * 0.32);
        d = `M ${sx} ${sy} C ${sx + bend} ${sy}, ${ex - bend} ${ey}, ${ex} ${ey}`;
      } else {
        sx = from.cx + from.tx;
        sy = from.cy + from.ty + fromHeight / 2 - 8;
        ex = to.cx + to.tx;
        ey = to.cy + to.ty - toHeight / 2 + 8;
        const bend = Math.max(20, Math.abs(ey - sy) * 0.3);
        d = `M ${sx} ${sy} C ${sx} ${sy + bend}, ${ex} ${ey - bend}, ${ex} ${ey}`;
      }

      const distance = Math.abs(activeStep - index);
      const focus = clamp(1 - distance, 0, 1);
      const opacity = clamp(0.26 + spread * 0.46 + focus * 0.2, 0.2, 0.92);

      return { d, opacity };
    });
  }, [layout, cardStates, progress]);

  return (
    <div ref={sectionRef} className="mt-6 overflow-hidden">
      <div ref={containerRef} className="relative grid gap-4 py-1 md:grid-cols-4 md:items-stretch md:gap-5">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible"
        >
          <defs>
            <linearGradient id="workflow-connector-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
              <stop offset="50%" stopColor="var(--accent-strong)" stopOpacity="0.95" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.24" />
            </linearGradient>
          </defs>
          {connectors.map((connector, index) => (
            <g key={`connector-${index}`} opacity={connector.opacity}>
              <path
                d={connector.d}
                fill="none"
                stroke="rgba(133, 161, 211, 0.22)"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              <path
                d={connector.d}
                fill="none"
                stroke="url(#workflow-connector-gradient)"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              {!reduceMotion ? (
                <path
                  d={connector.d}
                  fill="none"
                  stroke="var(--accent-strong)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeDasharray="4 14"
                  style={{
                    animation: "workflowConnectorPulse 2.4s linear infinite",
                    animationDelay: `${index * 0.18}s`,
                  }}
                />
              ) : null}
            </g>
          ))}
        </svg>

        {FLOW_STEPS.map((step, index) => {
          const state = cardStates[index];
          return (
            <div
              key={step.title}
              ref={(node) => {
                cardRefs.current[index] = node;
              }}
              className="relative z-10 origin-center will-change-transform"
              style={{
                transform: `translate3d(${state.tx}px, ${state.ty}px, 0) scale(${state.scale})`,
                opacity: state.opacity,
                zIndex: state.zIndex,
              }}
            >
              <article className="flow-node min-h-[10.75rem] rounded-2xl border border-[var(--ring)] bg-[var(--card)] p-5 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                  Step {index + 1}
                </p>
                <h3 className="mt-1.5 text-lg font-semibold text-[var(--text)] md:text-xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-base leading-7 text-[var(--muted)]">
                  {step.detail}
                </p>
              </article>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes workflowConnectorPulse {
          to {
            stroke-dashoffset: -60;
          }
        }
      `}</style>
    </div>
  );
}
