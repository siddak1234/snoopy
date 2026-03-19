import { createHash } from "crypto";

import {
  CURRENT_SCHEMA_VERSION,
  type CanvasState,
  type PersistedNode,
  type PersistedEdge,
  type PersistedNote,
  type WorkflowDefinition,
} from "@/lib/workflow-types";

// Re-export types so consumers can import everything from one place on the server
export type { CanvasState, WorkflowDefinition } from "@/lib/workflow-types";
export { CURRENT_SCHEMA_VERSION } from "@/lib/workflow-types";

// ─── Property allow-lists ─────────────────────────────────────────────
// Only these keys survive serialization. Everything else (selection state,
// drag handles, measured dimensions, animation flags…) is stripped.

const NODE_KEYS: ReadonlySet<string> = new Set(["id", "type", "x", "y", "data"]);
const EDGE_KEYS: ReadonlySet<string> = new Set(["id", "source", "target", "type"]);
const NOTE_KEYS: ReadonlySet<string> = new Set(["id", "x", "y", "w", "h", "text"]);

function pick<T extends Record<string, unknown>>(
  obj: T,
  keys: ReadonlySet<string>,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  }
  return out as Partial<T>;
}

// ─── Serialize (canvas → storage) ─────────────────────────────────────

export function serializeWorkflowForStorage(
  state: CanvasState,
): WorkflowDefinition {
  const nodes: PersistedNode[] = state.nodes.map((n) => {
    const p = pick(n, NODE_KEYS) as PersistedNode;
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    if (p.data && Object.keys(p.data).length === 0) delete p.data;
    return p;
  });

  const edges: PersistedEdge[] = (state.edges ?? []).map(
    (e) => pick(e, EDGE_KEYS) as PersistedEdge,
  );

  const notes: PersistedNote[] = (state.notes ?? []).map((n) => {
    const p = pick(n, NOTE_KEYS) as PersistedNote;
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    p.w = Math.round(p.w);
    p.h = Math.round(p.h);
    return p;
  });

  const def: WorkflowDefinition = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes,
    edges,
    notes,
  };

  if (state.viewport && !isDefaultViewport(state.viewport)) {
    def.viewport = {
      x: Math.round(state.viewport.x),
      y: Math.round(state.viewport.y),
      zoom: Math.round(state.viewport.zoom * 100) / 100,
    };
  }

  return def;
}

function isDefaultViewport(vp: { x: number; y: number; zoom: number }): boolean {
  return vp.x === 0 && vp.y === 0 && vp.zoom === 1;
}

// ─── Deserialize (storage → canvas-ready) ─────────────────────────────

export function deserializeWorkflowFromStorage(
  raw: unknown,
): WorkflowDefinition {
  const def = raw as WorkflowDefinition;
  return {
    schemaVersion: def.schemaVersion ?? 1,
    nodes: Array.isArray(def.nodes) ? def.nodes : [],
    edges: Array.isArray(def.edges) ? def.edges : [],
    notes: Array.isArray(def.notes) ? def.notes : [],
    viewport: def.viewport ?? undefined,
  };
}

// ─── Content hash ─────────────────────────────────────────────────────
// Truncated SHA-256 (16 hex chars = 64 bits). Collisions are astronomically
// unlikely at workflow scale and this is only used to skip redundant writes,
// not for security. Keeps the column small.

export function hashDefinition(def: WorkflowDefinition): string {
  return createHash("sha256")
    .update(JSON.stringify(def))
    .digest("hex")
    .slice(0, 16);
}

// ─── Helpers ──────────────────────────────────────────────────────────

export function emptyDefinition(): WorkflowDefinition {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: [],
    edges: [],
    notes: [],
  };
}
