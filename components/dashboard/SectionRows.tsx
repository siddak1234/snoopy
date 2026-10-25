import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr/CaretDown";
import type { RunSection } from "@/lib/automations";
import { sectionLink } from "@/lib/flow-items";

/** A section's row: its box (`SectionRows`, and `PageRow` beside it). */
export const SECTION_ROW =
  "rounded-[var(--radius-md)] border border-[var(--ring)] bg-[var(--surface)]";
/**
 * A section's bar, closed: one line of small text and its 20 px caret — the
 * height every row that opens something keeps (the owner's build 28 item 5:
 * "the size of the must haves drop down").
 */
export const SECTION_BAR = "flex items-center justify-between gap-3 px-4 py-3";

/**
 * What a run read, or what was read from an item's file, as the flow wrote it
 * for people (backend ADR-0046; Round 19, plan §5.3 and §5.4): each titled
 * section a row that opens and closes — all closed, but the first on a run's
 * page (`firstOpen`) — and in it each entry: its title, strong; its subtitle,
 * muted; its text; and its link, only an `http:` or `https:` one, opening
 * outside the site. The app's sections, on the website.
 */
export function SectionRows({
  sections,
  firstOpen = false,
  testId,
}: {
  sections: readonly RunSection[];
  /** The first section starts open (a run's page); otherwise every one is closed. */
  firstOpen?: boolean;
  /** Each row is `${testId}-${n}`, from 1. */
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {sections.map((section, index) => (
        <details
          key={`${section.title}-${index}`}
          data-testid={`${testId}-${index + 1}`}
          open={firstOpen && index === 0}
          className={`group ${SECTION_ROW}`}
        >
          <summary
            className={`${SECTION_BAR} cursor-pointer list-none rounded-[var(--radius-md)] [&::-webkit-details-marker]:hidden`}
          >
            <span className="text-sm font-medium text-[var(--text)]">
              {section.title}
            </span>
            <CaretDownIcon
              size={20}
              aria-hidden
              className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ul className="flex flex-col gap-3 border-t border-[var(--ring)] px-4 pt-3 pb-4">
            {section.entries.map((entry, at) => {
              const link = sectionLink(entry.url);
              return (
                <li key={`${entry.title}-${at}`} className="min-w-0">
                  <p className="text-sm font-medium break-words text-[var(--text)]">
                    {entry.title}
                  </p>
                  {entry.subtitle ? (
                    <p className="text-xs break-words text-[var(--muted)]">
                      {entry.subtitle}
                    </p>
                  ) : null}
                  {entry.text ? (
                    <p className="mt-1 text-sm break-words whitespace-pre-line text-[var(--text)]">
                      {entry.text}
                    </p>
                  ) : null}
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-sm break-all text-[var(--link)] underline underline-offset-2"
                    >
                      {link}
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
