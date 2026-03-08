"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

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
  const contentZ = zIndex + 1;
  const baseContent =
    "fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--ring)] bg-[var(--surface)] p-6 shadow-xl [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]";
  const contentClass = bubble
    ? `modal-card fixed left-1/2 top-1/2 w-full max-w-md p-6 sm:p-8 ${contentClassName}`.trim()
    : `${baseContent} ${contentClassName}`.trim();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const modalContent = (
    <div
      className="fixed inset-0"
      style={{ zIndex }}
      role="presentation"
    >
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
