"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  ConnectionLineType,
} from "@xyflow/react";
import type { Connection, Edge, EdgeTypes, Node, NodeTypes } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { WorkflowNode } from "@/components/builder/WorkflowNode";
import { StickyNoteNode } from "@/components/builder/StickyNoteNode";
import { DeletableEdge } from "@/components/builder/DeletableEdge";
import { BlockPalette } from "@/components/builder/BlockPalette";
import { BlockIconTile } from "@/components/builder/block-icons";
import {
  BLOCK_DEFS,
  type BlockType,
  type WorkflowNodeData,
  type StickyNoteData,
} from "@/components/builder/types";

const MOBILE_BP = 640;

const nodeTypes: NodeTypes = {
  workflow: WorkflowNode,
  note: StickyNoteNode,
};

const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
};

const defaultEdgeOptions = {
  type: "deletable" as const,
  style: { strokeWidth: 2 },
};

export default function AutomationBuilderPage() {
  return (
    <ReactFlowProvider>
      <AutomationBuilder />
    </ReactFlowProvider>
  );
}

function AutomationBuilder() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [trashHover, setTrashHover] = useState(false);
  const { screenToFlowPosition } = useReactFlow();
  const nextId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const isValidConnection = useCallback(
    (connection: Edge | Connection) => connection.source !== connection.target,
    [],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge(connection, eds));
    },
    [setEdges],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const blockType = event.dataTransfer.getData(
        "application/reactflow",
      ) as BlockType;
      if (!blockType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const label =
        BLOCK_DEFS.find((b) => b.type === blockType)?.label ?? blockType;

      setNodes((nds) => [
        ...nds,
        {
          id: `node_${nextId.current++}`,
          type: "workflow",
          position,
          data: { label, blockType } satisfies WorkflowNodeData,
        },
      ]);
    },
    [screenToFlowPosition, setNodes],
  );

  const addNodeAtCenter = useCallback(
    (blockType: BlockType) => {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const position = screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
      const label =
        BLOCK_DEFS.find((b) => b.type === blockType)?.label ?? blockType;

      setNodes((nds) => [
        ...nds,
        {
          id: `node_${nextId.current++}`,
          type: "workflow",
          position: { x: position.x - 70, y: position.y - 20 },
          data: { label, blockType } satisfies WorkflowNodeData,
        },
      ]);
    },
    [screenToFlowPosition, setNodes],
  );

  const addNote = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const position = screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setNodes((nds) => [
      ...nds,
      {
        id: `note_${nextId.current++}`,
        type: "note",
        position: { x: position.x - 70, y: position.y - 45 },
        data: { text: "" } satisfies StickyNoteData,
      },
    ]);
  }, [screenToFlowPosition, setNodes]);

  const isOverTrash = useCallback((event: React.MouseEvent) => {
    const el = trashRef.current;
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const pad = 10;
    return (
      event.clientX >= rect.left - pad &&
      event.clientX <= rect.right + pad &&
      event.clientY >= rect.top - pad &&
      event.clientY <= rect.bottom + pad
    );
  }, []);

  const onNodeDrag = useCallback(
    (event: React.MouseEvent) => {
      setTrashHover(isOverTrash(event));
    },
    [isOverTrash],
  );

  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isOverTrash(event)) {
        setNodes((nds) => nds.filter((n) => n.id !== node.id));
        setEdges((eds) =>
          eds.filter((e) => e.source !== node.id && e.target !== node.id),
        );
      }
      setTrashHover(false);
    },
    [isOverTrash, setNodes, setEdges],
  );

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setShowClearConfirm(false);
  }, [setNodes, setEdges]);

  const hasItems = nodes.length > 0;

  return (
    <>
      <style>{`html,body{overflow:hidden!important}`}</style>

      {/* Canvas — fixed to viewport */}
      <div
        className="fixed z-30 flex overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)]"
        style={{
          top: "5.5rem",
          left: isMobile ? "0.5rem" : "1rem",
          right: isMobile ? "0.5rem" : "1rem",
          bottom: isMobile ? "3.75rem" : "0.5rem",
        }}
      >
        {/* Desktop palette */}
        {!isMobile && <BlockPalette />}

        {/* React Flow canvas */}
        <div ref={wrapperRef} className="relative h-full min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeDrag={onNodeDrag}
            onNodeDragStop={onNodeDragStop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            isValidConnection={isValidConnection}
            connectionLineType={ConnectionLineType.SmoothStep}
            connectionLineStyle={{ stroke: "var(--accent)", strokeWidth: 2 }}
            snapToGrid
            snapGrid={[14, 14]}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
            proOptions={{ hideAttribution: true }}
            className="workflow-canvas"
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={28}
              size={1}
              color="var(--ring)"
            />
            {!isMobile && (
              <>
                <Controls
                  position="bottom-left"
                  showInteractive={false}
                />
                <MiniMap
                  position="bottom-right"
                  pannable
                  zoomable
                  nodeColor="var(--accent)"
                  maskColor="rgba(0,0,0,0.06)"
                />
              </>
            )}
          </ReactFlow>

          {/* Title badge */}
          <div className="absolute left-3 top-3 z-10 hidden flex-col items-start gap-1.5 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] px-4 py-2.5 shadow-sm sm:inline-flex">
            <h1 className="text-sm font-semibold leading-tight tracking-tight text-[var(--text)]">
              <span className="block">Automation</span>
              <span className="block">Builder</span>
            </h1>
            <span className="rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--step-pill-text)]">
              Preview
            </span>
          </div>

          {/* Toolbar — top-right */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
            {/* Trash / clear */}
            <button
              ref={trashRef}
              type="button"
              onClick={() => {
                if (hasItems) setShowClearConfirm(true);
              }}
              className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border transition-all ${
                trashHover
                  ? "scale-110 border-red-400 bg-red-500/20 text-red-400"
                  : hasItems
                    ? "border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] hover:border-red-400 hover:bg-red-500/10 hover:text-red-400"
                    : "pointer-events-none border-[var(--ring)] bg-[var(--surface)]/50 text-[var(--muted)]/40"
              }`}
              aria-label="Clear canvas"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 0 1 1.334-1.334h2.666a1.333 1.333 0 0 1 1.334 1.334V4M6.667 7.333v4M9.333 7.333v4" />
                <path d="M3.333 4l.667 9.333a1.333 1.333 0 0 0 1.333 1.334h5.334a1.333 1.333 0 0 0 1.333-1.334L12.667 4" />
              </svg>
            </button>

            {/* Add note */}
            <button
              type="button"
              onClick={addNote}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              aria-label="Add note"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M9.333 1.333H4a1.333 1.333 0 0 0-1.333 1.334v10.666A1.333 1.333 0 0 0 4 14.667h8a1.333 1.333 0 0 0 1.333-1.334V5.333z" />
                <path d="M9.333 1.333v4h4" />
                <path d="M5.333 8.667h5.334M5.333 11.333h5.334" />
              </svg>
            </button>
          </div>

          {/* Empty state */}
          {!hasItems && (
            <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
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
                  Build your automation workflow
                </p>
                <p className="max-w-[18rem] text-[0.7rem] leading-relaxed text-[var(--muted)]/70">
                  {isMobile
                    ? "Tap a block below to place it. Connect blocks by dragging between handles."
                    : "Drag blocks from the left panel. Connect them by dragging from one handle to another."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom palette */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-2 border-t border-[var(--ring)] bg-[var(--surface)]/90 px-3 py-2 backdrop-blur-md">
          {BLOCK_DEFS.map(({ type, label }) => (
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

      {/* Clear confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-72 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] p-6 shadow-xl">
            <p className="text-center text-sm font-semibold text-[var(--text)]">
              Clear canvas?
            </p>
            <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
              All nodes and connections will be removed.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={clearCanvas}
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
