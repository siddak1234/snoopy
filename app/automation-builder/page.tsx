"use client";

import { useCallback, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

/* ------------------------------------------------------------------ */
/*  Block icon SVGs                                                    */
/* ------------------------------------------------------------------ */

function BlockIcon({ type }: { type: string }) {
  const shared = "h-4 w-4 text-[var(--icon-text)]";

  switch (type) {
    case "Trigger":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M9.5 1.5 4 9h4l-1.5 5.5L13 7H9z" />
        </svg>
      );
    case "AI Agent":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
        </svg>
      );
    case "Data Source":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <ellipse cx="8" cy="4" rx="5" ry="2" />
          <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" />
          <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" />
        </svg>
      );
    case "Condition":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M8 2v4M8 6l4 4M8 6l-4 4M4 10v4M12 10v4" />
        </svg>
      );
    case "Action":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={shared}>
          <path d="M5 2.5v11l8-5.5z" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BLOCK_TYPES = ["Trigger", "AI Agent", "Data Source", "Condition", "Action"];
const NODE_W = 130;
const NODE_H = 36;
const TRASH_SIZE = 56;

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AutomationBuilderPage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [trashHover, setTrashHover] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  // Ref-based drag state to avoid re-renders on every pointer move
  const dragRef = useRef<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  /* ---- helpers --------------------------------------------------- */

  const canvasRect = useCallback(() => canvasRef.current?.getBoundingClientRect() ?? null, []);

  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

  const isOverTrash = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRect();
      if (!rect) return false;
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return x >= rect.width - TRASH_SIZE - 12 && y <= TRASH_SIZE + 12;
    },
    [canvasRect],
  );

  /* ---- palette drag (HTML drag API) ------------------------------ */

  function onPaletteDragStart(e: React.DragEvent, type: string) {
    e.dataTransfer.setData("block-type", type);
    e.dataTransfer.effectAllowed = "copy";
  }

  function onCanvasDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("block-type")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function onCanvasDrop(e: React.DragEvent) {
    const type = e.dataTransfer.getData("block-type");
    if (!type) return;
    e.preventDefault();

    const rect = canvasRect();
    if (!rect) return;

    const x = clamp(e.clientX - rect.left - NODE_W / 2, 0, rect.width - NODE_W);
    const y = clamp(e.clientY - rect.top - NODE_H / 2, 0, rect.height - NODE_H);

    setNodes((prev) => [
      ...prev,
      { id: `node_${nextId.current++}`, type, x, y },
    ]);
  }

  /* ---- placed-node drag (pointer events) ------------------------- */

  function onNodePointerDown(e: React.PointerEvent, nodeId: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const rect = canvasRect();
    if (!rect) return;
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    dragRef.current = {
      nodeId,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    };
  }

  function onNodePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const rect = canvasRect();
    if (!rect) return;

    const x = clamp(e.clientX - rect.left - drag.offsetX, 0, rect.width - NODE_W);
    const y = clamp(e.clientY - rect.top - drag.offsetY, 0, rect.height - NODE_H);

    setNodes((prev) =>
      prev.map((n) => (n.id === drag.nodeId ? { ...n, x, y } : n)),
    );

    setTrashHover(isOverTrash(e.clientX, e.clientY));
  }

  function onNodePointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    if (isOverTrash(e.clientX, e.clientY)) {
      setNodes((prev) => prev.filter((n) => n.id !== drag.nodeId));
    }

    dragRef.current = null;
    setTrashHover(false);
  }

  /* ---- render ---------------------------------------------------- */

  const hasNodes = nodes.length > 0;

  return (
    <>
      <style>{`html,body{overflow:hidden!important}`}</style>

      {/* Workspace title — fixed to top-left, same row as navbar */}
      <div className="fixed left-4 top-4 z-50 inline-flex items-center rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] px-6 py-2.5 shadow-sm">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          Builder
        </h1>
      </div>

      {/* Canvas */}
      <div
        className="relative -mt-4 flex overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)] shadow-[inset_0_0_60px_rgba(100,140,200,0.04)] sm:-mt-6"
        style={{
          width: "calc(100vw - 2rem)",
          height: "calc(100dvh - 7.375rem)",
          marginLeft: "calc(-50vw + 50% + 1rem)",
        }}
      >
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.4,
          }}
        />

        {/* Glow ring */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[var(--accent)]/10" />

        {/* Docked block palette */}
        <aside className="relative z-10 flex w-44 shrink-0 flex-col border-r border-[var(--ring)]/50 bg-[var(--surface)]/60 px-2.5 py-3 backdrop-blur-sm">
          <h2 className="px-1 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Blocks
          </h2>
          <div className="mt-2 flex flex-col gap-1">
            {BLOCK_TYPES.map((name) => (
              <div
                key={name}
                draggable
                onDragStart={(e) => onPaletteDragStart(e, name)}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] active:cursor-grabbing"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--icon-border)] bg-[var(--icon-bg)]">
                  <BlockIcon type={name} />
                </span>
                <span>{name}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Workflow workspace (drop target) */}
        <div
          ref={canvasRef}
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
          className="relative z-10 min-w-0 flex-1"
        >
          {/* Placeholder — hidden once nodes exist */}
          {!hasNodes && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-center">
                <svg
                  viewBox="0 0 48 48"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-9 w-9 text-[var(--accent)]/60"
                  aria-hidden
                >
                  <rect x="8" y="8" width="32" height="32" rx="8" />
                  <path d="M24 18v12M18 24h12" />
                </svg>
                <p className="text-sm font-medium text-[var(--muted)]">
                  Your workflow canvas
                </p>
                <p className="max-w-[14rem] text-[0.7rem] leading-relaxed text-[var(--muted)]/70">
                  Drag blocks here to sketch your automation idea.
                </p>
              </div>
            </div>
          )}

          {/* Placed nodes */}
          {nodes.map((node) => (
            <div
              key={node.id}
              onPointerDown={(e) => onNodePointerDown(e, node.id)}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              className="absolute z-20 flex cursor-grab items-center gap-2 rounded-lg border border-[var(--ring)] bg-[var(--card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text)] shadow-md transition-shadow select-none hover:border-[var(--accent)] hover:shadow-lg active:cursor-grabbing"
              style={{
                left: node.x,
                top: node.y,
                width: NODE_W,
                height: NODE_H,
                touchAction: "none",
              }}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--icon-border)] bg-[var(--icon-bg)]">
                <BlockIcon type={node.type} />
              </span>
              <span className="truncate">{node.type}</span>
            </div>
          ))}

          {/* Trash zone — top-right corner of canvas */}
          <div
            className={`absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
              trashHover
                ? "border-red-400 bg-red-500/20 text-red-400 scale-110"
                : "border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
            }`}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4M6.667 7.333v4M9.333 7.333v4" />
              <path d="M3.333 4l.667 9.333a1.333 1.333 0 0 0 1.333 1.334h5.334a1.333 1.333 0 0 0 1.333-1.334L12.667 4" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
