import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const iconClasses = "h-10 w-10 rounded-2xl border border-[var(--icon-border)] bg-[var(--icon-bg)] p-2 text-[var(--icon-text)]";

export function TriggerIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={iconClasses}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 12H14" />
      <path d="M11 8L15 12L11 16" />
      <path d="M15.5 6.5L19 9.2L17.2 13.1L20 15.8L16.1 17.6L13.4 21L10.1 18.2" />
    </svg>
  );
}

export function ProcessingIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={iconClasses}
      aria-hidden="true"
      {...props}
    >
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M12 3.5V6" />
      <path d="M12 18V20.5" />
      <path d="M3.5 12H6" />
      <path d="M18 12H20.5" />
      <path d="M8.3 8.3L6.6 6.6" />
      <path d="M15.7 8.3L17.4 6.6" />
      <path d="M8.3 15.7L6.6 17.4" />
      <path d="M15.7 15.7L17.4 17.4" />
      <circle cx="12" cy="12" r="1.9" />
    </svg>
  );
}

export function ResultIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={iconClasses}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.7 12.4L11 14.7L15.6 10.2" />
    </svg>
  );
}
