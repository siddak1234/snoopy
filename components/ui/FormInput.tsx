"use client";

import { forwardRef, type ReactNode } from "react";

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string;
  hint?: string;
  /** A unit drawn inside the field before the value, such as "$". */
  prefix?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput(
    { label, error, hint, prefix, id, className = "", ...props },
    ref,
  ) {
    const field = (
      <input
        ref={ref}
        id={id}
        className={`${prefix ? "pr-4 pl-8" : "mt-1.5 px-4"} w-full rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-surface)] py-2.5 text-[var(--text)] caret-[var(--color-accent)] transition placeholder:text-[var(--muted)] hover:border-[color-mix(in_srgb,var(--color-text)_45%,transparent)] focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--accent-strong)] focus:outline-none disabled:opacity-60 ${className}`.trim()}
        {...props}
      />
    );
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
        {prefix ? (
          <div className="relative mt-1.5">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[var(--muted)]"
            >
              {prefix}
            </span>
            {field}
          </div>
        ) : (
          field
        )}
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
