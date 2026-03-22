"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
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
  listWorkflowsAction,
  saveWorkflowAction,
  getWorkflowAction,
  type WorkflowDetail,
  type WorkflowListItem,
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

type PendingSwitchTarget =
  | { kind: "new" }
  | { kind: "existing"; workflow: WorkflowDetail };

function canvasSignature(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify(reactFlowToCanvasState(nodes, edges));
}

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
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [switchError, setSwitchError] = useState("");
  const [isSwitching, setIsSwitching] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(false);
  const [workflowOptions, setWorkflowOptions] = useState<WorkflowListItem[]>([]);
  const [menuError, setMenuError] = useState("");
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitchTarget | null>(null);
  const [postSaveSwitch, setPostSaveSwitch] = useState<PendingSwitchTarget | null>(null);
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);

  const { screenToFlowPosition, getViewport } = useReactFlow();
  const { status: authStatus } = useAppSession();
  const nextId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const workflowMenuRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const autosaveRequestRef = useRef(0);

  // ─── Mobile detection ───────────────────────────────────────────────

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BP - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const applyWorkflowToCanvas = useCallback(
    (workflow: WorkflowDetail) => {
      const { nodes: rfNodes, edges: rfEdges } = definitionToReactFlow(
        workflow.definition,
      );
      setNodes(rfNodes);
      setEdges(rfEdges);
      setWorkflowId(workflow.id);
      setWorkflowName(workflow.name);
      setSaveStatus("idle");
      setSaveError("");
      setLastSavedSignature(canvasSignature(rfNodes, rfEdges));

      const maxId = rfNodes.reduce((max, n) => {
        const num = parseInt(n.id.replace(/\D/g, ""), 10);
        return Number.isNaN(num) ? max : Math.max(max, num + 1);
      }, 0);
      nextId.current = maxId;
    },
    [setNodes, setEdges],
  );

  const resetToNewWorkflow = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setWorkflowId(null);
    setWorkflowName("");
    setSaveStatus("idle");
    setSaveError("");
    setLastSavedSignature(null);
    nextId.current = 0;
  }, [setNodes, setEdges]);

  const loadWorkflowOptions = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    const result = await listWorkflowsAction();
    if (!result.ok) {
      setMenuError(result.error);
      return;
    }
    setMenuError("");
    setWorkflowOptions(result.workflows);
  }, [authStatus]);

  const toggleWorkflowMenu = useCallback(() => {
    setWorkflowMenuOpen((open) => {
      const next = !open;
      if (next) {
        setMenuError("");
        setSwitchError("");
        void loadWorkflowOptions();
      }
      return next;
    });
  }, [loadWorkflowOptions]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    void loadWorkflowOptions();
  }, [authStatus, loadWorkflowOptions]);

  useEffect(() => {
    if (!workflowMenuOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!workflowMenuRef.current) return;
      if (workflowMenuRef.current.contains(event.target as globalThis.Node)) return;
      setWorkflowMenuOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [workflowMenuOpen]);

  // ─── Load saved workflow from URL param ─────────────────────────────

  useEffect(() => {
    if (!paramId || initializedRef.current) return;
    if (authStatus === "loading") return;

    initializedRef.current = true;

    if (authStatus !== "authenticated") return;

    (async () => {
      const result = await getWorkflowAction(paramId);
      if (!result.ok) return;
      applyWorkflowToCanvas(result.workflow);
    })();
  }, [paramId, authStatus, applyWorkflowToCanvas]);

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
    setLastSavedSignature(null);

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
  }, [setNodes, setEdges]);

  // ─── Save flow ──────────────────────────────────────────────────────

  const getCanvasState = useCallback(() => {
    return reactFlowToCanvasState(nodes, edges, getViewport());
  }, [nodes, edges, getViewport]);

  const handleSaveClick = useCallback(() => {
    if (nodes.length === 0 && !workflowId) return;
    setSaveError("");

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
          setLastSavedSignature(canvasSignature(nodes, edges));
        } else {
          setSaveError(result.error);
          setSaveStatus("error");
        }
      })();
    } else {
      // New workflow — ask for name
      setNameInput("");
      setSaveStatus("idle");
      setSaveError("");
      setShowSaveModal(true);
    }
  }, [nodes, edges, authStatus, workflowId, getCanvasState]);

  const handleSaveConfirm = useCallback(async () => {
    const name = nameInput.trim();
    if (name.length < 2) return;

    setSaveStatus("saving");
    setSaveError("");

    const result = await createWorkflowAction(name, {
      canvasState: getCanvasState(),
    });

    if (result.ok) {
      const currentSignature = canvasSignature(nodes, edges);
      const nowIso = new Date().toISOString();
      setWorkflowId(result.workflowId);
      setWorkflowName(name);
      setSaveStatus("saved");
      setLastSavedSignature(currentSignature);
      setWorkflowOptions((prev) => [
        {
          id: result.workflowId,
          name,
          description: null,
          status: "draft",
          nodeCount: nodes.filter((n) => n.type !== "note").length,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...prev.filter((w) => w.id !== result.workflowId),
      ]);
      setShowSaveModal(false);

      if (postSaveSwitch) {
        if (postSaveSwitch.kind === "existing") {
          applyWorkflowToCanvas(postSaveSwitch.workflow);
          router.replace(`/automation-builder?id=${postSaveSwitch.workflow.id}`, {
            scroll: false,
          });
        } else {
          resetToNewWorkflow();
          router.replace("/automation-builder", { scroll: false });
        }
        setPostSaveSwitch(null);
      } else {
        router.replace(`/automation-builder?id=${result.workflowId}`, {
          scroll: false,
        });
      }
      await loadWorkflowOptions();
    } else {
      setSaveError(result.error);
      setSaveStatus("error");
    }
  }, [
    nameInput,
    nodes,
    edges,
    getCanvasState,
    postSaveSwitch,
    applyWorkflowToCanvas,
    loadWorkflowOptions,
    resetToNewWorkflow,
    router,
  ]);

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

  const currentSignature = useMemo(() => canvasSignature(nodes, edges), [nodes, edges]);
  const hasUnsavedChanges = useMemo(() => {
    if (workflowId) {
      if (lastSavedSignature === null) return false;
      return currentSignature !== lastSavedSignature;
    }
    return nodes.length > 0;
  }, [workflowId, lastSavedSignature, currentSignature, nodes.length]);

  const executeWorkflowSwitch = useCallback(
    (target: PendingSwitchTarget) => {
      setShowSwitchConfirm(false);
      setPendingSwitch(null);
      setSwitchError("");
      setSaveStatus("idle");
      setSaveError("");

      if (target.kind === "existing") {
        applyWorkflowToCanvas(target.workflow);
        router.replace(`/automation-builder?id=${target.workflow.id}`, {
          scroll: false,
        });
        return;
      }

      resetToNewWorkflow();
      router.replace("/automation-builder", { scroll: false });
    },
    [applyWorkflowToCanvas, resetToNewWorkflow, router],
  );

  const handleWorkflowSelection = useCallback(
    async (targetId: string | null) => {
      if (isSwitching) return;
      setWorkflowMenuOpen(false);
      setMenuError("");
      setSwitchError("");

      if (targetId === workflowId) return;

      setIsSwitching(true);
      try {
        let target: PendingSwitchTarget;

        if (!targetId) {
          target = { kind: "new" };
        } else {
          const result = await getWorkflowAction(targetId);
          if (!result.ok) {
            setSwitchError(result.error);
            return;
          }
          target = { kind: "existing", workflow: result.workflow };
        }

        if (hasUnsavedChanges) {
          setPendingSwitch(target);
          setShowSwitchConfirm(true);
          return;
        }

        executeWorkflowSwitch(target);
      } finally {
        setIsSwitching(false);
      }
    },
    [executeWorkflowSwitch, hasUnsavedChanges, isSwitching, workflowId],
  );

  const handleSwitchSave = useCallback(async () => {
    if (!pendingSwitch) return;
    setSwitchError("");

    if (!hasUnsavedChanges) {
      executeWorkflowSwitch(pendingSwitch);
      return;
    }

    if (!workflowId) {
      setPostSaveSwitch(pendingSwitch);
      setShowSwitchConfirm(false);
      setNameInput(workflowName || "");
      setSaveError("");
      setShowSaveModal(true);
      return;
    }

    setSaveStatus("saving");
    const saveResult = await saveWorkflowAction(workflowId, getCanvasState());
    if (!saveResult.ok) {
      setSaveStatus("error");
      setSwitchError(saveResult.error);
      return;
    }

    setSaveStatus("saved");
    setLastSavedSignature(canvasSignature(nodes, edges));
    executeWorkflowSwitch(pendingSwitch);
  }, [
    pendingSwitch,
    hasUnsavedChanges,
    workflowId,
    workflowName,
    getCanvasState,
    nodes,
    edges,
    executeWorkflowSwitch,
  ]);

  // ─── Autosave existing workflows on canvas changes ─────────────────

  useEffect(() => {
    if (!workflowId) return;
    if (authStatus !== "authenticated") return;
    if (!hasUnsavedChanges) return;
    if (showSaveModal || showAuthPrompt || showSwitchConfirm) return;
    if (saveStatus === "saving") return;

    let active = true;
    const signatureAtSchedule = currentSignature;
    const requestId = ++autosaveRequestRef.current;
    const timer = setTimeout(async () => {
      if (!active) return;

      setSaveStatus("saving");
      setSaveError("");

      const result = await saveWorkflowAction(workflowId, getCanvasState());
      if (!active) return;
      // Ignore stale responses from older autosave requests.
      if (requestId !== autosaveRequestRef.current) return;

      if (!result.ok) {
        setSaveError(result.error);
        setSaveStatus("error");
        return;
      }

      setLastSavedSignature(signatureAtSchedule);
      setSaveStatus("saved");
    }, 900);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    workflowId,
    authStatus,
    hasUnsavedChanges,
    currentSignature,
    showSaveModal,
    showAuthPrompt,
    showSwitchConfirm,
    saveStatus,
    getCanvasState,
  ]);

  // ─── Render ─────────────────────────────────────────────────────────

  const hasItems = nodes.length > 0;
  const canSave = hasItems || Boolean(workflowId);
  const statusLabel = workflowId
    ? hasUnsavedChanges
      ? "Not saved"
      : "Saved"
    : hasItems
      ? "Not saved"
      : "Draft";
  const statusClass =
    statusLabel === "Saved"
      ? "border-emerald-400/45 bg-emerald-500/10 text-emerald-300"
      : statusLabel === "Not saved"
        ? "border-amber-300/45 bg-amber-500/10 text-amber-200"
        : "border-[var(--ring)] bg-[var(--step-pill-bg)] text-[var(--step-pill-text)]";

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
          <div
            ref={workflowMenuRef}
            className="absolute left-3 top-3 z-10 hidden min-w-[13rem] flex-col items-start gap-1.5 rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] px-4 py-2.5 shadow-sm sm:inline-flex"
          >
            <div className="flex w-full items-center justify-between gap-2">
              <h1 className="truncate text-sm font-semibold leading-tight tracking-tight text-[var(--text)]">
                {workflowName || "Automation Builder"}
              </h1>
              <button
                type="button"
                onClick={toggleWorkflowMenu}
                disabled={authStatus !== "authenticated"}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
                  authStatus !== "authenticated"
                    ? "pointer-events-none border-[var(--ring)]/60 text-[var(--muted)]/40"
                    : "border-[var(--ring)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)]"
                }`}
                aria-label="Switch workflow"
                title="Switch workflow"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`h-3.5 w-3.5 transition ${workflowMenuOpen ? "rotate-180" : ""}`}
                >
                  <path d="m3.5 6 4.5 4 4.5-4" />
                </svg>
              </button>
            </div>
            <span className="text-[0.6rem] font-medium text-[var(--muted)]">
              Automation Builder
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] ${statusClass}`}>
              {statusLabel}
            </span>

            {workflowMenuOpen ? (
              <div className="absolute left-0 top-[calc(100%+0.45rem)] w-[17.5rem] rounded-2xl border border-[var(--ring)] bg-[var(--surface-strong)] p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => void handleWorkflowSelection(null)}
                  className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
                >
                  <span>New Workflow</span>
                  <span className="text-[0.6rem] text-[var(--muted)]">Blank</span>
                </button>
                <div className="my-1 h-px bg-[var(--ring)]/80" />
                <div className="max-h-56 overflow-y-auto pr-0.5">
                  {workflowOptions.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => void handleWorkflowSelection(wf.id)}
                      className={`mt-1 flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition ${
                        wf.id === workflowId
                          ? "bg-[var(--accent)]/14 text-[var(--accent)]"
                          : "text-[var(--text)] hover:bg-[var(--surface-hover)]"
                      }`}
                    >
                      <span className="truncate text-xs font-medium">{wf.name}</span>
                      <span className="ml-2 shrink-0 text-[0.6rem] text-[var(--muted)]">
                        {wf.nodeCount}n
                      </span>
                    </button>
                  ))}
                  {workflowOptions.length === 0 ? (
                    <p className="px-2.5 py-2 text-xs text-[var(--muted)]">
                      No saved workflows yet.
                    </p>
                  ) : null}
                </div>
                {menuError ? (
                  <p className="mt-2 px-2.5 text-[0.64rem] text-red-300">{menuError}</p>
                ) : null}
                {switchError && !showSwitchConfirm ? (
                  <p className="mt-1 px-2.5 text-[0.64rem] text-red-300">{switchError}</p>
                ) : null}
                {isSwitching ? (
                  <p className="mt-1 px-2.5 text-[0.64rem] text-[var(--muted)]">Loading workflow...</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Toolbar — top-right */}
          <div className="absolute right-3 top-3 z-10 flex flex-col gap-2">
            {/* Send (placeholder only) */}
            <button
              type="button"
              onClick={() => {}}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--text)]"
              aria-label="Send workflow"
              title="Send workflow"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M14.5 1.5 7.3 8.7" />
                <path d="m14.5 1.5-4 13L7.3 8.7.5 5.5z" />
              </svg>
            </button>

            {/* Save workflow */}
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={!canSave || saveStatus === "saving"}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
                saveStatus === "saved"
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-400"
                  : saveStatus === "saving"
                    ? "pointer-events-none border-[var(--ring)] bg-[var(--surface)]/80 text-[var(--muted)]"
                    : canSave
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

      {/* ── Switch workflow confirmation modal ───────────────────────── */}
      {showSwitchConfirm && pendingSwitch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--ring)] bg-linear-to-br from-[var(--surface)] to-[var(--surface-strong)] p-6 shadow-xl">
            <p className="text-center text-sm font-semibold text-[var(--text)]">
              Save current workflow first?
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-[var(--muted)]">
              You selected{" "}
              <span className="font-semibold text-[var(--text)]">
                {pendingSwitch.kind === "existing" ? pendingSwitch.workflow.name : "New Workflow"}
              </span>
              . Save your current canvas before switching?
            </p>
            {switchError ? (
              <p className="mt-3 text-center text-xs text-red-400">{switchError}</p>
            ) : null}
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => {
                  setShowSwitchConfirm(false);
                  setPendingSwitch(null);
                  setSwitchError("");
                }}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={() => executeWorkflowSwitch(pendingSwitch)}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)]/80 bg-[var(--surface)] px-4 py-2 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                Don&apos;t save
              </button>
              <button
                onClick={() => void handleSwitchSave()}
                className="flex-1 cursor-pointer rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
              >
                Save
              </button>
            </div>
          </div>
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
                  setPostSaveSwitch(null);
                  setSaveError("");
                }}
                disabled={saveStatus === "saving"}
                className="flex-1 cursor-pointer rounded-full border border-[var(--ring)] bg-[var(--card)] px-4 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfirm}
                disabled={nameInput.trim().length < 2 || saveStatus === "saving"}
                className="flex-1 cursor-pointer rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:pointer-events-none disabled:opacity-40"
              >
                {saveStatus === "saving" ? "Saving..." : "Save"}
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
              Your workflow will be preserved. After signing in you&apos;ll return here to name and save it.
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
