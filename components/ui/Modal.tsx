"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function focusableChildren(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter((element) => element.getClientRects().length > 0);
}

/**
 * Full-screen modal with a viewport-anchored content card so the card never
 * shifts when the cursor moves (e.g. to screen edges). Use for all button-triggered
 * popups (confirmations, dialogs, etc.).
 *
 * Rendered via createPortal(..., document.body) so the modal is not inside a transformed
 * ancestor (e.g. .bubble with hover:transform), which would make fixed position follow the card.
 * Structure: portal to body, then backdrop (fixed inset-0) + content (fixed, centered).
 * Backdrop click calls onClose. Content click is stopped so it doesn’t close.
 * Modal content has no hover/parallax/tilt—position is fixed and stable.
 */
export default function Modal({
  onClose,
  children,
  ariaLabelledBy,
  ariaDescribedBy,
  bubble = false,
  contentClassName = "",
  zIndex = 50,
}: {
  onClose: () => void;
  children: React.ReactNode;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  /** Use .modal-card styling (bubble look, no hover/transform) so the card stays fixed */
  bubble?: boolean;
  /** Extra classes for the content panel (e.g. max-w-md, p-6) */
  contentClassName?: string;
  zIndex?: number;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const contentZ = zIndex + 1;
  const baseContent =
    "fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--ring)] bg-[var(--surface)] p-6 shadow-[var(--shadow-lg)]";
  const contentClass = bubble
    ? `modal-card fixed left-1/2 top-1/2 w-full max-w-md p-6 sm:p-8 ${contentClassName}`.trim()
    : `${baseContent} ${contentClassName}`.trim();

  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitialControl = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      focusableChildren(dialog)[0]?.focus();
    };
    const focusFrame = requestAnimationFrame(focusInitialControl);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const controls = focusableChildren(dialog);
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = controls[0];
      const last = controls.at(-1);
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first || active === dialog || !dialog.contains(active)) {
          event.preventDefault();
          last?.focus();
        }
      } else if (
        active === last ||
        active === dialog ||
        !dialog.contains(active)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const modalContent = (
    <div className="fixed inset-0" style={{ zIndex }} role="presentation">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        ref={dialogRef}
        tabIndex={-1}
        className={contentClass}
        style={{ zIndex: contentZ }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}
