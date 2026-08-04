"use client";

import { useEffect, useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * The design's hero typewriter: cycles Design → Run → Autom8 in gradient ink
 * with a blinking caret, settling on "Autom8". The full headline is exposed
 * to screen readers as static text; under reduced motion the final word
 * renders immediately.
 */

const WORDS = ["Design", "Run", "Autom8"] as const;
const TYPE_SPEED = 110;
const DELETE_SPEED = 55;
const PAUSE_AFTER_TYPE = 1000;
const PAUSE_AFTER_DELETE = 240;

export function TypingHeadline() {
  const mounted = useHydrated();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (prefersReducedMotion) {
      const id = window.setTimeout(
        () => setDisplayed(WORDS[WORDS.length - 1]),
        0,
      );
      return () => window.clearTimeout(id);
    }

    if (isDone) return;

    const currentWord = WORDS[currentIndex];
    let timeoutId: number | undefined;

    if (!isDeleting && displayed.length < currentWord.length) {
      timeoutId = window.setTimeout(() => {
        setDisplayed(currentWord.slice(0, displayed.length + 1));
      }, TYPE_SPEED);
    } else if (!isDeleting && displayed.length === currentWord.length) {
      const isLastWord = currentIndex === WORDS.length - 1;
      timeoutId = window.setTimeout(() => {
        if (isLastWord) {
          setIsDone(true);
          return;
        }
        setIsDeleting(true);
      }, PAUSE_AFTER_TYPE);
    } else if (isDeleting && displayed.length > 0) {
      timeoutId = window.setTimeout(() => {
        setDisplayed(displayed.slice(0, -1));
      }, DELETE_SPEED);
    } else if (isDeleting && displayed.length === 0) {
      timeoutId = window.setTimeout(() => {
        setIsDeleting(false);
        setCurrentIndex((currentIndex + 1) % WORDS.length);
      }, PAUSE_AFTER_DELETE);
    }

    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [
    mounted,
    currentIndex,
    displayed,
    isDeleting,
    isDone,
    prefersReducedMotion,
  ]);

  const showCaret = mounted && !prefersReducedMotion && !isDone;
  const visibleText = mounted ? displayed : WORDS[WORDS.length - 1];

  return (
    <h1 className="m-0 -ml-[0.06em] text-[clamp(40px,4.6vw,64px)] leading-[1.1] font-[var(--font-heading)] font-medium tracking-[-0.016em]">
      <span className="sr-only">Autom8 any workflow.</span>
      <span aria-hidden="true">
        <span className="block min-h-[1.1em]">
          <span
            className="bg-[linear-gradient(100deg,var(--color-accent-200)_0%,var(--color-accent)_50%,var(--color-accent-200)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent"
            style={{ animation: "ink-slide 7s linear infinite" }}
          >
            {visibleText}
          </span>
          {showCaret ? <span className="typing-caret">|</span> : null}
        </span>
        <span className="block">any workflow.</span>
      </span>
    </h1>
  );
}
