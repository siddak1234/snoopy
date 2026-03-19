"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import { useAppSession } from "@/hooks/use-app-session";
import {
  reactFlowToCanvasState,
  definitionToReactFlow,
  canvasStateToReactFlow,
} from "@/lib/workflow-bridge";
import {
  savePendingDraft,
  getPendingDraft,
  clearPendingDraft,
} from "@/lib/workflow-draft";
import {
  createWorkflowAction,
  saveWorkflowAction,
  getWorkflowAction,
} from "@/app/account/workflows/actions";

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
      <Suspense fallback={null}>
        <AutomationBuilder />
      </Suspense>
    </ReactFlowProvider>
  );
}

function AutomationBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramId = searchParams.get("id");

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [trashHover, setTrashHover] = useState(false);

  // Save flow state
  const [workflowId, setWorkflowId] = useState<string | null>(paramId);
  const [workflowName, setWorkflowName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [nameInput, setNameInput] = useState("");

  const { screenToFlowPosition, getViewport } = useReactFlow();
  const { data: session, status: authStatus } = useAppSession();
  const nextId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const initializedRef = useRef(false);

  // ─── Mobile detection ───────────────────────────────────────────────

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // ─── Load saved workflow from URL param ─────────────────────────────

  useEffect(() => {
    if (!paramId || initializedRef.current) return;
    if (authStatus === "loading") return;

    initializedRef.current = true;

    if (authStatus !== "authenticated") return;

    (async () => {
      const result = await getWorkflowAction(paramId);
      if (!result.ok) return;
      const { nodes: rfNodes, edges: rfEdges } = definitionToReactFlow(
        result.workflow.definition,
      );
      setNodes(rfNodes);
      setEdges(rfEdges);
      setWorkflowId(result.workflow.id);
      setWorkflowName(result.workflow.name);

      const maxId = rfNodes.reduce((max, n) => {
        const num = parseInt(n.id.replace(/\D/g, ""), 10);
        return Number.isNaN(num) ? max : Math.max(max, num + 1);
      }, 0);
      nextId.current = maxId;
    })();
  }, [paramId, authStatus, setNodes, setEdges]);

  // ─── Restore pending draft after auth return ────────────────────────

  useEffect(() => {
    if (initializedRef.current) return;
    if (authStatus === "loading") return;
    if (paramId) return; // URL param takes precedence

    const draft = getPendingDraft();
    if (!draft) {
      initializedRef.current = true;
      return;
    }

    initializedRef.current = true;

    const { nodes: rfNodes, edges: rfEdges } = canvasStateToReactFlow(draft.state);
    setNodes(rfNodes);
    setEdges(rfEdges);

    const maxId = rfNodes.reduce((max, n) => {
      const num = parseInt(n.id.replace(/\D/g, ""), 10);
      return Number.isNaN(num) ? max : Math.max(max, num + 1);
    }, 0);
    nextId.current = maxId;

    if (draft.name) setNameInput(draft.name);

    if (draft.saveIntent && authStatus === "authenticated") {
      clearPendingDraft();
      setTimeout(() => setShowSaveModal(true), 400);
    } else {
      clearPendingDraft();
    }
  }, [authStatus, paramId, setNodes, setEdges]);

  // ─── Clear save status after delay ──────────────────────────────────

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [saveStatus]);

  // ─── Canvas callbacks ───────────────────────────────────────────────

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
          position: { x: position.x - 40, y: position.y - 40 },
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
    setWorkflowId(null);
    setWorkflowName("");
  }, [setNodes, setEdges]);

  // ─── Save flow ──────────────────────────────────────────────────────

  const getCanvasState = useCallback(() => {
    return reactFlowToCanvasState(nodes, edges, getViewport());
  }, [nodes, edges, getViewport]);

  const handleSaveClick = useCallback(() => {
    if (nodes.length === 0) return;

    if (authStatus !== "authenticated") {
      setShowAuthPrompt(true);
      return;
    }

    if (workflowId) {
      // Existing workflow — update directly
      (async () => {
        setSaveStatus("saving");
        const result = await saveWorkflowAction(workflowId, getCanvasState());
        if (result.ok) {
          setSaveStatus("saved");
        } else {
          setSaveError(result.error);
          setSaveStatus("error");
        }
      })();
    } else {
      // New workflow — ask for name
      setNameInput("");
      setShowSaveModal(true);
    }
  }, [nodes, authStatus, workflowId, getCanvasState]);

  const handleSaveConfirm = useCallback(async () => {
    const name = nameInput.trim();
    if (name.length < 2) return;

    setSaveStatus("saving");
    setShowSaveModal(false);

    const result = await createWorkflowAction(name, {
      canvasState: getCanvasState(),
    });

    if (result.ok) {
      setWorkflowId(result.workflowId);
      setWorkflowName(name);
      setSaveStatus("saved");
      router.replace(`/automation-builder?id=${result.workflowId}`, {
        scroll: false,
      });
    } else {
      setSaveError(result.error);
      setSaveStatus("error");
    }
  }, [nameInput, getCanvasState, router]);

  const handleAuthRedirect = useCallback(() => {
    const canvasState = getCanvasState();
    savePendingDraft(canvasState, {
      name: nameInput || undefined,
      saveIntent: true,
    });
    setShowAuthPrompt(false);
    window.location.href = `/login?callbackUrl=${encodeURIComponent("/automation-builder")}`;
  }, [getCanvasState, nameInput]);

  const handleSignupRedirect = useCallback(() => {
    const canvasState = getCanvasState();
    savePendingDraft(canvasState, {
      name: nameInput || undefined,
      saveIntent: true,
    });
    setShowAuthPrompt(false);
    window.location.href = `/signup?callbackUrl=${encodeURIComponent("/automation-builder")}`;
  }, [getCanvasState, nameInput]);

  // ─── Render ─────────────────────────────────────────────────────────

  const hasItems = nodes.length > 0;

  return (
    <>
      <style>{`html,body{overflow:hidden!important}`}</style>

      {/* Canvas */}
      <div
        className="fixed z-30 flex overflow-hidden rounded-2xl border border-[var(--ring)] bg-[var(--card)]"
        style={{
          top: "5.5rem",
          left: isMobile ? "0.5rem" : "1rem",
          right: isMobile ? "0.5rem" : "1rem",
          bottom: isMobile ? "3.75rem" : "0.5rem",
        }}
      >
        {!isMobile && <BlockPalette />}

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
                <Controls position="bottom-left" showInteractive={false} />
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
              {workflowName ? (
                <>
                  <span className="block">{workflowName}</span>
                  <span className="block text-[0.6rem] font-medium text-[var(--muted)]">
                    Automation Builder
                  </span>
                </>
              ) : (
                <>
                  <span className="block">Automation</span>
                  <span className="block">Builder</span>
                </>
              )}
            </h1>
            <span className="rounded-full border border-[var(--ring)] bg-[var(--step-pill-bg)] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--step-pill-text)]">
              {workflowId ? "Saved" : "Draft"}
            </span>
          </div>

          {/* Toolbar — top-right */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
            {/* Save workflow */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!hasItems || saveStatus === "saving"}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                saveStatus === "saved"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-400"
                  : saveStatus === "saving"
                    ? "pointer-events-none border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)]"
                    : hasItems
                      ? "cursor-pointer border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                      : "pointer-events-none border-[var(--ring)] bg-[var(--surface)]/50 text-[var(--muted)]/40"
              }`}
              aria-label={workflowId ? "Save workflow" : "Save workflow (name required)"}
            >
              {saveStatus === "saving" ? (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : saveStatus === "saved" ? (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12.667 14H3.333A1.333 1.333 0 0 1 2 12.667V3.333A1.333 1.333 0 0 1 3.333 2h7.334L14 5.333v7.334A1.333 1.333 0 0 1 12.667 14z" />
                  <path d="M11.333 14V9.333H4.667V14" />
                  <path d="M4.667 2v3.333h5.333" />
                </svg>
              )}
            </button>

            {/* Trash */}
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
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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

      {/* ── Save naming modal ─────────────────────────────────────────── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] p-6 shadow-xl">
            <p className="text-center text-sm font-semibold text-[var(--text)]">
              Save Workflow
            </p>
            <p className="mt-1.5 text-center text-xs text-[var(--muted)]">
              Give your workflow a name to save it to your account.
            </p>
            <input
              type="text"
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameInput.trim().length >= 2)
                  handleSaveConfirm();
              }}
              placeholder="e.g. Lead Nurture Flow"
              className="mt-4 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)]/50 outline-none transition focus:ring-2 focus:ring-[var(--accent-strong)]"
              maxLength={100}
            />
            {saveError && (
              <p className="mt-2 text-center text-xs text-red-400">{saveError}</p>
            )}
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveError("");
                }}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={nameInput.trim().length < 2}
                className="flex-1 cursor-pointer rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:pointer-events-none disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth prompt modal ─────────────────────────────────────────── */}
      {showAuthPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] p-6 shadow-xl">
            <p className="text-center text-sm font-semibold text-[var(--text)]">
              Sign in to save
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-[var(--muted)]">
              Your workflow will be preserved. After signing in you'll return here to name and save it.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                onClick={handleAuthRedirect}
                className="w-full cursor-pointer rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
              >
                Log In
              </button>
              <button
                onClick={handleSignupRedirect}
                className="w-full cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Sign Up
              </button>
              <button
                onClick={() => setShowAuthPrompt(false)}
                className="mt-1 cursor-pointer text-[0.65rem] text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Continue without saving
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clear confirmation modal ──────────────────────────────────── */}
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
