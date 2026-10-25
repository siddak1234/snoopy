import Link from "next/link";
import type { ReactNode } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { SECTION_BAR, SECTION_ROW } from "./SectionRows";

/**
 * A row that opens a page (plan §3; the owner's build 28 items 5 and 9: "the
 * size of the must haves drop down", "a component with an arrow"): a
 * section's box and bar (`SectionRows`), so it is exactly a closed section's
 * height, with what it names on the left, `end` (a score) before the arrow,
 * and the whole row the link. An item's ranked runs and every run page's
 * Run details. The app's row with an arrow, on the website.
 */
export function PageRow({
  href,
  children,
  end,
  testId,
  dim = false,
}: {
  href: string;
  children: ReactNode;
  /** Drawn before the arrow: a run's score. */
  end?: ReactNode;
  testId?: string;
  /** A failed or stopped run: `data-dim`, its words in the muted token. */
  dim?: boolean;
}) {
  return (
    <Link
      prefetch={false}
      href={href}
      data-testid={testId}
      data-dim={dim ? "true" : undefined}
      className={`${SECTION_ROW} ${SECTION_BAR} transition hover:bg-[var(--surface-hover)]`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-3 text-sm">
        {children}
      </span>
      {end}
      <CaretRightIcon
        size={20}
        aria-hidden
        className="shrink-0 text-[var(--muted)]"
      />
    </Link>
  );
}
