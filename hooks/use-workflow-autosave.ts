"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CanvasState } from "@/lib/workflow-types";

const DEFAULT_DEBOUNCE_MS = 3_000;

/**
 * Debounced autosave hook for the workflow builder.
 *
 * Call `markDirty(state)` whenever the canvas changes meaningfully (e.g. on
 * pointer-up after a drag, on node add/remove, on edge change — NOT on every
 * pixel of a drag move). The hook debounces writes so only the latest state
 * is persisted after the user pauses.
 *
 * The server action already performs hash comparison and skips the DB write
 * when the definition hasn't changed, so even if markDirty fires too often
 * the cost is a lightweight RPC, not a DB UPDATE.
 */
export function useWorkflowAutosave(
  workflowId: string | null,
  saveFn: (
    id: string,
    state: CanvasState,
  ) => Promise<{ ok: boolean; saved?: boolean }>,
  debounceMs: number = DEFAULT_DEBOUNCE_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef<CanvasState | null>(null);
  const workflowIdRef = useRef(workflowId);
  workflowIdRef.current = workflowId;

  const flush = useCallback(async () => {
    const id = workflowIdRef.current;
    const state = pendingRef.current;
    if (!id || !state || savingRef.current) return;

    savingRef.current = true;
    pendingRef.current = null;
    try {
      await saveFn(id, state);
    } finally {
      savingRef.current = false;
    }

    if (pendingRef.current) flush();
  }, [saveFn]);

  const markDirty = useCallback(
    (state: CanvasState) => {
      if (!workflowIdRef.current) return;
      pendingRef.current = state;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, debounceMs);
    },
    [flush, debounceMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, [flush]);

  return { markDirty };
}
