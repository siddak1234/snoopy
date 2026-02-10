"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const items = [
  { href: "/solutions/healthcare", label: "Healthcare" },
  { href: "/solutions/finance", label: "Finance" },
];

export default function SolutionsDropdown() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const focusItem = (index: number) => {
    itemRefs.current[index]?.focus();
  };

  const onButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
      focusItem(0);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      focusItem(items.length - 1);
    }
  };

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const currentIndex = itemRefs.current.findIndex((item) => item === document.activeElement);
    if (currentIndex < 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem((currentIndex + 1) % items.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem((currentIndex - 1 + items.length) % items.length);
    }
  };

  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
    }
  };

  const onSolutionsLinkKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      focusItem(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={onBlur}
    >
      <div className="inline-flex items-center rounded-full px-4 py-2 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-within:bg-[var(--surface-hover)]">
        <Link href="/solutions" className="focus-visible:outline-none" onKeyDown={onSolutionsLinkKeyDown}>
          Solutions
        </Link>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="solutions-dropdown-menu"
          aria-label="Toggle Solutions submenu"
          className="ml-1 inline-flex items-center justify-center rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={onButtonKeyDown}
        >
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`}
          >
            <path d="M5 7.5L10 12.5L15 7.5" />
          </svg>
        </button>
      </div>

      {open ? (
        <ul
          id="solutions-dropdown-menu"
          role="menu"
          aria-label="Solutions submenu"
          className="absolute left-0 top-full z-50 min-w-48 rounded-2xl border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[0_12px_24px_rgba(12,24,40,0.14)]"
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <li key={item.href} role="none">
              <Link
                href={item.href}
                role="menuitem"
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                className="block rounded-xl px-3 py-2 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
