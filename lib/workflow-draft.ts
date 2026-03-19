/**
 * Client-side temporary draft persistence for anonymous/in-progress workflows.
 *
 * Used when a logged-out user clicks Save — we stash the full canvas state in
 * sessionStorage, redirect to auth, and restore it on return. This file is
 * client-only (no Node APIs).
 */

import type { CanvasState } from "@/lib/workflow-types";

const STORAGE_KEY = "snoopy:pending-workflow-draft";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface PendingDraft {
  state: CanvasState;
  name?: string;
  savedAt: number;
  /** If true, the save-naming modal should reopen after auth return. */
  saveIntent: boolean;
}

export function savePendingDraft(
  state: CanvasState,
  opts?: { name?: string; saveIntent?: boolean },
): void {
  try {
    const draft: PendingDraft = {
      state,
      name: opts?.name,
      savedAt: Date.now(),
      saveIntent: opts?.saveIntent ?? true,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // sessionStorage may be unavailable (private browsing quota, etc.)
  }
}

export function getPendingDraft(): PendingDraft | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const draft: PendingDraft = JSON.parse(raw);
    if (Date.now() - draft.savedAt > TTL_MS) {
      clearPendingDraft();
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearPendingDraft(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
