"use client";

import type { ReactNode } from "react";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";

/**
 * Global Framer Motion configuration.
 *
 * - LazyMotion keeps the motion runtime lightweight by loading a minimal feature set.
 * - reducedMotion=\"user\" respects OS/browser accessibility settings.
 */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

