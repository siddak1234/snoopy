"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Node = { x: number; y: number; r: number };
type Path = { d: string; width: number; opacity: number };

export default function DataflowVisual({
  className,
  density = "standard",
}: {
  className?: string;
  density?: "standard" | "dense";
}) {
  const reduceMotion = useReducedMotion();
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const uid = useId().replace(/:/g, "");

  useEffect(() => {
    const mql = window.matchMedia("(hover: none)");
    setIsCoarsePointer(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsCoarsePointer(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const { nodes, paths } = useMemo(() => {
    const baseNodes: Node[] = [
      { x: 120, y: 86, r: 7 },
      { x: 320, y: 140, r: 7 },
      { x: 520, y: 96, r: 7 },
      { x: 720, y: 154, r: 7 },
      { x: 940, y: 110, r: 7 },
    ];

    const basePaths: Path[] = [
      { d: "M120 86 C 205 40, 255 180, 320 140", width: 2.4, opacity: 0.72 },
      { d: "M320 140 C 410 210, 450 10, 520 96", width: 2.4, opacity: 0.62 },
      { d: "M520 96 C 610 40, 660 220, 720 154", width: 2.2, opacity: 0.56 },
      { d: "M720 154 C 800 220, 860 40, 940 110", width: 2.4, opacity: 0.7 },
    ];

    if (density === "dense") {
      baseNodes.push({ x: 210, y: 188, r: 6 }, { x: 610, y: 204, r: 6 });
      basePaths.push(
        { d: "M120 86 C 150 160, 180 200, 210 188", width: 1.9, opacity: 0.4 },
        { d: "M520 96 C 560 160, 590 220, 610 204", width: 1.9, opacity: 0.35 },
      );
    }

    return { nodes: baseNodes, paths: basePaths };
  }, [density]);

  return (
    <div
      className={className ?? "relative overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)]"}
    >
      {/* Soft glow wash */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full bg-[var(--accent)]/15 blur-3xl" />
        <div className="absolute right-[-3rem] bottom-[-4rem] h-56 w-56 rounded-full bg-[var(--accent-strong)]/12 blur-3xl" />
      </div>

      <svg
        className="relative block h-full w-full"
        viewBox="0 0 1040 260"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id={`stroke-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(142,188,255,0.0)" />
            <stop offset="25%" stopColor="rgba(142,188,255,0.35)" />
            <stop offset="55%" stopColor="rgba(95,158,255,0.35)" />
            <stop offset="100%" stopColor="rgba(142,188,255,0.0)" />
          </linearGradient>
          <radialGradient id={`node-${uid}`} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
            <stop offset="40%" stopColor="rgba(142,188,255,0.65)" />
            <stop offset="100%" stopColor="rgba(95,158,255,0.20)" />
          </radialGradient>
          <linearGradient id={`pulse-${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
          </linearGradient>
          <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feColorMatrix
              in="b"
              type="matrix"
              values="
                1 0 0 0 0
                0 1 0 0 0
                0 0 1 0 0
                0 0 0 0.55 0"
              result="g"
            />
            <feMerge>
              <feMergeNode in="g" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Curved workflow paths */}
        {paths.map((p, idx) => (
          <path
            key={idx}
            id={`df-path-${uid}-${idx}`}
            d={p.d}
            fill="none"
            stroke={`url(#stroke-${uid})`}
            strokeWidth={p.width}
            opacity={p.opacity}
            strokeLinecap="round"
          />
        ))}

        {/* Node junctions */}
        <g filter={`url(#glow-${uid})`} opacity="0.9">
          {nodes.map((n, idx) => (
            <g key={idx}>
              <circle cx={n.x} cy={n.y} r={n.r} fill={`url(#node-${uid})`} />
              <circle cx={n.x} cy={n.y} r={n.r + 8} fill="rgba(95,158,255,0.06)" />
            </g>
          ))}
        </g>

        {/* Animated signal pulses */}
        {!reduceMotion && !isCoarsePointer ? (
          <g>
            {/* A couple of dots + a small streak, offset in time for \"orchestration\" feel */}
            <circle r="4" fill="rgba(95,158,255,0.9)">
              <animateMotion dur="4.8s" repeatCount="indefinite">
                <mpath href={`#df-path-${uid}-0`} />
              </animateMotion>
            </circle>
            <circle r="3.3" fill="rgba(142,188,255,0.85)">
              <animateMotion dur="5.4s" repeatCount="indefinite" begin="0.7s">
                <mpath href={`#df-path-${uid}-2`} />
              </animateMotion>
            </circle>
            <rect
              x="0"
              y="0"
              width="44"
              height="3"
              rx="999"
              fill={`url(#pulse-${uid})`}
              opacity="0.35"
            >
              <animateMotion dur="6.0s" repeatCount="indefinite" begin="1.2s">
                <mpath href={`#df-path-${uid}-1`} />
              </animateMotion>
            </rect>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

