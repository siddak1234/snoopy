"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkflowNode {
  id: string;
  type: string;
  x: number;
  y: number;
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Block metadata — single source of truth                            */
/* ------------------------------------------------------------------ */

const BLOCKS: readonly { type: string; label: string }[] = [
  { type: "Trigger", label: "Trigger" },
  { type: "AI Agent", label: "AI Agent" },
  { type: "Data Source", label: "Data Source" },
  { type: "Condition", label: "Condition" },
  { type: "Action", label: "Action" },
];

const BLOCK_MAP = new Map(BLOCKS.map((b) => [b.type, b]));

/* ------------------------------------------------------------------ */
/*  Block icon — shared across palette and canvas                      */
/* ------------------------------------------------------------------ */

function BlockIcon({ type, className }: { type: string; className?: string }) {
  const base = className ?? "h-4 w-4 text-[var(--icon-text)]";

  switch (type) {
    case "Trigger":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={base}>
          <path d="M9.5 1.5 4 9h4l-1.5 5.5L13 7H9z" />
        </svg>
      );
    case "AI Agent":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={base}>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" />
        </svg>
      );
    case "Data Source":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={base}>
          <ellipse cx="8" cy="4" rx="5" ry="2" />
          <path d="M3 4v8c0 1.1 2.24 2 5 2s5-.9 5-2V4" />
          <path d="M3 8c0 1.1 2.24 2 5 2s5-.9 5-2" />
        </svg>
      );
    case "Condition":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={base}>
          <path d="M8 2v4M8 6l4 4M8 6l-4 4M4 10v4M12 10v4" />
        </svg>
      );
    case "Action":
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={base}>
          <path d="M5 2.5v11l8-5.5z" />
        </svg>
      );
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Shared icon tile — used by both palette and canvas node            */
/* ------------------------------------------------------------------ */

