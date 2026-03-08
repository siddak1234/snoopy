"use client";

/**
 * Full-screen modal with a viewport-anchored content card so the card never
 * shifts when the cursor moves (e.g. to screen edges). Use for all button-triggered
 * popups (confirmations, dialogs, etc.).
 *
 * Structure: backdrop (fixed inset-0) + content (fixed left-1/2 top-1/2 -translate).
 * Backdrop click calls onClose. Content click is stopped so it doesn’t close.
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
  /** Use .bubble styling and hover effect on the content card */
  bubble?: boolean;
  /** Extra classes for the content panel (e.g. max-w-md, p-6) */
  contentClassName?: string;
  zIndex?: number;
}) {
  const contentZ = zIndex + 1;
  const baseContent =
    "fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--ring)] bg-[var(--surface)] p-6 shadow-xl [background:linear-gradient(165deg,var(--surface)_0%,var(--surface-strong)_100%)]";
  const contentClass = bubble
    ? `bubble fixed left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 p-6 sm:p-8 ${contentClassName}`.trim()
    : `${baseContent} ${contentClassName}`.trim();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
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
}
