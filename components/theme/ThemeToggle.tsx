"use client";

import { useEffect, useSyncExternalStore } from "react";
import { MoonStarsIcon, SunIcon } from "@phosphor-icons/react";

type Theme = "light" | "dark";

const THEME_EVENT = "themechange";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemeSnapshot(): Theme {
  const stored = localStorage.getItem("theme");
  return stored === "dark" || stored === "light" ? stored : "dark";
}

// Always "dark" on the server so the initial client render matches the
// pre-paint theme script's default (avoids the documented hydration warning).
function getServerSnapshot(): Theme {
  return "dark";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const nextTheme = theme === "light" ? "dark" : "light";

  const toggleTheme = () => {
    localStorage.setItem("theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--ring)] bg-[var(--toggle-bg)] text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
      aria-label={
        theme === "light" ? "Switch to dark mode" : "Switch to light mode"
      }
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
    >
      {theme === "light" ? (
        <MoonStarsIcon size={16} aria-hidden />
      ) : (
        <SunIcon size={16} aria-hidden />
      )}
    </button>
  );
}