function BlockIconTile({ type, size = "md" }: { type: string; size?: "md" | "sm" }) {
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "md" ? "h-5 w-5 text-[var(--icon-text)]" : "h-4 w-4 text-[var(--icon-text)]";

  return (
    <span className={`flex ${dim} items-center justify-center rounded-lg border border-[var(--icon-border)] bg-[var(--icon-bg)]`}>
      <BlockIcon type={type} className={icon} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Dimensions                                                         */
/* ------------------------------------------------------------------ */

const NODE_W = 88;
const NODE_H = 80;
const NOTE_W = 96;
const NOTE_H = 96;
const NOTE_MIN_W = 80;
const NOTE_MIN_H = 80;
const TRASH_SIZE = 56;

/* Mobile-specific constants */
const MOBILE_NODE_W = 72;
const MOBILE_NODE_H = 64;
const MOBILE_BP = 640;
const WORLD_SIZE = 2000;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2.5;
const DEFAULT_ZOOM = 0.75;

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */

export default function AutomationBuilderPage() {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [notes, setNotes] = useState<StickyNote[]>([]);
  const [trashHover, setTrashHover] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [, forceRender] = useState(0);

  const canvasRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(0);

  const nodesRef = useRef<WorkflowNode[]>([]);
  nodesRef.current = nodes;
  const notesRef = useRef<StickyNote[]>([]);
  notesRef.current = notes;

  const trashHoverRef = useRef(false);
  const isMobileRef = useRef(false);
  isMobileRef.current = isMobile;

  const vpRef = useRef({ x: 0, y: 0, zoom: DEFAULT_ZOOM });

  const gestureRef = useRef<{
    type: "pan" | "pinch";
    startVp: { x: number; y: number; zoom: number };
    startTouchX: number;
    startTouchY: number;
    startDist: number;
  } | null>(null);

  const resizeRef = useRef<{
    noteId: string;
    el: HTMLElement;
    rect: DOMRect;
    startW: number;
    startH: number;
    startClientX: number;
    startClientY: number;
  } | null>(null);

  const dragRef = useRef<{
    itemId: string;
    source: "node" | "note";
    el: HTMLElement;
    rect: DOMRect;
    offsetX: number;
    offsetY: number;
    lastX: number;
    lastY: number;
    itemW: number;
    itemH: number;
  } | null>(null);

  const nodeW = isMobile ? MOBILE_NODE_W : NODE_W;
  const nodeH = isMobile ? MOBILE_NODE_H : NODE_H;

  /* ---- helpers --------------------------------------------------- */

  const isOverTrash = useCallback(
    (clientX: number, clientY: number, rect: DOMRect) => {
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return x >= rect.width - TRASH_SIZE - 12 && y <= TRASH_SIZE + 12;
    },
    [],
  );

  function applyViewport() {
    if (worldRef.current) {
      const { x, y, zoom } = vpRef.current;
      worldRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }

  function screenToWorld(clientX: number, clientY: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    if (!isMobileRef.current) {
      return { x: clientX - rect.left, y: clientY - rect.top };
    }
    const vp = vpRef.current;
    return {
      x: (clientX - rect.left - vp.x) / vp.zoom,
      y: (clientY - rect.top - vp.y) / vp.zoom,
    };
  }

  /* ---- mobile detection ------------------------------------------ */

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  /* ---- initial viewport centering on mobile ---------------------- */

  useEffect(() => {
    if (!isMobile) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const zoom = DEFAULT_ZOOM;
    vpRef.current = {
      x: rect.width / 2 - (WORLD_SIZE / 2) * zoom,
      y: rect.height / 3 - (WORLD_SIZE / 2) * zoom,
      zoom,
    };
    applyViewport();
  }, [isMobile]);

  /* ---- touch gestures for mobile canvas pan/zoom ----------------- */

  useEffect(() => {
    if (!isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleTouchStart(e: TouchEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-canvas-item]")) return;

      if (e.touches.length === 2) e.preventDefault();

      if (e.touches.length === 1) {
        gestureRef.current = {
          type: "pan",
          startVp: { ...vpRef.current },
          startTouchX: e.touches[0].clientX,
          startTouchY: e.touches[0].clientY,
          startDist: 0,
        };
      } else if (e.touches.length === 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]];
        gestureRef.current = {
          type: "pinch",
          startVp: { ...vpRef.current },
          startTouchX: (t1.clientX + t2.clientX) / 2,
          startTouchY: (t1.clientY + t2.clientY) / 2,
          startDist: Math.hypot(
            t2.clientX - t1.clientX,
            t2.clientY - t1.clientY,
          ),
        };
      }
    }

    function handleTouchMove(e: TouchEvent) {
      const g = gestureRef.current;
      if (!g) return;
      e.preventDefault();

      if (g.type === "pan" && e.touches.length === 1) {
        vpRef.current.x =
          g.startVp.x + (e.touches[0].clientX - g.startTouchX);
        vpRef.current.y =
          g.startVp.y + (e.touches[0].clientY - g.startTouchY);
      } else if (e.touches.length === 2) {
        if (g.type === "pan") {
          const [t1, t2] = [e.touches[0], e.touches[1]];
          gestureRef.current = {
            type: "pinch",
            startVp: { ...vpRef.current },
            startTouchX: (t1.clientX + t2.clientX) / 2,
            startTouchY: (t1.clientY + t2.clientY) / 2,
            startDist: Math.hypot(
              t2.clientX - t1.clientX,
              t2.clientY - t1.clientY,
            ),
          };
          return;
        }
        const [t1, t2] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(
          t2.clientX - t1.clientX,
          t2.clientY - t1.clientY,
        );
        const newZoom = clamp(
          g.startVp.zoom * (dist / g.startDist),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        const rect = canvas!.getBoundingClientRect();
        const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
        const midY = (t1.clientY + t2.clientY) / 2 - rect.top;
        const worldX = (midX - g.startVp.x) / g.startVp.zoom;
        const worldY = (midY - g.startVp.y) / g.startVp.zoom;
        vpRef.current = {
          x: midX - worldX * newZoom,
          y: midY - worldY * newZoom,
          zoom: newZoom,
        };
      }
      applyViewport();
    }

    function handleTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        gestureRef.current = null;
      } else if (
        e.touches.length === 1 &&
        gestureRef.current?.type === "pinch"
      ) {
        gestureRef.current = {
          type: "pan",
          startVp: { ...vpRef.current },
          startTouchX: e.touches[0].clientX,
          startTouchY: e.touches[0].clientY,
          startDist: 0,
        };
      }
    }

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);

    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile]);

  /* ---- palette drag (HTML drag API, desktop only) ---------------- */

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

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = clamp(e.clientX - rect.left - NODE_W / 2, 0, rect.width - NODE_W);
    const y = clamp(e.clientY - rect.top - NODE_H / 2, 0, rect.height - NODE_H);

    setNodes((prev) => [
      ...prev,
      { id: `node_${nextId.current++}`, type, x, y },
    ]);
  }

  /* ---- mobile: add node at viewport center ----------------------- */

  function addNodeAtCenter(type: string) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vp = vpRef.current;
    const cx = (rect.width / 2 - vp.x) / vp.zoom;
    const cy = (rect.height / 2 - vp.y) / vp.zoom;
    const x = clamp(cx - nodeW / 2, 0, WORLD_SIZE - nodeW);
    const y = clamp(cy - nodeH / 2, 0, WORLD_SIZE - nodeH);
    setNodes((prev) => [
      ...prev,
      { id: `node_${nextId.current++}`, type, x, y },
    ]);
  }

  /* ---- mobile: zoom controls ------------------------------------- */

  function mobileZoom(delta: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const vp = vpRef.current;
    const worldX = (cx - vp.x) / vp.zoom;
    const worldY = (cy - vp.y) / vp.zoom;
    const newZoom = clamp(vp.zoom + delta, MIN_ZOOM, MAX_ZOOM);
    vpRef.current = {
      x: cx - worldX * newZoom,
      y: cy - worldY * newZoom,
      zoom: newZoom,
    };
    applyViewport();
    forceRender((n) => n + 1);
  }

  /* ---- generic item drag (pointer events, DOM-direct) ------------ */

  function startItemDrag(
    e: React.PointerEvent,
    itemId: string,
    source: "node" | "note",
  ) {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const items = source === "node" ? nodesRef.current : notesRef.current;
    const item = items.find((n) => n.id === itemId);
    if (!item) return;

    const w = source === "node" ? nodeW : (item as StickyNote).w;
    const h = source === "node" ? nodeH : (item as StickyNote).h;

    if (isMobileRef.current) {
      const world = screenToWorld(e.clientX, e.clientY);
      dragRef.current = {
        itemId,
        source,
        el,
        rect,
        offsetX: world.x - item.x,
        offsetY: world.y - item.y,
        lastX: item.x,
        lastY: item.y,
        itemW: w,
        itemH: h,
      };
    } else {
      dragRef.current = {
        itemId,
        source,
        el,
        rect,
        offsetX: e.clientX - rect.left - item.x,
        offsetY: e.clientY - rect.top - item.y,
        lastX: item.x,
        lastY: item.y,
        itemW: w,
        itemH: h,
      };
    }
  }

  function onItemPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    let x: number;
    let y: number;

    if (isMobileRef.current) {
      const world = screenToWorld(e.clientX, e.clientY);
      x = clamp(world.x - drag.offsetX, 0, WORLD_SIZE - drag.itemW);
      y = clamp(world.y - drag.offsetY, 0, WORLD_SIZE - drag.itemH);
    } else {
      x = clamp(
        e.clientX - drag.rect.left - drag.offsetX,
        0,
        drag.rect.width - drag.itemW,
      );
      y = clamp(
        e.clientY - drag.rect.top - drag.offsetY,
        0,
        drag.rect.height - drag.itemH,
      );
    }

    drag.el.style.left = `${x}px`;
    drag.el.style.top = `${y}px`;
    drag.lastX = x;
    drag.lastY = y;

    const over = isOverTrash(e.clientX, e.clientY, drag.rect);
    if (over !== trashHoverRef.current) {
      trashHoverRef.current = over;
      setTrashHover(over);
    }
  }

  function onItemPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;

    const deleteDrag = isOverTrash(e.clientX, e.clientY, drag.rect);
    const setter = drag.source === "node" ? setNodes : setNotes;

    if (deleteDrag) {
      setter((prev: any[]) => prev.filter((n: any) => n.id !== drag.itemId));
    } else {
      setter((prev: any[]) =>
        prev.map((n: any) =>
          n.id === drag.itemId
            ? { ...n, x: drag.lastX, y: drag.lastY }
            : n,
        ),
      );
    }

    dragRef.current = null;
    trashHoverRef.current = false;
    setTrashHover(false);
  }

  /* ---- note resize (pointer events, DOM-direct) ------------------- */

  function onResizePointerDown(e: React.PointerEvent, noteId: string) {
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);

    const noteEl = handle.closest("[data-note-id]") as HTMLElement | null;
    if (!noteEl) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const note = notesRef.current.find((n) => n.id === noteId);
    if (!note) return;

    resizeRef.current = {
      noteId,
      el: noteEl,
      rect,
      startW: note.w,
      startH: note.h,
      startClientX: e.clientX,
      startClientY: e.clientY,
    };
  }

  function onResizePointerMove(e: React.PointerEvent) {
    const rs = resizeRef.current;
    if (!rs) return;

    const dw = e.clientX - rs.startClientX;
    const dh = e.clientY - rs.startClientY;
    const scale = isMobileRef.current ? vpRef.current.zoom : 1;
    const newW = Math.max(NOTE_MIN_W, rs.startW + dw / scale);
    const newH = Math.max(NOTE_MIN_H, rs.startH + dh / scale);

    rs.el.style.width = `${newW}px`;
    rs.el.style.height = `${newH}px`;
  }

  function onResizePointerUp() {
    const rs = resizeRef.current;
    if (!rs) return;

    const w = parseInt(rs.el.style.width, 10);
    const h = parseInt(rs.el.style.height, 10);

    setNotes((prev) =>
      prev.map((n) => (n.id === rs.noteId ? { ...n, w, h } : n)),
    );
    resizeRef.current = null;
  }

  function updateNoteText(noteId: string, text: string) {
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, text } : n)),
    );
  }

  /* ---- add note -------------------------------------------------- */

  function addNote() {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (isMobile) {
      const vp = vpRef.current;
      const cx = (rect.width / 2 - vp.x) / vp.zoom;
      const cy = (rect.height / 2 - vp.y) / vp.zoom;
      const x = clamp(cx - NOTE_W / 2, 0, WORLD_SIZE - NOTE_W);
      const y = clamp(cy - NOTE_H / 2, 0, WORLD_SIZE - NOTE_H);
      setNotes((prev) => [
        ...prev,
        { id: `note_${nextId.current++}`, x, y, w: NOTE_W, h: NOTE_H, text: "" },
      ]);
    } else {
      const x = clamp(rect.width / 2 - NOTE_W / 2, 0, rect.width - NOTE_W);
      const y = clamp(rect.height / 2 - NOTE_H / 2, 0, rect.height - NOTE_H);
      setNotes((prev) => [
        ...prev,
        { id: `note_${nextId.current++}`, x, y, w: NOTE_W, h: NOTE_H, text: "" },
      ]);
    }
  }

  /* ---- render ---------------------------------------------------- */

  const hasItems = nodes.length > 0 || notes.length > 0;

  return (
    <>
      <style>{`html,body{overflow:hidden!important}`}</style>

      {/* Workspace title — hidden on mobile to avoid overlap with nav */}
      <div className="fixed left-4 top-4 z-50 hidden items-center gap-3 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] px-6 py-2.5 shadow-sm sm:inline-flex">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--text)]">
          Automation Builder
        </h1>
        <span className="rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] px-2.5 py-0.5 text-[0.65rem] font-semibold text-[var(--step-pill-text)]">
          Preview
        </span>
      </div>

      {/* Canvas */}
      <div
        className="relative -mt-4 flex overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)] shadow-[inset_0_0_60px_rgba(100,140,200,0.04)] sm:-mt-6"
        style={{
          width: isMobile ? "calc(100vw - 1rem)" : "calc(100vw - 2rem)",
          height: isMobile
            ? "calc(100dvh - 6rem)"
            : "calc(100dvh - 7.375rem)",
          marginLeft: isMobile
            ? "calc(-50vw + 50% + 0.5rem)"
            : "calc(-50vw + 50% + 1rem)",
        }}
      >
        {/* Dot grid — desktop only (mobile version lives inside world div) */}
        {!isMobile && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              opacity: 0.4,
            }}
          />
        )}

        {/* Glow ring */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-[var(--accent)]/10" />

        {/* Docked block palette — desktop only */}
        {!isMobile && (
          <aside className="relative z-10 flex w-28 shrink-0 flex-col border-r border-[var(--ring)]/50 bg-[var(--surface)]/60 px-2.5 py-3 backdrop-blur-sm">
            <h2 className="px-0.5 text-[0.65rem] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Blocks
            </h2>
            <div className="mt-3 flex flex-col gap-2">
              {BLOCKS.map(({ type, label }) => (
                <div
                  key={type}
                  draggable
                  onDragStart={(e) => onPaletteDragStart(e, type)}
                  className="flex cursor-grab flex-col items-center gap-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-1 py-3 transition hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] active:cursor-grabbing"
                >
                  <BlockIconTile type={type} size="md" />
                  <span className="text-[0.6rem] font-medium leading-tight text-[var(--text)]">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}

        {/* Workflow workspace (drop target) */}
        <div
          ref={canvasRef}
          onDragOver={!isMobile ? onCanvasDragOver : undefined}
          onDrop={!isMobile ? onCanvasDrop : undefined}
          className="relative z-10 min-w-0 flex-1"
          style={
            isMobile
              ? { touchAction: "none", overflow: "hidden" }
              : undefined
          }
        >
          {/* World wrapper — transformed viewport on mobile, identity on desktop */}
          <div
            ref={worldRef}
            style={
              isMobile
                ? {
                    position: "absolute",
                    width: WORLD_SIZE,
                    height: WORLD_SIZE,
                    transformOrigin: "0 0",
                    willChange: "transform",
                  }
                : { position: "absolute", inset: 0 }
            }
          >
            {/* Dot grid — mobile version (pans/zooms with world) */}
            {isMobile && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, var(--ring) 1px, transparent 1px)",
                  backgroundSize: "28px 28px",
                  opacity: 0.4,
                }}
              />
            )}

            {/* Placed nodes */}
            {nodes.map((node) => {
              const meta = BLOCK_MAP.get(node.type);
              return (
                <div
                  key={node.id}
                  data-canvas-item
                  onPointerDown={(e) => startItemDrag(e, node.id, "node")}
                  onPointerMove={onItemPointerMove}
                  onPointerUp={onItemPointerUp}
                  className="absolute z-20 flex cursor-grab flex-col items-center justify-center gap-1.5 rounded-xl border border-[var(--ring)] bg-[var(--card)] shadow-md select-none hover:border-[var(--accent)] active:cursor-grabbing"
                  style={{
                    left: node.x,
                    top: node.y,
                    width: nodeW,
                    height: nodeH,
                    touchAction: "none",
                  }}
                >
                  <BlockIconTile type={node.type} size="sm" />
                  <span
                    className="font-medium leading-tight text-[var(--text)]"
                    style={{ fontSize: isMobile ? "0.55rem" : "0.6rem" }}
                  >
                    {meta?.label ?? node.type}
                  </span>
                </div>
              );
            })}

            {/* Placed notes */}
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              return (
                <div
                  key={note.id}
                  data-canvas-item
                  data-note-id={note.id}
                  onPointerDown={(e) => {
                    if (!isEditing) startItemDrag(e, note.id, "note");
                  }}
                  onPointerMove={onItemPointerMove}
                  onPointerUp={onItemPointerUp}
                  onDoubleClick={() => setEditingNoteId(note.id)}
                  className={`absolute z-20 flex flex-col rounded-xl border border-[var(--ring)] bg-[var(--card)] p-2.5 shadow-md ${
                    isEditing
                      ? "cursor-default"
                      : "cursor-grab select-none hover:border-[var(--accent)] active:cursor-grabbing"
                  }`}
                  style={{
                    left: note.x,
                    top: note.y,
                    width: note.w,
                    height: note.h,
                    touchAction: "none",
                  }}
                >
                  <div className="flex shrink-0 items-center gap-1">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3 text-[var(--muted)]">
                      <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333z" />
                      <path d="M9.333 1.333v4h4" />
                    </svg>
                    <span className="text-[0.55rem] font-medium text-[var(--muted)]">
                      Note
                    </span>
                  </div>
                  {isEditing ? (
                    <textarea
                      autoFocus
                      value={note.text}
                      onChange={(e) => updateNoteText(note.id, e.target.value)}
                      onBlur={() => setEditingNoteId(null)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="mt-1 flex-1 resize-none rounded border border-[var(--ring)]/60 bg-transparent p-1 text-[0.6rem] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--muted)]/50"
                      placeholder="Type a note…"
                    />
                  ) : (
                    <div className="mt-1 flex-1 overflow-hidden rounded border border-dashed border-[var(--ring)]/60 p-1">
                      {note.text ? (
                        <p className="whitespace-pre-wrap text-[0.6rem] leading-relaxed text-[var(--text)]">
                          {note.text}
                        </p>
                      ) : (
                        <p className="text-[0.55rem] text-[var(--muted)]/40">
                          Double-click to edit
                        </p>
                      )}
                    </div>
                  )}
                  {/* Resize handle */}
                  <div
                    onPointerDown={(e) => onResizePointerDown(e, note.id)}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
                  >
                    <svg viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1" className="absolute bottom-1 right-1 h-2.5 w-2.5 text-[var(--muted)]/50">
                      <path d="M7 1v6H1" />
                      <path d="M7 4v3H4" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Placeholder — screen-space overlay, hidden once items exist */}
          {!hasItems && (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
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
                  Sketch your automation workflow
                </p>
                <p className="max-w-[16rem] text-[0.7rem] leading-relaxed text-[var(--muted)]/70">
                  {isMobile
                    ? "Tap a block below to place it on the canvas. Combine triggers, AI agents, and actions to map your workflow."
                    : "Drag blocks from the left panel to map out your automation idea. Combine triggers, AI agents, conditions, and actions."}
                </p>
              </div>
            </div>
          )}

          {/* Toolbar — top-right corner of canvas (screen-space) */}
          <div className="absolute right-3 top-3 z-30 flex flex-col gap-2">
            {/* Trash */}
            <div
              onClick={() => {
                if (nodes.length > 0 || notes.length > 0)
                  setShowClearConfirm(true);
              }}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-all ${
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

            {/* Add note */}
            <div
              onClick={addNote}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333z" />
                <path d="M9.333 1.333v4h4" />
                <path d="M5.333 8.667h5.334M5.333 11.333h5.334" />
              </svg>
            </div>

            {/* Mobile zoom controls */}
            {isMobile && (
              <>
                <div className="mt-1 h-px w-full bg-[var(--ring)]/30" />
                <div
                  onClick={() => mobileZoom(0.15)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] transition active:bg-[var(--surface-hover)]"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-4 w-4">
                    <path d="M4 8h8M8 4v8" />
                  </svg>
                </div>
                <div
                  onClick={() => mobileZoom(-0.15)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] transition active:bg-[var(--surface-hover)]"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-4 w-4">
                    <path d="M4 8h8" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom palette */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 border-t border-[var(--ring)] bg-[var(--surface)]/90 px-3 py-2 backdrop-blur-md">
          {BLOCKS.map(({ type, label }) => (
            <button
              key={type}
              onClick={() => addNodeAtCenter(type)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-[var(--ring)] bg-[var(--card)] px-1 py-2 transition active:bg-[var(--surface-hover)]"
            >
              <BlockIconTile type={type} size="sm" />
              <span className="text-[0.5rem] font-medium leading-tight text-[var(--text)]">
                {label}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Clear canvas confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] p-6 shadow-xl">
            <p className="text-center text-sm font-semibold text-[var(--text)]">
              Clear canvas?
            </p>
            <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
              All blocks and notes will be removed.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setNodes([]);
                  setNotes([]);
                  setShowClearConfirm(false);
                }}
                className="flex-1 cursor-pointer rounded-full border border-red-400/50 bg-red-500/15 px-4 py-2 text-xs font-medium text-red-400 transition hover:bg-red-500/25"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
