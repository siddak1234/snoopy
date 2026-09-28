"use client";

import { forwardRef, type ReactNode } from "react";

type FormSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: string;
};

/**
 * FormInput's sibling for a choice among fixed options — the same label,
 * border and focus treatment, so a form that mixes the two reads as one.
 */
export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  function FormSelect(
    { label, hint, id, className = "", children, ...props },
    ref,
  ) {
    return (
      <div>
        {label ? (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-[var(--text)]"
          >
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={id}
          className={`mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-2.5 text-[var(--text)] transition hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60 ${className}`.trim()}
          {...props}
        >
          {children}
        </select>
        {hint ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        ) : null}
      </div>
    );
  },
);
