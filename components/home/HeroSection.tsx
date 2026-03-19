"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import TypingHeadline from "@/components/home/TypingHeadline";
import { fadeInUp, staggerContainer, durations, easings } from "@/lib/motion";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function HeroSection() {
  const reduceMotion = useReducedMotion();

  // VERY subtle parallax — only affects background layer.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 70, damping: 18, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 70, damping: 18, mass: 0.4 });
  const bgX = useTransform(sx, (v) => `${v * 6}px`);
  const bgY = useTransform(sy, (v) => `${v * 5}px`);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (reduceMotion) return;
      // Avoid pointer-driven updates on coarse pointers / touch.
      if (e.pointerType !== "mouse") return;
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = (e.clientX - rect.left) / rect.width - 0.5;
      const dy = (e.clientY - rect.top) / rect.height - 0.5;
      mx.set(clamp(dx, -0.5, 0.5));
      my.set(clamp(dy, -0.5, 0.5));
    },
    [mx, my, reduceMotion],
  );

  const onPointerLeave = useCallback(() => {
    mx.set(0);
    my.set(0);
  }, [mx, my]);

  const contentVariants = useMemo(
    () =>
      staggerContainer({ stagger: 0.08, delayChildren: 0.05 }),
    [],
  );

  const headlineVariants = useMemo(
    () => fadeInUp({ y: 10, duration: durations.base }),
    [],
  );
  const descriptionVariants = useMemo(
    () => fadeInUp({ y: 10, duration: durations.base, delay: 0.05 }),
    [],
  );
  const ctasVariants = useMemo(
    () => fadeInUp({ y: 10, duration: durations.base, delay: 0.1 }),
    [],
  );

  return (
    <motion.section
      className="bubble relative overflow-hidden p-6 sm:p-8 lg:p-10"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      initial={reduceMotion ? false : "hidden"}
      animate={reduceMotion ? undefined : "show"}
      variants={contentVariants}
    >
      {/* Soft gradient glow behind content */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
      >
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent)]/20 blur-3xl" />
        <div className="absolute right-[-6rem] top-10 h-80 w-80 rounded-full bg-[var(--accent-strong)]/15 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-72 w-72 rounded-full bg-[#ffffff]/10 blur-3xl" />
      </div>

      {/* Automation-themed background: lines + pulses */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          x: bgX,
          y: bgY,
        }}
        animate={
          reduceMotion
            ? undefined
            : {
                y: [0, -3, 0],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 7.5,
                ease: "easeInOut",
                repeat: Infinity,
              }
        }
      >
        <HeroWorkflowBackdrop reducedMotion={!!reduceMotion} />
      </motion.div>

      {/* Content */}
      <div className="relative z-10">
        <motion.div variants={headlineVariants}>
          <TypingHeadline />
        </motion.div>

        <motion.p
          variants={descriptionVariants}
          className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg"
        >
          Autom8x automates document-heavy operations. Connect inboxes, files, and
          systems to run workflows with clear review points.
        </motion.p>

        <motion.div
          variants={ctasVariants}
          className="mt-6 flex flex-wrap gap-3"
        >
          <motion.div
            whileHover={reduceMotion ? undefined : { y: -1 }}
            transition={{ duration: durations.fast, ease: easings.premium }}
          >
            <Link href="/solutions" className="btn-primary px-5">
              See How It Works
            </Link>
          </motion.div>
          <motion.div
            whileHover={reduceMotion ? undefined : { y: -1 }}
            transition={{ duration: durations.fast, ease: easings.premium }}
          >
            <Link href="/contact" className="btn-secondary px-5">
              Talk to Our Team
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function HeroWorkflowBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1200 520"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="a8xStroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(142,188,255,0.0)" />
          <stop offset="30%" stopColor="rgba(142,188,255,0.35)" />
          <stop offset="70%" stopColor="rgba(95,158,255,0.35)" />
          <stop offset="100%" stopColor="rgba(142,188,255,0.0)" />
        </linearGradient>
        <linearGradient id="a8xPulse" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="rgba(255,255,255,0.0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
        </linearGradient>
      </defs>

      {/* Primary workflow paths */}
      <path
        id="heroPath1"
        d="M-40,120 C220,60 360,160 520,140 C720,120 820,40 1040,90 C1140,112 1200,88 1240,70"
        fill="none"
        stroke="url(#a8xStroke)"
        strokeWidth="2"
        opacity="0.75"
      />
      <path
        id="heroPath2"
        d="M-20,260 C220,220 320,320 540,290 C700,268 780,210 980,240 C1100,258 1180,330 1240,360"
        fill="none"
        stroke="url(#a8xStroke)"
        strokeWidth="2"
        opacity="0.55"
      />
      <path
        id="heroPath3"
        d="M-40,420 C180,450 320,380 520,410 C760,450 880,420 1240,450"
        fill="none"
        stroke="url(#a8xStroke)"
        strokeWidth="1.8"
        opacity="0.4"
      />

      {/* Node junction points (soft, static) */}
      <g opacity="0.55">
        <circle cx="170" cy="92" r="3.2" fill="rgba(95,158,255,0.55)" />
        <circle cx="520" cy="140" r="3.2" fill="rgba(95,158,255,0.55)" />
        <circle cx="910" cy="88" r="3.2" fill="rgba(95,158,255,0.55)" />
        <circle cx="260" cy="240" r="3.0" fill="rgba(142,188,255,0.5)" />
        <circle cx="620" cy="282" r="3.0" fill="rgba(142,188,255,0.5)" />
        <circle cx="960" cy="240" r="3.0" fill="rgba(142,188,255,0.5)" />
      </g>

      {/* Moving signal pulses */}
      {!reducedMotion ? (
        <g>
          <circle r="3.2" fill="rgba(95,158,255,0.9)">
            <animateMotion dur="4.6s" repeatCount="indefinite">
              <mpath href="#heroPath1" />
            </animateMotion>
          </circle>

          <circle r="2.6" fill="rgba(142,188,255,0.85)">
            <animateMotion dur="5.2s" repeatCount="indefinite" begin="0.7s">
              <mpath href="#heroPath2" />
            </animateMotion>
          </circle>

          {/* Faint highlight streak */}
          <rect x="0" y="0" width="40" height="2" rx="999" fill="url(#a8xPulse)" opacity="0.35">
            <animateMotion dur="5.4s" repeatCount="indefinite" begin="1.2s">
              <mpath href="#heroPath1" />
            </animateMotion>
          </rect>
        </g>
      ) : null}
    </svg>
  );
}

