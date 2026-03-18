"use client";

import { useEffect, useState } from "react";

const WORDS = ["Think", "Build", "Autom8"] as const;
const SUFFIX = " with AI";
const TYPE_SPEED = 100;
const DELETE_SPEED = 60;
const PAUSE_AFTER_TYPE = 800;
const PAUSE_AFTER_DELETE = 220;

export default function TypingHeadline() {
  const [mounted, setMounted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (prefersReducedMotion) {
      const id = window.setTimeout(() => setDisplayed(WORDS[WORDS.length - 1]), 0);
      return () => window.clearTimeout(id);
    }

    if (isDone) {
      return;
    }

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
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [mounted, currentIndex, displayed, isDeleting, isDone, prefersReducedMotion]);

  const showCaret = mounted && !prefersReducedMotion;
  const visibleText = mounted ? displayed : WORDS[WORDS.length - 1];

  return (
    <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
      <span className="sr-only">Automate with AI</span>
      <span aria-hidden="true">
        <span>{visibleText}</span>
        {showCaret ? <span className="typing-caret ml-0.5">|</span> : null}
        <span>{SUFFIX}</span>
      </span>
    </h1>
  );
}
