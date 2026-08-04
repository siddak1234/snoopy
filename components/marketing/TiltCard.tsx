"use client";

import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Subtle 3D pointer tilt (±5°) around the hero's pipeline window — mouse
 * only, disabled under reduced motion (matching the design's behavior).
 */
export function TiltCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reduceMotion || event.pointerType !== "mouse") return;
    const rect = el.getBoundingClientRect();
    const dx = (event.clientX - rect.left) / rect.width - 0.5;
    const dy = (event.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1200px) rotateY(${dx * 5}deg) rotateX(${dy * -5}deg)`;
  };

  const onPointerLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "perspective(1200px)";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={`transition-transform duration-150 ease-out will-change-transform motion-reduce:transition-none ${className}`.trim()}
      style={{ transform: "perspective(1200px)" }}
    >
      {children}
    </div>
  );
}
