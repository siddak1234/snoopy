"use client";

import type { ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";
import type { Variants } from "framer-motion";
import { fadeInUp } from "@/lib/motion";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  variants?: Variants;
};

export default function RevealOnScroll({
  children,
  className,
  delayMs = 0,
  variants,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.12, once: true });
  const reduceMotion = useReducedMotion();
  const resolvedVariants = variants ?? fadeInUp({ y: 12, delay: delayMs / 1000 });

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={reduceMotion ? undefined : resolvedVariants}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : isInView ? "show" : "hidden"}
    >
      {children}
    </motion.div>
  );
}
