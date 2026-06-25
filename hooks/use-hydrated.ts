"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * Returns false during SSR and the initial client render, then true once
 * hydrated. Use to gate client-only UI without calling setState in an effect
 * (avoids hydration error #418 and the react-hooks/set-state-in-effect rule).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}
