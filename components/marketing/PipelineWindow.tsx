import type { CSSProperties } from "react";

/**
 * The design's animated "Invoice pipeline" product art: an app-window frame
 * around an SVG where an invoice travels from email trigger through two AI
 * agents to the ledger, over glowing dashed pipes with a marked human review
 * point. Two layouts from the design: "home" (680×380, hero) and "builder"
 * (1160×420, full-width).
 *
 * Colors come from the fixed --art-* palette (globals.css): the art stays a
 * dark app window in both themes, like a screenshot. Animations are disabled
 * under prefers-reduced-motion (globals.css), leaving a readable static frame.
 */

type Variant = "home" | "builder";

type NodeSpec = {
  x: number;
  y: number;
  chipWidth: number;
  chipLabel: string;
  label: string;
  kind: "trigger" | "ai" | "action";
  /** Accent status dot at the card's top-right (AI cards only). */
  dot?: { cx: number; cy: number };
};

type Layout = {
  viewBox: { width: number; height: number };
  card: { width: number; height: number; chipHeight: number };
  fontSize: { chip: number; label: number; review: number };
  chipTextOffsetY: number;
  labelOffsetY: number;
  pipes: string;
  travelPath: string;
  nodes: NodeSpec[];
  ports: { cx: number; cy: number }[];
  portRadius: number;
  invoice: { width: number; height: number; lineGap: number };
  review: {
    cx: number;
    cy: number;
    path: string;
    textX: number;
    textY: number;
    text: string;
  };
};

const LAYOUTS: Record<Variant, Layout> = {
  home: {
    viewBox: { width: 680, height: 380 },
    card: { width: 128, height: 66, chipHeight: 16 },
    fontSize: { chip: 8.5, label: 13, review: 11 },
    chipTextOffsetY: 22.5,
    labelOffsetY: 51,
    pipes:
      "M152 96 C220 96 232 96 272 96 M400 129 C400 140 400 146 400 157 M400 223 C400 260 440 284 528 284",
    travelPath:
      "M152 96 C220 96 232 96 272 96 C360 96 400 110 400 157 C400 223 400 260 440 284 L528 284",
    nodes: [
      {
        x: 24,
        y: 63,
        chipWidth: 58,
        chipLabel: "TRIGGER",
        label: "Email received",
        kind: "trigger",
      },
      {
        x: 272,
        y: 63,
        chipWidth: 60,
        chipLabel: "AI AGENT",
        label: "Extract fields",
        kind: "ai",
        dot: { cx: 390, cy: 74 },
      },
      {
        x: 336,
        y: 157,
        chipWidth: 60,
        chipLabel: "AI AGENT",
        label: "Classify + GL",
        kind: "ai",
        dot: { cx: 454, cy: 168 },
      },
      {
        x: 528,
        y: 251,
        chipWidth: 52,
        chipLabel: "ACTION",
        label: "Post to ledger",
        kind: "action",
      },
    ],
    ports: [
      { cx: 152, cy: 96 },
      { cx: 272, cy: 96 },
      { cx: 400, cy: 157 },
      { cx: 528, cy: 284 },
    ],
    portRadius: 3.4,
    invoice: { width: 22, height: 28, lineGap: 6 },
    review: {
      cx: 400,
      cy: 240,
      path: "M400 245 V334 H250",
      textX: 24,
      textY: 338,
      text: "Review point: a person approves here",
    },
  },
  builder: {
    viewBox: { width: 1160, height: 420 },
    card: { width: 152, height: 76, chipHeight: 18 },
    fontSize: { chip: 9.5, label: 14, review: 12 },
    chipTextOffsetY: 25,
    labelOffsetY: 58,
    pipes:
      "M196 120 C320 120 340 120 420 120 M640 158 C640 172 640 178 640 192 M640 268 C640 320 720 330 864 330",
    travelPath:
      "M196 120 C320 120 340 120 420 120 C560 120 640 130 640 192 C640 268 640 320 720 330 L864 330",
    nodes: [
      {
        x: 44,
        y: 82,
        chipWidth: 64,
        chipLabel: "TRIGGER",
        label: "Email received",
        kind: "trigger",
      },
      {
        x: 420,
        y: 82,
        chipWidth: 66,
        chipLabel: "AI AGENT",
        label: "Extract fields",
        kind: "ai",
        dot: { cx: 558, cy: 96 },
      },
      {
        x: 564,
        y: 192,
        chipWidth: 66,
        chipLabel: "AI AGENT",
        label: "Classify + GL",
        kind: "ai",
        dot: { cx: 702, cy: 206 },
      },
      {
        x: 864,
        y: 292,
        chipWidth: 58,
        chipLabel: "ACTION",
        label: "Post to ledger",
        kind: "action",
      },
    ],
    ports: [
      { cx: 196, cy: 120 },
      { cx: 420, cy: 120 },
      { cx: 640, cy: 192 },
      { cx: 864, cy: 330 },
    ],
    portRadius: 3.6,
    invoice: { width: 24, height: 30, lineGap: 7 },
    review: {
      cx: 640,
      cy: 292,
      path: "M640 297 V376 H360",
      textX: 44,
      textY: 380,
      text: "Review point: a person approves before posting",
    },
  },
};

const art = (name: string): string => `var(--art-${name})`;

