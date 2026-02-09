import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const baseClasses = "h-10 w-10 rounded-2xl border border-[var(--icon-border)] bg-[var(--icon-bg)] p-2 text-[var(--icon-text)]";

export function SecureIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={baseClasses}
      aria-hidden
      {...props}
    >
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8 10V8a4 4 0 1 1 8 0v2" />
      <circle cx="12" cy="15" r="1.2" />
      <path d="M12 16.2V17.8" />
    </svg>
  );
}

export function ScalableIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={baseClasses}
      aria-hidden
      {...props}
    >
      <circle cx="6" cy="12" r="2.1" />
      <circle cx="12" cy="6" r="2.1" />
      <circle cx="18" cy="12" r="2.1" />
      <circle cx="12" cy="18" r="2.1" />
      <path d="M7.7 10.5L10.3 7.5" />
      <path d="M13.7 7.5L16.3 10.5" />
      <path d="M16.3 13.5L13.7 16.5" />
      <path d="M10.3 16.5L7.7 13.5" />
    </svg>
  );
}

export function AutonomousIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={baseClasses}
      aria-hidden
      {...props}
    >
      <path d="M12 3.8L13.9 8.1L18.5 8.6L15.1 11.7L16.1 16.2L12 13.9L7.9 16.2L8.9 11.7L5.5 8.6L10.1 8.1L12 3.8Z" />
      <circle cx="12" cy="12" r="2.3" />
    </svg>
  );
}
