import type { Variants } from "framer-motion";

/**
 * Autom8x motion foundation.
 *
 * Design goals:
 * - premium + precise (no bouncy springs by default)
 * - consistent easing + durations
 * - composable variants for sections and components
 * - reduced-motion friendly (handled by MotionConfig in `MotionProvider`)
 */

export const easings = {
  // Crisp but soft — reads as “enterprise” rather than playful.
  premium: [0.2, 0.9, 0.2, 1] as const,
} as const;

export const durations = {
  fast: 0.18,
  base: 0.42,
  slow: 0.7,
} as const;

/** Fade + subtle upward motion for section/content reveals. */
export function fadeInUp(opts?: {
  y?: number;
  duration?: number;
  delay?: number;
}): Variants {
  const y = opts?.y ?? 12;
  const duration = opts?.duration ?? durations.base;
  const delay = opts?.delay ?? 0;

  return {
    hidden: { opacity: 0, y },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: easings.premium },
    },
  };
}

/** Stagger children entrance for grids/lists. */
export function staggerContainer(opts?: {
  stagger?: number;
  delayChildren?: number;
}): Variants {
  const stagger = opts?.stagger ?? 0.06;
  const delayChildren = opts?.delayChildren ?? 0;
  return {
    hidden: {},
    show: {
      transition: {
        staggerChildren: stagger,
        delayChildren,
      },
    },
  };
}
