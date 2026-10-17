import Link from "next/link";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";

/**
 * The way back on a flow's own pages (Build 21, spec A2, A6: "Header: back ·
 * …"), as the app's back circle: an arrow (24) in a round button, named
 * "Back" for a screen reader, going to the page it came from.
 */
export function BackLink({ href }: { href: string }) {
  return (
    <Link
      prefetch={false}
      href={href}
      aria-label="Back"
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ring)] text-[var(--text)] transition hover:bg-[var(--surface-hover)]"
    >
      <ArrowLeftIcon aria-hidden size={24} />
    </Link>
  );
}
