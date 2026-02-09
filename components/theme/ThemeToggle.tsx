"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="3.8" />
      <path d="M12 2.8V5.2" />
      <path d="M12 18.8V21.2" />
      <path d="M2.8 12H5.2" />
      <path d="M18.8 12H21.2" />
      <path d="M5.4 5.4L7.1 7.1" />
      <path d="M16.9 16.9L18.6 18.6" />
      <path d="M16.9 7.1L18.6 5.4" />
      <path d="M5.4 18.6L7.1 16.9" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const storedTheme = localStorage.getItem("theme");
    return storedTheme === "dark" || storedTheme === "light" ? storedTheme : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const nextTheme = theme === "light" ? "dark" : "light";

  const toggleTheme = () => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--toggle-bg)] text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
