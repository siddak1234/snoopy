"use client";

import type { ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
};

export default function RevealOnScroll({
  children,
  className,
  delayMs = 0,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.12, once: true });
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={reduceMotion ? undefined : isInView ? { opacity: 1, y: 0 } : undefined}
      transition={
        reduceMotion
          ? undefined
          : {
              duration: 0.42,
              ease: [0.2, 0.9, 0.2, 1],
              delay: delayMs / 1000,
            }
      }
    >
      {children}
    </motion.div>
  );
}
