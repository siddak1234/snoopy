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

const triggerTileIconClasses = "h-12 w-12 text-[var(--icon-text)] sm:h-14 sm:w-14";

export function MailSignalIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={triggerTileIconClasses}
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
      <path d="M4.6 7.4L12 12.7L19.4 7.4" />
    </svg>
  );
}

export function FileSignalIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={triggerTileIconClasses}
      aria-hidden="true"
      {...props}
    >
      <path d="M8 3.5H14.8L18.5 7.2V19a1.8 1.8 0 0 1-1.8 1.8H8A1.8 1.8 0 0 1 6.2 19V5.3A1.8 1.8 0 0 1 8 3.5Z" />
      <path d="M14.5 3.8V7.6H18.2" />
      <path d="M9 11.5H15.2" />
      <path d="M9 14.8H15.2" />
    </svg>
  );
}

export function StopwatchSignalIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={triggerTileIconClasses}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="13" r="6.8" />
      <path d="M12 13L15.2 10.5" />
      <path d="M10 3.8H14" />
      <path d="M16.2 5.7L17.9 4" />
    </svg>
  );
}
