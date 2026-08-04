"use client";

import { forwardRef, type ReactNode } from "react";

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string;
  hint?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { label, error, hint, id, className = "", ...props },
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
        <input
          ref={ref}
          id={id}
          className={`mt-1.5 w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-4 py-2.5 text-[var(--text)] caret-[var(--color-accent)] transition placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60 ${className}`.trim()}
          {...props}
        />
        {hint && !error ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="mt-1 text-sm text-[var(--error-text)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  },
);
