"use client";

import { forwardRef, type ReactNode } from "react";

type FormInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  error?: string;
  hint?: string;
};

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  function FormInput({ label, error, hint, id, className = "", ...props }, ref) {
    return (
      <div>
        {label ? (
          <label htmlFor={id} className="block text-sm font-medium text-[var(--text)]">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={id}
          className={`mt-1.5 w-full rounded-xl border border-[var(--ring)] bg-[var(--card)] px-4 py-2.5 text-[var(--text)] placeholder:text-[var(--muted)] transition focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)] disabled:opacity-60 ${className}`.trim()}
          {...props}
        />
        {hint && !error ? (
          <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="mt-1 text-sm text-[var(--error-text)]" role="alert">{error}</p>
        ) : null}
      </div>
    );
  }
);
