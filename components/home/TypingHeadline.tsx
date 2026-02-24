"use client";

import { useEffect, useState } from "react";

const WORDS = ["Think", "Build", "Autom8"] as const;
const TYPE_SPEED = 100; // ms per character
const DELETE_SPEED = 60; // ms per character
const PAUSE_AFTER_TYPE = 800; // ms after a word is fully typed
const PAUSE_AFTER_DELETE = 220; // ms after a word is fully deleted

export default function TypingHeadline() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  // Typing / deleting effect
  useEffect(() => {
    if (prefersReducedMotion) {
      // Show final phrase without animation (defer to avoid synchronous setState in effect)
      const id = window.setTimeout(() => setDisplayed(WORDS[WORDS.length - 1]), 0);
      return () => window.clearTimeout(id);
    }

    if (isDone) {
      return;
    }

    const currentWord = WORDS[currentIndex];
    let timeoutId: number | undefined;

    if (!isDeleting && displayed.length < currentWord.length) {
      // Typing forward
      timeoutId = window.setTimeout(() => {
        setDisplayed(currentWord.slice(0, displayed.length + 1));
      }, TYPE_SPEED);
    } else if (!isDeleting && displayed.length === currentWord.length) {
      const isLastWord = currentIndex === WORDS.length - 1;

      // Pause after full word
      timeoutId = window.setTimeout(() => {
        if (isLastWord) {
          setIsDone(true);
          return;
        }
        setIsDeleting(true);
      }, PAUSE_AFTER_TYPE);
    } else if (isDeleting && displayed.length > 0) {
      // Deleting characters
      timeoutId = window.setTimeout(() => {
        setDisplayed(displayed.slice(0, -1));
      }, DELETE_SPEED);
    } else if (isDeleting && displayed.length === 0) {
      // Move to next word after delete
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
  }, [currentIndex, displayed, isDeleting, isDone, prefersReducedMotion]);

  const showCaret = !prefersReducedMotion;

  return (
    <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
      <span>{displayed}</span>
      {showCaret ? <span className="typing-caret ml-0.5">|</span> : null}
      <span> with AI...</span>
    </h1>
  );
}

