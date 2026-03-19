/**
 * Bridges React Flow runtime types ↔ our CanvasState/WorkflowDefinition types.
 *
 * React Flow stores node positions as `position: { x, y }` and mixes workflow
 * nodes and sticky-note nodes in a single `nodes[]` array. Our persistence
 * layer uses flat `x, y` and separates workflow nodes from notes.
 *
 * These helpers handle the translation in both directions.
 */

import type { Node, Edge, Viewport } from "@xyflow/react";
import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  CanvasNote,
  WorkflowDefinition,
} from "@/lib/workflow-types";

// ─── React Flow → CanvasState (for saving) ────────────────────────────

const DEFAULT_NOTE_W = 140;
const DEFAULT_NOTE_H = 90;

export function reactFlowToCanvasState(
  nodes: Node[],
  edges: Edge[],
  viewport?: Viewport,
): CanvasState {
  const canvasNodes: CanvasNode[] = [];
  const canvasNotes: CanvasNote[] = [];

  for (const node of nodes) {
    if (node.type === "note") {
      canvasNotes.push({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        w: DEFAULT_NOTE_W,
        h: DEFAULT_NOTE_H,
        text: (node.data as { text?: string })?.text ?? "",
      });
    } else {
      canvasNodes.push({
        id: node.id,
        type: node.type ?? "workflow",
        x: node.position.x,
        y: node.position.y,
        data: node.data as Record<string, unknown>,
      });
    }
  }

  const canvasEdges: CanvasEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    ...(e.type && e.type !== "deletable" && { type: e.type }),
  }));

  return {
    nodes: canvasNodes,
    edges: canvasEdges,
    notes: canvasNotes.length > 0 ? canvasNotes : undefined,
    viewport,
  };
}

// ─── WorkflowDefinition → React Flow (for loading) ───────────────────

export function definitionToReactFlow(def: WorkflowDefinition): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];

  for (const n of def.nodes) {
    nodes.push({
      id: n.id,
      type: "workflow",
      position: { x: n.x, y: n.y },
      data: n.data ?? { label: n.type, blockType: n.type },
    });
  }

  for (const note of def.notes) {
    nodes.push({
      id: note.id,
      type: "note",
      position: { x: note.x, y: note.y },
      data: { text: note.text },
    });
  }

  const edges: Edge[] = def.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type ?? "deletable",
  }));

  return { nodes, edges };
}

// ─── CanvasState → React Flow (for restoring drafts from localStorage)

export function canvasStateToReactFlow(state: CanvasState): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];

  for (const n of state.nodes) {
    nodes.push({
      id: n.id,
      type: n.type === "workflow" ? "workflow" : "workflow",
      position: { x: n.x, y: n.y },
      data: ((n as Record<string, unknown>).data as Record<string, unknown> | undefined) ?? { label: n.type, blockType: n.type } as Record<string, unknown>,
    });
  }

  for (const note of state.notes ?? []) {
    nodes.push({
      id: note.id,
      type: "note",
      position: { x: note.x, y: note.y },
      data: { text: note.text },
    });
  }

  const edges: Edge[] = (state.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: e.type ?? "deletable",
  }));

  return { nodes, edges };
}
