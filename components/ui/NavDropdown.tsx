"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";

export type NavDropdownItem = { href: string; label: string };

type NavDropdownProps = {
  /** Trigger label. If `href` is given the label itself is a link. */
  label: ReactNode;
  href?: string;
  items: readonly NavDropdownItem[];
  /** id base for ARIA wiring; must be unique per instance. */
  id: string;
  className?: string;
};

/**
 * Generic accessible hover/keyboard dropdown menu (arrow-key roving focus,
 * Escape, outside-pointer close). Extracted from the pre-revamp
 * Solutions/Insights dropdown twins.
 */
export function NavDropdown({
  label,
  href,
  items,
  id,
  className = "",
}: NavDropdownProps) {
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
      if (event.key === "Escape") setOpen(false);
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
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
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
    const currentIndex = itemRefs.current.findIndex(
      (item) => item === document.activeElement,
    );
    if (currentIndex < 0) return;
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

  const onTriggerLinkKeyDown = (
    event: React.KeyboardEvent<HTMLAnchorElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      focusItem(0);
    }
  };

  const onPointerEnter = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setOpen(true);
  };
  const onPointerLeave = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`.trim()}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={onBlur}
    >
      <div className="inline-flex items-center rounded-full px-4 py-2.5 text-sm font-medium text-[var(--text)] transition focus-within:bg-[var(--surface-hover)] hover:bg-[var(--surface-hover)]">
        {href ? (
          <Link
            href={href}
            className="focus-visible:outline-none"
            onKeyDown={onTriggerLinkKeyDown}
          >
            {label}
          </Link>
        ) : (
          <span>{label}</span>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`${id}-menu`}
          aria-label={`Toggle ${typeof label === "string" ? label : ""} submenu`}
          className="ml-1 inline-flex items-center justify-center rounded p-0.5 focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={onButtonKeyDown}
        >
          <CaretDownIcon
            size={14}
            aria-hidden
            className={`transition ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {open ? (
        <ul
          id={`${id}-menu`}
          role="menu"
          className="absolute top-full left-0 z-50 min-w-48 rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[var(--surface)] p-2 shadow-[var(--shadow-md)]"
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
                className="block rounded-[var(--radius-md)] px-3 py-2 text-[var(--text)] transition hover:bg-[var(--surface-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent-strong)] focus-visible:outline-none"
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
