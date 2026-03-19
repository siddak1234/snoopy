/**
 * Shared workflow types — safe to import from both server and client code.
 *
 * These describe the persisted JSON shape stored in the `definition` JSONB
 * column and the canvas state the UI works with at runtime.
 */

export const CURRENT_SCHEMA_VERSION = 1;

// ─── Persisted graph primitives ───────────────────────────────────────

export interface PersistedNode {
  id: string;
  type: string;
  x: number;
  y: number;
  /** Node-specific configuration (trigger config, agent params, etc.) */
  data?: Record<string, unknown>;
}

export interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  /** Edge rendering style; omitted when default */
  type?: string;
}

export interface PersistedNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

export interface PersistedViewport {
  x: number;
  y: number;
  zoom: number;
}

/** The JSON object stored in the `definition` column. */
export interface WorkflowDefinition {
  schemaVersion: number;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  notes: PersistedNote[];
  viewport?: PersistedViewport;
}

// ─── Canvas runtime state (superset of persisted data) ────────────────

export interface CanvasNode {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  [key: string]: unknown;
}

export interface CanvasNote {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  [key: string]: unknown;
}

export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

/** What the builder component hands to the save layer. */
export interface CanvasState {
  nodes: CanvasNode[];
  edges?: CanvasEdge[];
  notes?: CanvasNote[];
  viewport?: CanvasViewport;
}
