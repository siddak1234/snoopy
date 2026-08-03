"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The design's 2px scroll-progress line pinned to the top of the viewport.
 * CSS scroll-driven animation where supported; a passive scroll listener
 * everywhere else. (Support is detected after mount, so the bar starts empty
 * either way — matching its scaleX(0) initial state.)
 */
export function ScrollProgressBar() {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"css" | "js" | null>(null);

  useEffect(() => {
    setMode(
      typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()")
        ? "css"
        : "js",
    );
  }, []);

  useEffect(() => {
    if (mode !== "js") return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      el.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mode]);

  return (
    <div
      ref={ref}
      aria-hidden
      className={`fixed top-0 right-0 left-0 z-[70] h-0.5 origin-left scale-x-0 bg-[linear-gradient(to_right,var(--color-accent),var(--color-accent-300))] ${
        mode === "css"
          ? "[animation:progress-grow_linear_both] [animation-timeline:scroll()]"
          : ""
      }`}
    />
  );
}