function PipelineSvg({ variant }: { variant: Variant }) {
  const layout = LAYOUTS[variant];
  const { viewBox, card, fontSize, nodes, ports } = layout;
  const idPrefix = `pipeline-${variant}`;
  const invoice = layout.invoice;

  const travelStyle: CSSProperties = {
    offsetPath: `path('${layout.travelPath}')`,
    animation: "a8x-travel 6s linear infinite",
  };

  return (
    <svg
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      className="block h-auto w-full"
      aria-label="Live workflow demo: an invoice travels from email to ledger"
      role="img"
    >
      <defs>
        <pattern
          id={`${idPrefix}-grid`}
          width="28"
          height="28"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" style={{ fill: art("grid-dot") }} />
        </pattern>
        <linearGradient id={`${idPrefix}-pipe`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: art("pipe-start") }} />
          <stop offset="1" style={{ stopColor: art("accent") }} />
        </linearGradient>
        <filter
          id={`${idPrefix}-glow`}
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter
          id={`${idPrefix}-card`}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="10"
            floodColor="#000000"
            floodOpacity="0.35"
          />
        </filter>
      </defs>

      <rect
        x="0"
        y="0"
        width={viewBox.width}
        height={viewBox.height}
        fill={`url(#${idPrefix}-grid)`}
      />

      {/* Pipes: idle track + glowing dashed pulse. */}
      <path
        d={layout.pipes}
        fill="none"
        strokeWidth="2"
        style={{ stroke: art("path-idle") }}
      />
      <path
        d={layout.pipes}
        fill="none"
        stroke={`url(#${idPrefix}-pipe)`}
        strokeWidth="1.5"
        strokeDasharray="6 20"
        filter={`url(#${idPrefix}-glow)`}
        style={{ animation: "a8x-pulse 2.8s linear infinite" }}
      />

      {/* Workflow cards. */}
      <g filter={`url(#${idPrefix}-card)`}>
        {nodes.map((node) => (
          <g key={node.label}>
            <rect
              x={node.x}
              y={node.y}
              width={card.width}
              height={card.height}
              rx="10"
              strokeWidth={node.kind === "ai" ? 1.2 : 1}
              style={{
                fill: art("card"),
                stroke:
                  node.kind === "ai" ? art("pipe-start") : art("card-border"),
              }}
            />
            <rect
              x={node.x + 12}
              y={node.y + 11}
              width={node.chipWidth}
              height={card.chipHeight}
              rx={card.chipHeight / 2}
              style={{
                fill: node.kind === "ai" ? art("chip-ai") : art("chip"),
              }}
            />
            <text
              x={node.x + 12 + node.chipWidth / 2}
              y={node.y + layout.chipTextOffsetY}
              textAnchor="middle"
              fontSize={fontSize.chip}
              letterSpacing="1.4"
              style={{
                fill:
                  node.kind === "ai" ? art("chip-ai-text") : art("chip-text"),
              }}
            >
              {node.chipLabel}
            </text>
            <text
              x={node.x + 12}
              y={node.y + layout.labelOffsetY}
              fontSize={fontSize.label}
              style={{ fill: art("ink") }}
            >
              {node.label}
            </text>
            {node.dot ? (
              <circle
                cx={node.dot.cx}
                cy={node.dot.cy}
                r="2.6"
                style={{ fill: art("accent") }}
              />
            ) : null}
          </g>
        ))}
      </g>

      {/* Connection ports. */}
      <g opacity="0.9">
        {ports.map((port) => (
          <circle
            key={`${port.cx}-${port.cy}`}
            cx={port.cx}
            cy={port.cy}
            r={layout.portRadius}
            strokeWidth="1.2"
            style={{ fill: art("node-fill"), stroke: art("accent") }}
          />
        ))}
      </g>

      {/* The travelling invoice. */}
      <g filter={`url(#${idPrefix}-card)`} style={travelStyle}>
        <rect
          x={-invoice.width / 2}
          y={-invoice.height / 2}
          width={invoice.width}
          height={invoice.height}
          rx="3.5"
          style={{ fill: art("ink") }}
        />
        <path
          d={`M-6 ${-invoice.lineGap} H6 M-6 0 H6 M-6 ${invoice.lineGap} H2`}
          strokeWidth={variant === "home" ? 1.6 : 1.8}
          style={{ stroke: art("ink-dark") }}
        />
      </g>

      {/* Human review point. */}
      <g>
        <circle
          cx={layout.review.cx}
          cy={layout.review.cy}
          r="5"
          strokeWidth="1.4"
          filter={`url(#${idPrefix}-glow)`}
          style={{ fill: art("node-fill"), stroke: art("accent") }}
        />
        <path
          d={layout.review.path}
          fill="none"
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="3 5"
          style={{ stroke: art("accent") }}
        />
        <text
          x={layout.review.textX}
          y={layout.review.textY}
          fontSize={fontSize.review}
          style={{ fill: art("accent") }}
        >
          {layout.review.text}
        </text>
      </g>
    </svg>
  );
}

/** App-window chrome (traffic lights + title) framing the pipeline art. */
export function PipelineWindow({ variant = "home" }: { variant?: Variant }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-neutral-700)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--color-neutral-900)_80%,transparent),color-mix(in_srgb,var(--color-neutral-800)_55%,transparent))] p-2.5 shadow-[var(--shadow-lg)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-neutral-800)] px-2.5 pt-2 pb-3">
        <span className="h-[9px] w-[9px] rounded-full bg-[var(--color-neutral-700)]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[var(--color-neutral-700)]" />
        <span className="h-[9px] w-[9px] rounded-full bg-[var(--color-neutral-700)]" />
        <span className="ml-2.5 text-[11px] tracking-[0.12em] text-[var(--color-neutral-400)] uppercase">
          Invoice pipeline
        </span>
      </div>
      <PipelineSvg variant={variant} />
    </div>
  );
}
