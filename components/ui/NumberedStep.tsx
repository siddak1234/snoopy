import type { ReactNode } from "react";

type NumberedStepProps = {
  /** 1-based index; rendered as 01 / 02 / 03. */
  index: number;
  /** Optional label after the number, e.g. "Review" → "01 · Review". */
  label?: string;
  title: string;
  children?: ReactNode;
  className?: string;
};

/**
 * The design's numbered step: accent tabular number over a hairline top rule,
 * used on Home "How it works", Solutions industry sections and Contact
 * "What happens next".
 */
export function NumberedStep({
  index,
  label,
  title,
  children,
  className = "",
}: NumberedStepProps) {
  const number = String(index).padStart(2, "0");

  return (
    <div
      className={`border-t border-[var(--color-neutral-700)] pt-4.5 ${className}`.trim()}
    >
      <p className="m-0 text-sm font-[var(--font-heading)] text-[var(--color-accent)] [font-feature-settings:'tnum'_1]">
        {label ? `${number} · ${label}` : number}
      </p>
      <h3 className="mt-3 text-[19px] font-medium">{title}</h3>
      {children ? (
        <p className="mt-2 text-[14.5px] leading-relaxed text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
          {children}
        </p>
      ) : null}
    </div>
  );
}
